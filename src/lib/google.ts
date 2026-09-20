/**
 * Google sign-in (OpenID Connect, authorization-code flow with PKCE).
 * Everything here is pure or takes its network dependencies as arguments, so it can be tested
 * without Google credentials.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

/** Why a sign-in was refused. The value is used in the /?error= query string. */
export type GoogleErrorCode = 'not-configured' | 'denied' | 'unverified' | 'failed'

export class GoogleAuthError extends Error {
  constructor(
    public code: GoogleErrorCode,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'GoogleAuthError'
  }
}

export type GoogleConfig = { clientId: string; clientSecret: string }

/** Reads the OAuth client from the environment. Returns null when sign-in is not set up. */
export function googleConfig(env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

export function callbackUrl(requestUrl: string): string {
  return `${new URL(requestUrl).origin}/auth/google/callback`
}

/* ---------- PKCE and random values ---------- */

export function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function randomToken(byteLength = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

/** PKCE S256 challenge for a code verifier (RFC 7636). */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export function buildAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  nonce: string
  challenge: string
}): string {
  const url = new URL(GOOGLE_AUTH_URL)
  url.search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  return url.toString()
}

/* ---------- Code exchange and ID token verification ---------- */

export type GoogleProfile = { sub: string; email: string; name: string }

/** Swaps the one-time code for Google's ID token. */
export async function exchangeCode(args: {
  code: string
  verifier: string
  redirectUri: string
  config: GoogleConfig
  fetchImpl?: typeof fetch
}): Promise<string> {
  const { code, verifier, redirectUri, config, fetchImpl = fetch } = args
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  if (!response.ok) throw new GoogleAuthError('failed', `Token endpoint answered ${response.status}`)
  const body = (await response.json()) as { id_token?: unknown }
  if (typeof body.id_token !== 'string') throw new GoogleAuthError('failed', 'No id_token in response')
  return body.id_token
}

let remoteKeys: JWTVerifyGetKey | undefined
/** Google's public signing keys, fetched once and cached by jose. */
export function googleKeys(): JWTVerifyGetKey {
  remoteKeys ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL))
  return remoteKeys
}

/**
 * Checks an ID token's signature, issuer, audience, expiry and nonce, and that the email is
 * verified. Any Google account passes; there is no domain restriction.
 */
export async function verifyIdToken(
  idToken: string,
  options: { clientId: string; nonce: string; keys: JWTVerifyGetKey },
): Promise<GoogleProfile> {
  let payload
  try {
    ;({ payload } = await jwtVerify(idToken, options.keys, {
      issuer: GOOGLE_ISSUERS,
      audience: options.clientId,
    }))
  } catch {
    throw new GoogleAuthError('failed', 'ID token did not verify')
  }

  if (payload.nonce !== options.nonce) throw new GoogleAuthError('failed', 'Nonce mismatch')
  if (typeof payload.sub !== 'string' || !payload.sub) throw new GoogleAuthError('failed', 'No subject')
  if (typeof payload.email !== 'string' || !payload.email) throw new GoogleAuthError('failed', 'No email')
  if (payload.email_verified !== true) throw new GoogleAuthError('unverified', 'Email not verified')

  const email = payload.email.trim().toLowerCase()
  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : email.split('@')[0]
  return { sub: payload.sub, email, name }
}
