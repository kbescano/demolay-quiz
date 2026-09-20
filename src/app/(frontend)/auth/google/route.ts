import { NextResponse } from 'next/server'

import { sessionSecret } from '@/lib/auth'
import { buildAuthUrl, callbackUrl, codeChallenge, googleConfig, randomToken } from '@/lib/google'
import { OAUTH_COOKIE, OAUTH_MAX_AGE, signOAuthState } from '@/lib/session'

/** Step 1: send the player to Google, remembering state, nonce and PKCE verifier in a signed cookie. */
export async function GET(request: Request) {
  const config = googleConfig()
  const secret = sessionSecret()
  if (!config) return NextResponse.redirect(new URL('/?error=not-configured', request.url))
  if (!secret) return NextResponse.redirect(new URL('/?error=failed', request.url))

  const state = randomToken()
  const nonce = randomToken()
  const verifier = randomToken(48)

  const response = NextResponse.redirect(
    buildAuthUrl({
      clientId: config.clientId,
      redirectUri: callbackUrl(request.url),
      state,
      nonce,
      challenge: await codeChallenge(verifier),
    }),
  )
  response.cookies.set(OAUTH_COOKIE, await signOAuthState({ state, nonce, verifier }, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/auth/google',
    maxAge: OAUTH_MAX_AGE,
  })
  return response
}
