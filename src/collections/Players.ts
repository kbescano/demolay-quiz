import type { CollectionConfig } from 'payload'

import { authenticated, nobody } from '../access/authenticated'

/**
 * One record per Google account that has signed in. Created by server code at first login.
 * The player enters name and chapter once; after that the quiz never changes them (an admin can).
 * Every finished quiz adds one row to `scores`, starting from attempt 1.
 */
export const Players: CollectionConfig = {
  slug: 'players',
  labels: { singular: 'Player', plural: 'Players' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'chapter', 'email', 'createdAt'],
    listSearchableFields: ['name', 'chapter', 'email'],
    description:
      'People who signed in with Google. Fix a misspelt name or chapter here. Scores are added automatically.',
  },
  defaultSort: 'name',
  access: {
    create: nobody,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: 'name', type: 'text', label: 'Name', maxLength: 80 },
    { name: 'chapter', type: 'text', label: 'Chapter', maxLength: 120 },
    {
      name: 'scores',
      type: 'array',
      label: 'Scores (by attempt)',
      admin: { readOnly: true, description: 'One row per finished quiz, oldest first.' },
      fields: [
        { name: 'attemptNumber', type: 'number', required: true, label: 'Attempt' },
        { name: 'score', type: 'number', required: true },
        { name: 'total', type: 'number', required: true },
        { name: 'percent', type: 'number', required: true },
        { name: 'completedAt', type: 'date', required: true },
      ],
    },
    {
      type: 'collapsible',
      label: 'Google account (do not edit)',
      admin: { initCollapsed: true },
      fields: [
        { name: 'email', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
        {
          name: 'googleSub',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          label: 'Google account ID',
          admin: { readOnly: true },
        },
        { name: 'googleName', type: 'text', label: 'Name on Google account', admin: { readOnly: true } },
      ],
    },
  ],
}
