import { redirect } from 'next/navigation'
import React from 'react'

import { getPlayer, hasProfile } from '@/lib/auth'
import { getQuizState } from '@/lib/quiz'

import { QuizClient } from './QuizClient'

export const metadata = { title: 'Quiz' }

export default async function QuizPage() {
  const player = await getPlayer()
  if (!player || !hasProfile(player)) redirect('/')

  const state = await getQuizState(player)
  if (state.phase === 'done') redirect('/results')
  if (state.phase === 'none') redirect('/')
  return <QuizClient initial={state} />
}
