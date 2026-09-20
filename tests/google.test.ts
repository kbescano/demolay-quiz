import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  GoogleAuthError,
  buildAuthUrl,
  callbackUrl,
  codeChallenge,
  exchangeCode,
  googleConfig,
  randomToken,
  siteOrigin,
  verifyIdToken,
} from '../src/lib/google'

const CLIENT_ID = 'demo-client.apps.googleusercontent.com'
const NONCE = 'nonce-123'

let privateKey: CryptoKey
let keys: ReturnType<typeof createLocalJWKSet>

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey as CryptoKey
  const jwk = { ...(await exportJWK(pair.publicKey)), alg: 'RS256', kid: 'test-key' }
  keys = createLocalJWKSet({ keys: [jwk] })
})

async function token(
  claims: Record<string, unknown> = {},
  options: { issuer?: string; audience?: string; expiresIn?: string; key?: CryptoKey } = {},
) {
  return new SignJWT({
    email: 'Petitioner@Gmail.com',
    email_verified: true,
    name: 'Juan dela Cruz',
    nonce: NONCE,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('google-sub-1')
    .setIssuer(options.issuer ?? 'https://accounts.google.com')
    .setAudience(options.audience ?? CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '5m')
    .sign(options.key ?? privateKey)
}

const verify = (jwt: string, nonce = NONCE) => verifyIdToken(jwt, { clientId: CLIENT_ID, nonce, keys })

describe('verifyIdToken', () => {
  it('accepts a good token from any Google account and normalises the email', async () => {
    expect(await verify(await token())).toEqual({
      sub: 'google-sub-1',
      email: 'petitioner@gmail.com',
      name: 'Juan dela Cruz',
    })
  })

  it('accepts a non-gmail Google account (school or Workspace)', async () => {
    const profile = await verify(await token({ email: 'student@school.edu.ph' }))
    expect(profile.email).toBe('student@school.edu.ph')
  })

  it('accepts the bare-domain issuer form Google also uses', async () => {
    expect((await verify(await token({}, { issuer: 'accounts.google.com' }))).sub).toBe('google-sub-1')
  })

  it('falls back to the email name when Google sends no display name', async () => {
    expect((await verify(await token({ name: undefined }))).name).toBe('petitioner')
  })

  it('rejects a token for another app (wrong audience)', async () => {
    await expect(verify(await token({}, { audience: 'someone-else' }))).rejects.toMatchObject({ code: 'failed' })
  })

  it('rejects a token from another issuer', async () => {
    await expect(verify(await token({}, { issuer: 'https://evil.example' }))).rejects.toMatchObject({ code: 'failed' })
  })

  it('rejects a replayed token (nonce mismatch)', async () => {
    await expect(verify(await token(), 'a-different-nonce')).rejects.toMatchObject({ code: 'failed' })
  })

  it('rejects an expired token', async () => {
    await expect(verify(await token({}, { expiresIn: '-1m' }))).rejects.toMatchObject({ code: 'failed' })
  })

  it('rejects a token signed with a key Google does not publish', async () => {
    const other = await generateKeyPair('RS256')
    await expect(verify(await token({}, { key: other.privateKey as CryptoKey }))).rejects.toMatchObject({
      code: 'failed',
    })
  })

  it('rejects an unverified email with its own error code', async () => {
    await expect(verify(await token({ email_verified: false }))).rejects.toMatchObject({ code: 'unverified' })
  })

  it('rejects a token without an email', async () => {
    await expect(verify(await token({ email: undefined }))).rejects.toBeInstanceOf(GoogleAuthError)
  })

  it('rejects garbage', async () => {
    await expect(verify('not.a.jwt')).rejects.toMatchObject({ code: 'failed' })
  })
})

describe('PKCE and auth URL', () => {
  it('matches the RFC 7636 example challenge', async () => {
    expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('makes url-safe random tokens that differ each time', () => {
    const a = randomToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomToken()).not.toBe(a)
  })

  it('builds an authorization URL with code flow, PKCE, state and nonce', () => {
    const url = new URL(
      buildAuthUrl({
        clientId: CLIENT_ID,
        redirectUri: 'http://localhost:3000/auth/google/callback',
        state: 's',
        nonce: 'n',
        challenge: 'c',
      }),
    )
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: 'http://localhost:3000/auth/google/callback',
      response_type: 'code',
      scope: 'openid email profile',
      state: 's',
      nonce: 'n',
      code_challenge: 'c',
      code_challenge_method: 'S256',
    })
  })

  it('derives the callback URL from the request origin', () => {
    expect(callbackUrl('https://quiz.example.app/auth/google?x=1', {})).toBe(
      'https://quiz.example.app/auth/google/callback',
    )
  })

  it('prefers APP_URL over the request when it is set (behind a proxy the request can show an internal address)', () => {
    const env = { APP_URL: 'https://my-quiz.netlify.app/' }
    expect(siteOrigin('http://localhost:8888/auth/google', env)).toBe('https://my-quiz.netlify.app')
    expect(callbackUrl('http://localhost:8888/auth/google', env)).toBe(
      'https://my-quiz.netlify.app/auth/google/callback',
    )
  })

  it('ignores a blank APP_URL', () => {
    expect(siteOrigin('https://quiz.example.app/x', { APP_URL: '  ' })).toBe('https://quiz.example.app')
  })
})

describe('googleConfig', () => {
  it('needs both id and secret', () => {
    expect(googleConfig({})).toBeNull()
    expect(googleConfig({ GOOGLE_CLIENT_ID: 'id' })).toBeNull()
    expect(googleConfig({ GOOGLE_CLIENT_ID: ' ', GOOGLE_CLIENT_SECRET: 's' })).toBeNull()
    expect(googleConfig({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's' })).toEqual({
      clientId: 'id',
      clientSecret: 's',
    })
  })
})

describe('exchangeCode', () => {
  const config = { clientId: CLIENT_ID, clientSecret: 'shh' }

  it('posts the code with the PKCE verifier and returns the id_token', async () => {
    let seen: { url: string; body: URLSearchParams } | undefined
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, body: init.body as URLSearchParams }
      return new Response(JSON.stringify({ id_token: 'the.id.token', access_token: 'ignored' }), { status: 200 })
    }) as unknown as typeof fetch

    const result = await exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'http://x/cb', config, fetchImpl })
    expect(result).toBe('the.id.token')
    expect(seen?.url).toBe('https://oauth2.googleapis.com/token')
    expect(Object.fromEntries(seen!.body)).toEqual({
      code: 'c',
      client_id: CLIENT_ID,
      client_secret: 'shh',
      redirect_uri: 'http://x/cb',
      grant_type: 'authorization_code',
      code_verifier: 'v',
    })
  })

  it('fails when Google refuses the code', async () => {
    const fetchImpl = (async () => new Response('{"error":"invalid_grant"}', { status: 400 })) as unknown as typeof fetch
    await expect(
      exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'http://x/cb', config, fetchImpl }),
    ).rejects.toMatchObject({ code: 'failed' })
  })

  it('fails when the response has no id_token', async () => {
    const fetchImpl = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
    await expect(
      exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'http://x/cb', config, fetchImpl }),
    ).rejects.toMatchObject({ code: 'failed' })
  })
})
