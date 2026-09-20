import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { getPlayer, hasProfile } from '@/lib/auth'
import { countAskableQuestions, getHome, getSite } from '@/lib/quiz'

import { PendingButton } from './PendingButton'
import { ProfileForm } from './ProfileForm'
import { signOutAction, startQuizAction } from './actions'

type Home = Awaited<ReturnType<typeof getHome>>

const ERRORS: Record<string, string> = {
  'not-configured': 'Google sign-in is not set up yet. Please tell the quiz admin.',
  denied: 'Sign-in was cancelled. Try again when you are ready.',
  unverified: 'That Google account has no verified email. Please use a different account.',
  failed: 'Google sign-in did not work. Please try again.',
  'not-ready': 'The quiz is not ready yet. Please check back soon.',
  'start-failed': 'The quiz could not start. Please try again.',
}

// Dates are shown in the Philippines' time zone.
const dateFormat = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' })

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 48 48" width="24" height="24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const player = await getPlayer()
  const ready = player && hasProfile(player)

  const noHome: Promise<Home | null> = Promise.resolve(null)
  const [site, count, home] = await Promise.all([
    getSite(),
    countAskableQuestions(),
    ready ? getHome(player) : noHome,
  ])

  const action = home?.inProgress ? 'Continue quiz' : home && home.history.length > 0 ? 'Take it again' : 'Begin quiz'

  return (
    <main className="page home">
      <div className="brand">
        {site.logo && (
          <Image
            src={site.logo.url}
            alt={site.logo.alt}
            width={site.logo.width}
            height={site.logo.height}
            unoptimized
            priority
          />
        )}
        <p className="eyebrow">{site.subtitle}</p>
      </div>

      <h1 className="display">{site.title}</h1>
      <hr className="rule" />

      {count > 0 ? (
        <p className="lede">
          <strong>{count}</strong> questions. <strong>{site.seconds}</strong> seconds each. Finish them all to
          see your score.
        </p>
      ) : (
        <p className="lede">The quiz is not ready yet. Please check back soon.</p>
      )}

      {error && ERRORS[error] && (
        <p className="error notice-error" role="alert">
          {ERRORS[error]}
        </p>
      )}

      {/* 1. Not signed in */}
      {!player && (
        <div className="form">
          <a className="btn btn--block btn--google" href="/auth/google">
            <GoogleMark />
            Continue with Google
          </a>
          <p className="consent">
            Sign in with any Google account. Your name, chapter, email and scores are saved for this quiz and can
            be seen by the quiz admins.
          </p>
        </div>
      )}

      {/* 2. Signed in, first time: name and chapter, asked once */}
      {player && !ready && (
        <section className="step">
          <p className="eyebrow">Signed in as {player.email}</p>
          <h2 className="step-title">One last thing</h2>
          <p className="consent">
            Enter your name and chapter. You only do this once and they cannot be changed afterwards, so check the
            spelling.
          </p>
          <ProfileForm suggestedName={player.googleName ?? ''} />
          <form action={signOutAction} className="signout">
            <button className="link-button" type="submit">
              Use a different account
            </button>
          </form>
        </section>
      )}

      {/* 3. Signed in and ready */}
      {player && ready && home && (
        <>
          <div className="who-bar">
            <p>
              <strong>{player.name}</strong> · {player.chapter}
            </p>
            <form action={signOutAction}>
              <button className="link-button" type="submit">
                Sign out
              </button>
            </form>
          </div>

          <form className="form" action={startQuizAction}>
            <PendingButton>{action}</PendingButton>
          </form>

          {home.history.length > 0 && (
            <section className="history" aria-labelledby="history-title">
              <h2 id="history-title" className="eyebrow">
                Your attempts
              </h2>
              <ol>
                {home.history.map((row) => (
                  <li key={row.attemptNumber}>
                    <Link href={`/results?attempt=${row.attemptNumber}`}>
                      <span className="history-no">Attempt {row.attemptNumber}</span>
                      <span className="history-score">
                        {row.score}/{row.total}
                      </span>
                      <span className="history-pct">{row.percent}%</span>
                      <span className="history-date">{dateFormat.format(new Date(row.completedAt))}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      <ol className="rules">
        <li>Sign in with Google. Every attempt is saved to your account.</li>
        <li>Questions come in random order.</li>
        <li>{site.seconds} seconds per question. When time runs out it counts as wrong.</li>
        <li>No going back, no pausing. Every question must be finished.</li>
        <li>Your score and the questions you missed appear at the end.</li>
      </ol>
    </main>
  )
}
