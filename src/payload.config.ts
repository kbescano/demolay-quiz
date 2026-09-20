import path from 'path'
import { fileURLToPath } from 'url'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import { buildConfig } from 'payload'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { MediaFiles } from './collections/MediaFiles'
import { Questions } from './collections/Questions'
import { Attempts } from './collections/Attempts'
import { Players } from './collections/Players'
import { SiteSettings } from './globals/SiteSettings'
import { resolveDatabaseUrl } from './lib/database-url'
import { databaseStorage } from './lib/db-storage'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '· DeMolay Quiz',
      icons: [{ rel: 'icon', type: 'image/png', url: '/icon.png' }],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, MediaFiles, Questions, Players, Attempts],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Local development uses a plain file. In production, DATABASE_URI is a Turso (libSQL) address
  // and the app refuses to start without it.
  db: sqliteAdapter({
    client: {
      url: resolveDatabaseUrl(process.env),
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    },
    // The schema only changes through migrations (npm run migrate:create, then npm run migrate).
    push: false,
  }),
  // Images are small (a logo), and they are stored in the database.
  upload: { limits: { fileSize: 2 * 1024 * 1024 } },
  plugins: [cloudStoragePlugin({ collections: { media: { adapter: databaseStorage } } })],
})
