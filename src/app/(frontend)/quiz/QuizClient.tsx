'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import type { QuizState } from '@/lib/quiz'

import { answerAction } from '../actions'
import { Blanked } from '../Blanked'

type QuestionState = Extract<QuizState, { phase: 'question' }>

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function QuizClient({ initial }: { initial: QuestionState }) {
  const router = useRouter()
  const [state, setState] = useState<QuestionState>(initial)
  const [picked, setPicked] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [failedChoice, setFailedChoice] = useState<{ choice: number | null } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(initial.remainingMs / 1000))

  const busyRef = useRef(false)
  const questionId = state.question.id

  const submit = useCallback(
    async (choice: number | null) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      setPicked(choice)
      setFailedChoice(null)
      try {
        const next = await answerAction(questionId, choice)
        if (next.phase === 'question') {
          setState(next)
          setPicked(null)
        } else {
          router.replace(next.phase === 'done' ? '/results' : '/')
          return // stay locked while the page changes
        }
      } catch {
        setFailedChoice({ choice })
      }
      busyRef.current = false
      setBusy(false)
    },
    [questionId, router],
  )

  // Always call the latest submit from timers and key handlers.
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  }, [submit])

  // Countdown. Measured against a monotonic clock so a slow tab cannot cheat or lose time.
  useEffect(() => {
    const deadline = performance.now() + state.remainingMs
    let fired = false
    const tick = () => {
      const left = deadline - performance.now()
      setSecondsLeft(Math.max(0, Math.ceil(left / 1000)))
      if (left <= 0 && !fired) {
        fired = true
        void submitRef.current(null)
      }
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [state])

  // Keyboard: A-D or 1-4 choose an option.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toUpperCase()
      const position = LETTERS.indexOf(key) >= 0 ? LETTERS.indexOf(key) : Number.parseInt(key, 10) - 1
      const option = state.question.options[position]
      if (option) {
        event.preventDefault()
        void submitRef.current(option.index)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  const elapsed = Math.max(0, state.seconds - state.remainingMs / 1000)
  const urgent = secondsLeft <= 5
  const announce = secondsLeft === 10 || secondsLeft === 5 ? `${secondsLeft} seconds left` : ''

  return (
    <main className="quiz" data-urgent={urgent}>
      <div className="timebar" aria-hidden="true">
        <div
          key={questionId}
          className="timebar-fill"
          style={{ animationDuration: `${state.seconds}s`, animationDelay: `-${elapsed}s` }}
        />
      </div>

      <div className="page">
        <div className="quiz-head">
          <p className="counter">
            {String(state.index + 1).padStart(2, '0')} <span>/ {state.total}</span>
          </p>
          <div className="clock" role="timer" aria-live="off">
            <span className="clock-digits">{secondsLeft}</span>
            <span className="clock-unit">SEC</span>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>

        <h1 className="question">
          <Blanked text={state.question.text} />
        </h1>

        <ul className="options">
          {state.question.options.map((option, position) => (
            <li key={option.index}>
              <button
                type="button"
                className="option"
                disabled={busy}
                data-picked={picked === option.index}
                onClick={() => void submit(option.index)}
              >
                <span className="option-key" aria-hidden="true">
                  {LETTERS[position]}
                </span>
                <span className="option-text">{option.text}</span>
              </button>
            </li>
          ))}
        </ul>

        {failedChoice ? (
          <div className="retry" role="alert">
            <span className="error">Connection problem. Your answer was not saved.</span>
            <button type="button" className="btn btn--ghost" onClick={() => void submit(failedChoice.choice)}>
              Retry
            </button>
          </div>
        ) : (
          <p className="hint">Tap an answer or press A, B, C, D. Answers lock immediately.</p>
        )}
      </div>
    </main>
  )
}
