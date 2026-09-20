'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getPlayer, getSessionPlayerId, hasProfile, saveProfile } from '@/lib/auth'
import { cleanText } from '@/lib/quiz-core'
import { countAskableQuestions, startAttempt, submitAnswer, type QuizState } from '@/lib/quiz'
import { SESSION_COOKIE } from '@/lib/session'

export type ProfileState = {
  error?: string
  name?: string
  chapter?: string
}

/** First login only: saves name and chapter. They are locked afterwards. */
export async function saveProfileAction(_previous: ProfileState, formData: FormData): Promise<ProfileState> {
  const player = await getPlayer()
  if (!player) redirect('/')
  if (hasProfile(player)) redirect('/')

  const name = cleanText(formData.get('name'))
  const chapter = cleanText(formData.get('chapter'))

  if (name.length < 2 || name.length > 80) {
    return { error: 'Enter your full name (2 to 80 characters).', name, chapter }
  }
  if (chapter.length < 2 || chapter.length > 120) {
    return { error: 'Enter your chapter (2 to 120 characters).', name, chapter }
  }

  try {
    await saveProfile(player, name, chapter)
  } catch {
    return { error: 'Could not save your details. Please try again.', name, chapter }
  }
  redirect('/')
}

/** Starts a new attempt, or resumes the one in progress, then opens the quiz. */
export async function startQuizAction(): Promise<void> {
  const player = await getPlayer()
  if (!player || !hasProfile(player)) redirect('/')

  let ready = false
  try {
    ready = (await countAskableQuestions()) > 0
    if (ready) await startAttempt(player)
  } catch {
    redirect('/?error=start-failed')
  }
  redirect(ready ? '/quiz' : '/?error=not-ready')
}

export async function answerAction(questionId: number, choice: number | null): Promise<QuizState> {
  if (!Number.isInteger(questionId)) return { phase: 'none' }
  if (choice !== null && !Number.isInteger(choice)) return { phase: 'none' }
  // The session cookie alone identifies the player, so there is no database read before saving.
  const playerId = await getSessionPlayerId()
  if (!playerId) return { phase: 'none' }
  return submitAnswer(playerId, questionId, choice)
}

export async function signOutAction(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect('/')
}
