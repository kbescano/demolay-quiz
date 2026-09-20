import 'server-only'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { cache } from 'react'

import type { Attempt, Player, Question } from '@/payload-types'

import { hasProfile } from './auth'
import {
  clampSeconds,
  createTtlCache,
  gradeAnswer,
  isExpired,
  isValidPermutation,
  optionOrder,
  percentOf,
  remainingMs,
  shuffle,
  tally,
  type StoredAnswer,
} from './quiz-core'

/* ---------- Shapes sent to the browser. None of them contains a correct answer. ---------- */

export type QuestionView = {
  id: number
  text: string
  options: { index: number; text: string }[]
}

export type QuizState =
  | { phase: 'none' }
  | { phase: 'done' }
  | {
      phase: 'question'
      index: number
      total: number
      question: QuestionView
      remainingMs: number
      seconds: number
    }

export type MissedQuestion = {
  position: number
  text: string
  yourAnswer: string | null
  correctAnswer: string
}

export type QuizResults = {
  attemptNumber: number
  name: string
  chapter: string
  score: number
  total: number
  percent: number
  missed: MissedQuestion[]
}

export type HistoryRow = {
  attemptNumber: number
  score: number
  total: number
  percent: number
  completedAt: string
}

export type SiteView = {
  title: string
  subtitle: string
  seconds: number
  logo: { url: string; alt: string; width: number; height: number } | null
}

/* ---------- Helpers ---------- */

async function client(): Promise<Payload> {
  return getPayload({ config })
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((entry): entry is number => Number.isInteger(entry)) : []
}

function asAnswers(value: unknown): StoredAnswer[] {
  return Array.isArray(value) ? (value as StoredAnswer[]) : []
}

function asOrders(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function playerIdOf(attempt: Attempt): number {
  return typeof attempt.player === 'object' ? attempt.player.id : attempt.player
}

/** A question can be asked only if it has 2+ options and exactly one marked correct. */
function isAskable(question: Pick<Question, 'options'>): boolean {
  const options = question.options ?? []
  return options.length >= 2 && options.filter((option) => option.isCorrect).length === 1
}

/* ---------- Site settings ---------- */

/** Title, subtitle, logo and timer from Quiz settings. Shared by everything rendered in one request. */
export const getSite = cache(async function getSite(): Promise<SiteView> {
  const payload = await client()
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 1 })
  const logo = settings.logo && typeof settings.logo === 'object' ? settings.logo : null
  const title = settings.title || "Petitioners' Quiz"

  return {
    title,
    subtitle: settings.subtitle ?? 'Order of DeMolay',
    seconds: clampSeconds(settings.secondsPerQuestion),
    logo: logo?.url
      ? { url: logo.url, alt: logo.alt || title, width: logo.width ?? 240, height: logo.height ?? 240 }
      : null,
  }
})

const secondsCache = createTtlCache<number>(30_000)

/**
 * Seconds per question. Every answer needs it and it almost never changes, so each server instance
 * remembers it for 30 seconds instead of asking the database every time. A change made in the admin
 * reaches the running quiz within that time.
 */
export function getSeconds(): Promise<number> {
  return secondsCache.get(async () => {
    const payload = await client()
    const settings = await payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      select: { secondsPerQuestion: true },
    })
    return clampSeconds(settings.secondsPerQuestion)
  })
}

export async function countAskableQuestions(): Promise<number> {
  const payload = await client()
  const { docs } = await payload.find({
    collection: 'questions',
    where: { active: { equals: true } },
    limit: 0,
    pagination: false,
    depth: 0,
    select: { options: true },
  })
  return docs.filter(isAskable).length
}

/* ---------- A player's attempts ---------- */

/** The quiz this player has started but not finished, if any. */
async function currentAttempt(payload: Payload, playerId: number): Promise<Attempt | null> {
  const { docs } = await payload.find({
    collection: 'attempts',
    where: { and: [{ player: { equals: playerId } }, { status: { equals: 'in-progress' } }] },
    sort: '-createdAt',
    limit: 1,
    pagination: false,
    depth: 0,
  })
  return docs[0] ?? null
}

/** Whether a quiz is waiting to be resumed, and every finished attempt, oldest first. */
export async function getHome(player: Player): Promise<{ inProgress: boolean; history: HistoryRow[] }> {
  const payload = await client()
  const inProgress = Boolean(await currentAttempt(payload, player.id))
  const history = (player.scores ?? [])
    .map(({ attemptNumber, score, total, percent, completedAt }) => ({
      attemptNumber,
      score,
      total,
      percent,
      completedAt,
    }))
    .sort((a, b) => a.attemptNumber - b.attemptNumber)
  return { inProgress, history }
}

/**
 * Starts a new attempt with every askable question in random order. If the player already has
 * an unfinished attempt, that one is kept so they resume instead of restarting.
 */
export async function startAttempt(player: Player): Promise<void> {
  if (!hasProfile(player)) throw new Error('Name and chapter are required.')
  const payload = await client()
  if (await currentAttempt(payload, player.id)) return

  const { docs } = await payload.find({
    collection: 'questions',
    where: { active: { equals: true } },
    limit: 0,
    pagination: false,
    depth: 0,
    select: { options: true, keepOptionOrder: true },
  })
  const questions = docs.filter(isAskable)
  if (questions.length === 0) throw new Error('No questions are available yet.')

  const order = shuffle(questions.map((question) => question.id))
  const optionOrders: Record<string, number[]> = {}
  for (const question of questions) {
    optionOrders[String(question.id)] = optionOrder(question.options!.length, Boolean(question.keepOptionOrder))
  }

  // Attempt numbers count up from 1 and never repeat, even if an admin deleted an old attempt.
  const last = await payload.find({
    collection: 'attempts',
    where: { player: { equals: player.id } },
    sort: '-attemptNumber',
    limit: 1,
    pagination: false,
    depth: 0,
  })
  const highestSaved = Math.max(0, ...(player.scores ?? []).map((row) => row.attemptNumber))
  const attemptNumber = Math.max(last.docs[0]?.attemptNumber ?? 0, highestSaved) + 1

  await payload.create({
    collection: 'attempts',
    data: {
      player: player.id,
      attemptNumber,
      name: player.name!,
      chapter: player.chapter!,
      status: 'in-progress',
      currentIndex: 0,
      questionStartedAt: new Date().toISOString(),
      order,
      optionOrders,
      answers: [],
    },
  })
}

/** Adds this finished attempt to the player's score array (once per attempt number). */
async function saveScore(payload: Payload, attempt: Attempt): Promise<void> {
  const player = await payload.findByID({ collection: 'players', id: playerIdOf(attempt), depth: 0 })
  const rows = player.scores ?? []
  if (rows.some((row) => row.attemptNumber === attempt.attemptNumber)) return

  await payload.update({
    collection: 'players',
    id: player.id,
    depth: 0,
    data: {
      scores: [
        ...rows,
        {
          attemptNumber: attempt.attemptNumber,
          score: attempt.score ?? 0,
          total: attempt.total ?? 0,
          percent: attempt.percent ?? 0,
          completedAt: attempt.completedAt ?? new Date().toISOString(),
        },
      ],
    },
  })
}

/* ---------- Running the quiz ---------- */

/**
 * Stores one answer and moves the attempt to the next question (or finishes it).
 * An answer that arrives after the countdown plus grace period counts as "time is up".
 */
async function recordAnswer(
  payload: Payload,
  attempt: Attempt,
  choice: number | null,
  seconds: number,
): Promise<Attempt> {
  const order = asNumberArray(attempt.order)
  const index = attempt.currentIndex ?? 0
  const questionId = order[index]
  const answers = asAnswers(attempt.answers).filter((answer) => answer.questionId !== questionId)

  const startedAt = Date.parse(attempt.questionStartedAt ?? '')
  let entry: StoredAnswer
  try {
    const question = await payload.findByID({ collection: 'questions', id: questionId, depth: 0 })
    entry = gradeAnswer({ questionId, options: question.options ?? [], choice, startedAt, seconds, now: Date.now() })
  } catch {
    // The question was deleted while this attempt was running: leave it out of the score.
    entry = gradeAnswer({ questionId, options: undefined, choice, startedAt, seconds, now: Date.now() })
  }

  const nextAnswers = [...answers, entry]
  const nextIndex = index + 1
  const finished = nextIndex >= order.length

  const data: Partial<Attempt> = {
    answers: nextAnswers,
    currentIndex: nextIndex,
    questionStartedAt: new Date().toISOString(),
  }
  if (finished) {
    const { score, total } = tally(nextAnswers)
    Object.assign(data, {
      status: 'completed',
      score,
      total,
      percent: percentOf(score, total),
      completedAt: new Date().toISOString(),
    })
  }

  const updated = await payload.update({ collection: 'attempts', id: attempt.id, data, depth: 0 })
  if (finished) await saveScore(payload, updated)
  return updated
}

/** What the browser sees of a question: text and options in this attempt's order. No correct answer. */
function questionView(question: Question, optionOrders: unknown): QuestionView {
  const options = question.options ?? []
  const stored = asOrders(optionOrders)[String(question.id)]
  const permutation = isValidPermutation(stored, options.length)
    ? stored
    : options.map((_, i) => i) // the admin changed the number of options mid-quiz
  return {
    id: question.id,
    text: question.question,
    options: permutation.map((optionIndex) => ({ index: optionIndex, text: options[optionIndex].text })),
  }
}

async function toState(payload: Payload, attempt: Attempt, seconds: number): Promise<QuizState> {
  let current = attempt

  // Walk forward past anything that can no longer be asked (expired clock or deleted question).
  for (let guard = 0; guard < 500; guard++) {
    if (current.status === 'completed') return { phase: 'done' }

    const order = asNumberArray(current.order)
    const index = current.currentIndex ?? 0
    const questionId = order[index]
    const startedAt = Date.parse(current.questionStartedAt ?? '')
    const now = Date.now()

    if (Number.isNaN(startedAt) || isExpired(now, startedAt, seconds)) {
      current = await recordAnswer(payload, current, null, seconds)
      continue
    }

    let question: Question
    try {
      question = await payload.findByID({ collection: 'questions', id: questionId, depth: 0 })
    } catch {
      current = await recordAnswer(payload, current, null, seconds)
      continue
    }

    return {
      phase: 'question',
      index,
      total: order.length,
      remainingMs: remainingMs(now, startedAt, seconds),
      seconds,
      question: questionView(question, current.optionOrders),
    }
  }
  return { phase: 'done' }
}

export async function getQuizState(player: Player): Promise<QuizState> {
  const payload = await client()
  const attempt = await currentAttempt(payload, player.id)
  if (!attempt) return { phase: 'none' }
  return toState(payload, attempt, await getSeconds())
}

/**
 * Saves an answer and returns the next question.
 *
 * This runs once per question and every database query is a network round trip (Turso is remote),
 * so the common case is kept to three: the attempt, this question together with the next, and one
 * write. The last question and anything unusual (a question deleted mid-quiz) take the careful
 * route through recordAnswer/toState.
 */
export async function submitAnswer(playerId: number, questionId: number, choice: number | null): Promise<QuizState> {
  const payload = await client()
  const attempt = await currentAttempt(payload, playerId)

  if (!attempt) {
    // A repeated click on the very last question arrives after the quiz already finished.
    const { docs } = await payload.find({
      collection: 'attempts',
      where: { and: [{ player: { equals: playerId } }, { status: { equals: 'completed' } }] },
      sort: '-completedAt',
      limit: 1,
      pagination: false,
      depth: 0,
    })
    const justFinished = docs[0] && asAnswers(docs[0].answers).some((answer) => answer.questionId === questionId)
    return { phase: justFinished ? 'done' : 'none' }
  }

  const seconds = await getSeconds()
  const order = asNumberArray(attempt.order)
  const index = attempt.currentIndex ?? 0
  // A repeated or stale submission (double click, second tab) must not skip a question.
  if (order[index] !== questionId) return toState(payload, attempt, seconds)

  const nextId = order[index + 1]
  if (nextId !== undefined) {
    const { docs } = await payload.find({
      collection: 'questions',
      where: { id: { in: [questionId, nextId] } },
      limit: 2,
      pagination: false,
      depth: 0,
    })
    const current = docs.find((question) => question.id === questionId)
    const next = docs.find((question) => question.id === nextId)

    if (current && next) {
      const entry = gradeAnswer({
        questionId,
        options: current.options ?? [],
        choice,
        startedAt: Date.parse(attempt.questionStartedAt ?? ''),
        seconds,
        now: Date.now(),
      })
      const answers = [...asAnswers(attempt.answers).filter((answer) => answer.questionId !== questionId), entry]
      const nextIndex = index + 1
      const startedAt = new Date()
      const { id, ...fields } = attempt

      // One statement. payload.update would also re-read the document and check document locks.
      await payload.db.updateOne({
        collection: 'attempts',
        id,
        returning: false,
        data: {
          ...fields,
          answers,
          currentIndex: nextIndex,
          questionStartedAt: startedAt.toISOString(),
          updatedAt: startedAt.toISOString(),
        },
      })

      return {
        phase: 'question',
        index: nextIndex,
        total: order.length,
        seconds,
        remainingMs: remainingMs(Date.now(), startedAt.getTime(), seconds),
        question: questionView(next, attempt.optionOrders),
      }
    }
  }

  const updated = await recordAnswer(payload, attempt, choice, seconds)
  return toState(payload, updated, seconds)
}

/* ---------- Results ---------- */

/** Results of one finished attempt: the given number, or the player's latest. */
export async function getResults(player: Player, attemptNumber?: number): Promise<QuizResults | null> {
  const payload = await client()
  const filters: Record<string, unknown>[] = [
    { player: { equals: player.id } },
    { status: { equals: 'completed' } },
  ]
  if (attemptNumber !== undefined) filters.push({ attemptNumber: { equals: attemptNumber } })

  const { docs } = await payload.find({
    collection: 'attempts',
    where: { and: filters },
    sort: '-attemptNumber',
    limit: 1,
    pagination: false,
    depth: 0,
  })
  const attempt = docs[0]
  if (!attempt) return null

  const order = asNumberArray(attempt.order)
  const wrong = asAnswers(attempt.answers).filter((answer) => !answer.correct && !answer.skipped)
  const wrongIds = wrong.map((answer) => answer.questionId)

  const byId = new Map<number, Question>()
  if (wrongIds.length > 0) {
    const found = await payload.find({
      collection: 'questions',
      where: { id: { in: wrongIds } },
      limit: 0,
      pagination: false,
      depth: 0,
    })
    for (const question of found.docs) byId.set(question.id, question)
  }

  const missed: MissedQuestion[] = []
  for (const answer of wrong) {
    const question = byId.get(answer.questionId)
    if (!question) continue
    const options = question.options ?? []
    missed.push({
      position: order.indexOf(answer.questionId) + 1,
      text: question.question,
      yourAnswer: answer.choice === null ? null : (options[answer.choice]?.text ?? null),
      correctAnswer: options.find((option) => option.isCorrect)?.text ?? '',
    })
  }
  missed.sort((a, b) => a.position - b.position)

  return {
    attemptNumber: attempt.attemptNumber,
    name: attempt.name,
    chapter: attempt.chapter,
    score: attempt.score ?? 0,
    total: attempt.total ?? 0,
    percent: attempt.percent ?? 0,
    missed,
  }
}
