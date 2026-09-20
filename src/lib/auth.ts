import 'server-only'

import config from '@payload-config'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { Player } from '@/payload-types'

import type { GoogleProfile } from './google'
import { SESSION_COOKIE, SESSION_MAX_AGE, readSession } from './session'

export function sessionSecret(): string {
  return process.env.PAYLOAD_SECRET ?? ''
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE,
}

/** The signed-in player for this request, or null. */
export const getPlayer = cache(async (): Promise<Player | null> => {
  const id = await readSession((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret())
  if (!id) return null
  const payload = await getPayload({ config })
  try {
    return await payload.findByID({ collection: 'players', id, depth: 0 })
  } catch {
    return null // the player was deleted by an admin
  }
})

/** Name and chapter are entered once, at first login. */
export function hasProfile(player: Pick<Player, 'name' | 'chapter'>): boolean {
  return Boolean(player.name?.trim() && player.chapter?.trim())
}

/** Finds the player for a verified Google account, creating them on first login. */
export async function upsertPlayer(profile: GoogleProfile): Promise<Player> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'players',
    where: { googleSub: { equals: profile.sub } },
    limit: 1,
    depth: 0,
  })
  const existing = docs[0]

  if (!existing) {
    return payload.create({
      collection: 'players',
      data: { googleSub: profile.sub, email: profile.email, googleName: profile.name },
      depth: 0,
    })
  }

  if (existing.email !== profile.email || existing.googleName !== profile.name) {
    try {
      return await payload.update({
        collection: 'players',
        id: existing.id,
        data: { email: profile.email, googleName: profile.name },
        depth: 0,
      })
    } catch {
      return existing // keep the old details rather than block the login
    }
  }
  return existing
}

/** Saves name and chapter once. A player who already has them is left as they are. */
export async function saveProfile(player: Player, name: string, chapter: string): Promise<Player> {
  if (hasProfile(player)) return player
  const payload = await getPayload({ config })
  return payload.update({ collection: 'players', id: player.id, data: { name, chapter }, depth: 0 })
}
