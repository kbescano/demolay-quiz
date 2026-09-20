import type { CollectionConfig } from 'payload'

import { nobody } from '../access/authenticated'

/**
 * The bytes of uploaded images (the logo), kept in the database so the app needs no separate
 * file-storage service. Only server code reads or writes this: the API never exposes it, and
 * images are served through the Media collection's /api/media/file/... URL.
 */
export const MediaFiles: CollectionConfig = {
  slug: 'media-files',
  admin: { hidden: true },
  access: {
    create: nobody,
    read: nobody,
    update: nobody,
    delete: nobody,
  },
  fields: [
    { name: 'path', type: 'text', required: true, unique: true, index: true },
    { name: 'mimeType', type: 'text', required: true },
    { name: 'size', type: 'number', required: true },
    // base64 text. Payload limits text fields to 40,000 characters unless told otherwise, and a
    // 2 MB upload (the cap) is about 2.8 million characters in base64.
    { name: 'data', type: 'textarea', required: true, maxLength: 3_000_000 },
  ],
}
