/** Where the database lives. Pure so it can be tested. */

export const LOCAL_DATABASE = 'file:./local.db'

/**
 * The database address: DATABASE_URI when set (a Turso libsql:// address in production), otherwise
 * the local file for development.
 *
 * On a live site a missing address must stop the app with a clear message. Falling back to a file
 * there would only fail later with a confusing SQLite error, because hosting has no writable disk.
 * The build step is allowed the fallback, since building never reads the database.
 */
export function resolveDatabaseUrl(env: Record<string, string | undefined>): string {
  const configured = env.DATABASE_URI?.trim()
  if (configured) return configured

  const building = env.NEXT_PHASE === 'phase-production-build'
  if (env.NODE_ENV === 'production' && !building) {
    throw new Error(
      'DATABASE_URI is not set. Add DATABASE_URI (your libsql:// Turso address) and DATABASE_AUTH_TOKEN to the ' +
        "site's environment variables for Builds AND Functions/Runtime, then redeploy.",
    )
  }
  return LOCAL_DATABASE
}
