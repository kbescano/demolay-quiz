import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { sessionCookieOptions, sessionSecret, upsertPlayer } from '@/lib/auth'
import {
  GoogleAuthError,
  callbackUrl,
  exchangeCode,
  googleConfig,
  googleKeys,
  verifyIdToken,
  type GoogleErrorCode,
} from '@/lib/google'
import { OAUTH_COOKIE, SESSION_COOKIE, readOAuthState, signSession } from '@/lib/session'

const clearOAuthCookie = { path: '/auth/google', maxAge: 0 }

/** Step 2: Google sends the player back here with a one-time code. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const fail = (code: GoogleErrorCode) => {
    const response = NextResponse.redirect(new URL(`/?error=${code}`, url))
    response.cookies.set(OAUTH_COOKIE, '', clearOAuthCookie)
    return response
  }

  const config = googleConfig()
  const secret = sessionSecret()
  if (!config) return fail('not-configured')
  if (!secret) return fail('failed')

  // The player pressed "Cancel" on Google's screen, or Google reported a problem.
  const googleError = url.searchParams.get('error')
  if (googleError) return fail(googleError === 'access_denied' ? 'denied' : 'failed')

  const saved = await readOAuthState((await cookies()).get(OAUTH_COOKIE)?.value, secret)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  // The state must match the one we stored when this sign-in began (blocks forged callbacks).
  if (!saved || !code || !state || state !== saved.state) return fail('failed')

  try {
    const idToken = await exchangeCode({
      code,
      verifier: saved.verifier,
      redirectUri: callbackUrl(request.url),
      config,
    })
    const profile = await verifyIdToken(idToken, {
      clientId: config.clientId,
      nonce: saved.nonce,
      keys: googleKeys(),
    })
    const player = await upsertPlayer(profile)

    const response = NextResponse.redirect(new URL('/', url))
    response.cookies.set(SESSION_COOKIE, await signSession(player.id, secret), sessionCookieOptions)
    response.cookies.set(OAUTH_COOKIE, '', clearOAuthCookie)
    return response
  } catch (error) {
    return fail(error instanceof GoogleAuthError && error.code === 'unverified' ? 'unverified' : 'failed')
  }
}
