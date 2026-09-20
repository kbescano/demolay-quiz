import type { CollectionConfig } from 'payload'

import { authenticated, nobody } from '../access/authenticated'

/**
 * One row per quiz run: which player, which attempt number, and the detail needed to run the
 * quiz and show the missed questions afterwards. Rows are created and updated by server code
 * only; admins can read and delete them.
 */
export const Attempts: CollectionConfig = {
  slug: 'attempts',
  labels: { singular: 'Attempt', plural: 'Attempts' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'chapter', 'attemptNumber', 'status', 'score', 'total', 'percent', 'completedAt'],
    listSearchableFields: ['name', 'chapter'],
    description: 'Every quiz run, with answers. Read-only. Each player\'s scores are also listed on the Players screen.',
  },
  defaultSort: '-createdAt',
  access: {
    create: nobody,
    read: authenticated,
    update: nobody,
    delete: authenticated,
  },
  fields: [
    { name: 'player', type: 'relationship', relationTo: 'players', required: true, admin: { readOnly: true } },
    { name: 'attemptNumber', type: 'number', required: true, label: 'Attempt', admin: { readOnly: true } },
    // Copied from the player when the quiz starts, so this list reads on its own.
    { name: 'name', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'chapter', type: 'text', required: true, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'in-progress',
      options: [
        { label: 'In progress', value: 'in-progress' },
        { label: 'Completed', value: 'completed' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'score', type: 'number', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'total', type: 'number', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'percent', type: 'number', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'completedAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    {
      type: 'collapsible',
      label: 'Internals (do not edit)',
      admin: { initCollapsed: true },
      fields: [
        { name: 'currentIndex', type: 'number', defaultValue: 0, admin: { readOnly: true } },
        { name: 'questionStartedAt', type: 'date', admin: { readOnly: true } },
        { name: 'order', type: 'json', admin: { readOnly: true } },
        { name: 'optionOrders', type: 'json', admin: { readOnly: true } },
        { name: 'answers', type: 'json', admin: { readOnly: true } },
      ],
    },
  ],
}
