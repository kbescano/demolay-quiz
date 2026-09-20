// Runs `npm run migrate` for deploys, retrying when the database is briefly unreachable.
// Turso can answer a build's first query with a 502 or a timeout (for example while an idle
// database wakes up), which would otherwise fail the whole deploy. Migrations are recorded as they
// run, so repeating one after a failure is safe.
import { spawnSync } from 'node:child_process'

const ATTEMPTS = 4
const DELAY_MS = Number(process.env.MIGRATE_RETRY_DELAY_MS) || 5000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const { status } = spawnSync('npm', ['run', 'migrate'], { stdio: 'inherit' })
  if (status === 0) process.exit(0)

  if (attempt === ATTEMPTS) {
    console.error(`Migration failed after ${ATTEMPTS} attempts.`)
    process.exit(status ?? 1)
  }
  const wait = DELAY_MS * attempt
  console.error(`Migration attempt ${attempt} of ${ATTEMPTS} failed. Retrying in ${wait / 1000}s...`)
  await sleep(wait)
}
