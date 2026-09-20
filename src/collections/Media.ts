import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

/** Uploaded images (the logo). Stored in Cloudflare R2. Readable by everyone so the logo can be shown. */
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
    // These are not supported on Workers yet due to lack of sharp
    crop: false,
    focalPoint: false,
  },
}
