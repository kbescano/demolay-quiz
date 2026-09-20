import type { GlobalConfig } from 'payload'

import { authenticated } from '../access/authenticated'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Quiz settings',
  access: {
    read: authenticated,
    update: authenticated,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      defaultValue: "Petitioners' Quiz",
      admin: { description: 'Big heading on the home page.' },
    },
    {
      name: 'subtitle',
      type: 'text',
      defaultValue: 'Order of DeMolay',
      admin: { description: 'Small line above the heading.' },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Upload your chapter or Order logo. PNG or WebP with a transparent background works best.',
      },
    },
    {
      name: 'secondsPerQuestion',
      type: 'number',
      required: true,
      defaultValue: 15,
      min: 5,
      max: 120,
      admin: { description: 'Time allowed for each question.' },
    },
  ],
}
