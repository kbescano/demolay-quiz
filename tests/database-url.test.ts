import { describe, expect, it } from 'vitest'

import { LOCAL_DATABASE, resolveDatabaseUrl } from '../src/lib/database-url'

describe('resolveDatabaseUrl', () => {
  it('uses DATABASE_URI when it is set', () => {
    expect(resolveDatabaseUrl({ DATABASE_URI: 'libsql://quiz-x.turso.io', NODE_ENV: 'production' })).toBe(
      'libsql://quiz-x.turso.io',
    )
  })

  it('trims stray spaces around the address', () => {
    expect(resolveDatabaseUrl({ DATABASE_URI: '  libsql://quiz-x.turso.io \n' })).toBe('libsql://quiz-x.turso.io')
  })

  it('falls back to the local file in development', () => {
    expect(resolveDatabaseUrl({ NODE_ENV: 'development' })).toBe(LOCAL_DATABASE)
    expect(resolveDatabaseUrl({})).toBe(LOCAL_DATABASE)
  })

  it('treats a blank value like a missing one', () => {
    expect(resolveDatabaseUrl({ DATABASE_URI: '   ' })).toBe(LOCAL_DATABASE)
  })

  it('refuses to start a live site without an address, and names the variable', () => {
    expect(() => resolveDatabaseUrl({ NODE_ENV: 'production' })).toThrow(/DATABASE_URI is not set/)
    expect(() => resolveDatabaseUrl({ NODE_ENV: 'production', DATABASE_URI: '' })).toThrow(/Functions/)
  })

  it('still lets the build run without one, because building never reads the database', () => {
    expect(resolveDatabaseUrl({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })).toBe(LOCAL_DATABASE)
  })
})
