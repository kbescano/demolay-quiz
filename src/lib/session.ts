/**
 * Signed cookies for the player session and for the short-lived Google sign-in state.
 * Pure (no Next.js or database), so it can be tested. Tokens are HS256 JWTs signed with keys
 * derived from PAYLOAD_SECRET; the two kinds use different keys so one can never be replayed as the other.
 */
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'quiz_session'
export const OAUTH_COOKIE = 'quiz_oauth'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
export const OAUTH_MAX_AGE = 60 * 10 // 10 minutes to finish the Google screen

export type OAuthState = { state: string; nonce: string; verifier: string }

function key(kind: 'session' | 'oauth', secret: string): Uint8Array {
  if (!secret) throw new Error('PAYLOAD_SECRET is not set')
  return new TextEncoder().encode(`demolay-quiz:${kind}:${secret}`)
}

export async function signSession(playerId: number, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(playerId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key('session', secret))
}

/** The player id inside a valid, unexpired session cookie, otherwise null. */
export async function readSession(token: string | undefined, secret: string): Promise<number | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key('session', secret), { algorithms: ['HS256'] })
    const id = Number(payload.sub)
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export async function signOAuthState(value: OAuthState, secret: string): Promise<string> {
  return new SignJWT({ ...value })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_MAX_AGE}s`)
    .sign(key('oauth', secret))
}

export async function readOAuthState(token: string | undefined, secret: string): Promise<OAuthState | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key('oauth', secret), { algorithms: ['HS256'] })
    const { state, nonce, verifier } = payload as Partial<OAuthState>
    return typeof state === 'string' && typeof nonce === 'string' && typeof verifier === 'string'
      ? { state, nonce, verifier }
      : null
  } catch {
    return null
  }
}
