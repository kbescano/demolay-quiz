import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

/**
 * Uploaded images (the logo). The file bytes live in the database (see lib/db-storage.ts).
 * Readable by everyone so the logo can be shown to players.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Short description of the image, for screen readers.' },
    },
  ],
  upload: {
    // Raster only: an SVG served from this origin could carry scripts.
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    // Files go to the database through the storage adapter, never to the (read-only) server disk.
    disableLocalStorage: true,
    crop: false,
    focalPoint: false,
  },
}
