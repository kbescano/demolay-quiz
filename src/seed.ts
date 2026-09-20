/**
 * Loads seed/questions.json into the question bank.
 *
 *   npm run seed                                     the local database (local.db)
 *   DATABASE_URI=libsql://... DATABASE_AUTH_TOKEN=... npm run seed     your live Turso database
 *
 * Questions that already exist (matched by exam number) are left alone so admin edits are
 * never overwritten. Set SEED_OVERWRITE=1 to reset them to the file's contents.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import config from '@payload-config'
import { getPayload } from 'payload'

type SeedQuestion = {
  number: number
  question: string
  options: { text: string; isCorrect: boolean }[]
  active: boolean
  keepOptionOrder: boolean
  answerSource: 'exam-key' | 'handbook' | 'web' | 'knowledge' | 'manual'
  adminNote?: string
}

const overwrite = process.env.SEED_OVERWRITE === '1'

const payload = await getPayload({ config })
const file = path.resolve(process.cwd(), 'seed/questions.json')
const items = JSON.parse(await fs.readFile(file, 'utf8')) as SeedQuestion[]

let created = 0
let updated = 0
let skipped = 0

for (const item of items) {
  const { docs } = await payload.find({
    collection: 'questions',
    where: { number: { equals: item.number } },
    limit: 1,
    depth: 0,
  })
  const existing = docs[0]

  if (existing && !overwrite) {
    skipped++
    continue
  }
  if (existing) {
    await payload.update({ collection: 'questions', id: existing.id, data: item })
    updated++
  } else {
    await payload.create({ collection: 'questions', data: item })
    created++
  }
}

payload.logger.info(`Seed finished: ${created} created, ${updated} updated, ${skipped} left as they were.`)
process.exit(0)
