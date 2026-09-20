'use client'

import React from 'react'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page">
      <p className="eyebrow">Something broke</p>
      <h1 className="display" style={{ fontSize: 'clamp(3rem, 12vw, 7rem)' }}>
        Try that again
      </h1>
      <hr className="rule" />
      <p className="lede">The page could not load. Your progress is saved.</p>
      <div className="actions">
        <button className="btn" type="button" onClick={reset}>
          Reload
        </button>
      </div>
    </main>
  )
}
