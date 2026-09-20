import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'

import { readOAuthState, readSession, signOAuthState, signSession } from '../src/lib/session'

const SECRET = 'test-secret-value-that-is-long-enough'

describe('session cookie', () => {
  it('round-trips a player id', async () => {
    expect(await readSession(await signSession(42, SECRET), SECRET)).toBe(42)
  })

  it('is refused under a different secret', async () => {
    expect(await readSession(await signSession(42, SECRET), 'another-secret')).toBeNull()
  })

  it('is refused when tampered with', async () => {
    const token = await signSession(42, SECRET)
    const [head, body, sig] = token.split('.')
    const forgedBody = btoa(JSON.stringify({ sub: '1', exp: 9999999999 })).replaceAll('=', '')
    expect(await readSession(`${head}.${forgedBody}.${sig}`, SECRET)).toBeNull()
    expect(await readSession(`${head}.${body}.${sig.slice(0, -2)}xx`, SECRET)).toBeNull()
  })

  it('is refused once expired', async () => {
    const key = new TextEncoder().encode(`demolay-quiz:session:${SECRET}`)
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('42')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key)
    expect(await readSession(expired, SECRET)).toBeNull()
  })

  it('refuses missing, empty and non-numeric input', async () => {
    expect(await readSession(undefined, SECRET)).toBeNull()
    expect(await readSession('', SECRET)).toBeNull()
    expect(await readSession('nope', SECRET)).toBeNull()
    const key = new TextEncoder().encode(`demolay-quiz:session:${SECRET}`)
    const odd = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('abc').sign(key)
    expect(await readSession(odd, SECRET)).toBeNull()
  })

  it('refuses to sign with no secret', async () => {
    await expect(signSession(1, '')).rejects.toThrow(/PAYLOAD_SECRET/)
  })
})

describe('google sign-in state cookie', () => {
  const value = { state: 's', nonce: 'n', verifier: 'v' }

  it('round-trips state, nonce and verifier', async () => {
    expect(await readOAuthState(await signOAuthState(value, SECRET), SECRET)).toEqual(value)
  })

  it('cannot be used as a session, and a session cannot be used as sign-in state', async () => {
    expect(await readSession(await signOAuthState(value, SECRET), SECRET)).toBeNull()
    expect(await readOAuthState(await signSession(7, SECRET), SECRET)).toBeNull()
  })

  it('is refused under a different secret or when missing', async () => {
    expect(await readOAuthState(await signOAuthState(value, SECRET), 'other')).toBeNull()
    expect(await readOAuthState(undefined, SECRET)).toBeNull()
  })
})
