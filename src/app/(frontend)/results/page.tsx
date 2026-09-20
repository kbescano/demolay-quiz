import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { getPlayer, hasProfile } from '@/lib/auth'
import { getHome, getResults, getSite } from '@/lib/quiz'

import { Blanked } from '../Blanked'
import { PendingButton } from '../PendingButton'
import { startQuizAction } from '../actions'

export const metadata = { title: 'Your result' }

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ attempt?: string }> }) {
  const player = await getPlayer()
  if (!player || !hasProfile(player)) redirect('/')

  const { attempt } = await searchParams
  const wanted = attempt && /^\d{1,6}$/.test(attempt) ? Number(attempt) : undefined

  const [results, site] = await Promise.all([getResults(player, wanted), getSite()])
  if (!results) {
    redirect((await getHome(player)).inProgress ? '/quiz' : '/')
  }

  const { attemptNumber, name, chapter, score, total, percent, missed } = results

  return (
    <main className="page">
      <div className="brand">
        {site.logo && (
          <Image
            src={site.logo.url}
            alt={site.logo.alt}
            width={site.logo.width}
            height={site.logo.height}
            unoptimized
          />
        )}
        <p className="eyebrow">Attempt {attemptNumber} · Your result</p>
      </div>

      <p className="score" aria-label={`You scored ${score} out of ${total}`}>
        {score}
        <small>/{total}</small>
      </p>
      <p className="percent">
        <span>{percent}%</span> correct
      </p>
      <p className="who">
        {name} · {chapter}
      </p>

      {missed.length === 0 ? (
        <p className="perfect">Perfect score. Nothing missed.</p>
      ) : (
        <section className="missed" aria-labelledby="missed-title">
          <h2 id="missed-title">
            Missed <span>{missed.length}</span>
          </h2>
          <ol className="missed-list">
            {missed.map((item) => (
              <li className="missed-item" key={item.position}>
                <span className="missed-no">{String(item.position).padStart(2, '0')}</span>
                <div>
                  <p className="missed-q">
                    <Blanked text={item.text} />
                  </p>
                  <dl className="answer answer--yours">
                    <dt>Your answer</dt>
                    <dd className={item.yourAnswer ? undefined : 'none'}>
                      {item.yourAnswer ?? 'No answer. Time ran out.'}
                    </dd>
                  </dl>
                  <dl className="answer answer--right">
                    <dt>Correct answer</dt>
                    <dd>{item.correctAnswer}</dd>
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="actions actions--row">
        <form action={startQuizAction}>
          <PendingButton>Take it again</PendingButton>
        </form>
        <Link className="btn btn--ghost" href="/">
          All attempts
        </Link>
      </div>
    </main>
  )
}
