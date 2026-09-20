import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

/**
 * The question bank. Only admins can read or change it through the API; players get
 * their questions from server code that never includes the correct answer.
 */
export const Questions: CollectionConfig = {
  slug: 'questions',
  labels: { singular: 'Question', plural: 'Questions' },
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['number', 'question', 'active', 'answerSource'],
    listSearchableFields: ['question'],
    description:
      'Edit questions and answers any time. Tick exactly one option as correct. Only questions marked "Show in quiz" are asked.',
  },
  defaultSort: 'number',
  access: {
    create: authenticated,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'number',
      type: 'number',
      label: 'Exam number',
      admin: {
        position: 'sidebar',
        description: 'Number in the original exam. Only used for sorting and reference.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      label: 'Show in quiz',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'keepOptionOrder',
      type: 'checkbox',
      label: 'Keep option order',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Players see options in random order. Tick this for "none of these" or ordered values (dates, numbers).',
      },
    },
    {
      name: 'answerSource',
      type: 'select',
      label: 'Where the answer came from',
      defaultValue: 'manual',
      options: [
        { label: 'Exam answer key', value: 'exam-key' },
        { label: "A. Mabini Petitioner's Handbook", value: 'handbook' },
        { label: 'Found online', value: 'web' },
        { label: 'General knowledge (please review)', value: 'knowledge' },
        { label: 'Added by admin', value: 'manual' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'question',
      type: 'textarea',
      required: true,
      admin: { description: 'Use ______ (underscores) for a blank.' },
    },
    {
      name: 'options',
      type: 'array',
      label: 'Answer options',
      minRows: 2,
      maxRows: 6,
      labels: { singular: 'Option', plural: 'Options' },
      admin: { description: 'Tick "Correct answer" on exactly one option.' },
      validate: (value: unknown, { data }: { data?: { active?: boolean } }) => {
        const options = Array.isArray(value) ? (value as { text?: string; isCorrect?: boolean }[]) : []
        if (options.length < 2) return 'Add at least two options.'
        if (options.some((option) => !option?.text?.trim())) return 'Every option needs text.'
        const correct = options.filter((option) => option?.isCorrect).length
        if (correct > 1) return 'Only one option can be the correct answer.'
        if (correct === 0 && data?.active !== false) {
          return 'Tick the correct answer, or untick "Show in quiz" until you know it.'
        }
        return true
      },
      fields: [
        { name: 'text', type: 'text', required: true },
        { name: 'isCorrect', type: 'checkbox', label: 'Correct answer', defaultValue: false },
      ],
    },
    {
      name: 'adminNote',
      type: 'textarea',
      label: 'Admin note',
      admin: { description: 'Sources and remarks. Never shown to players.' },
    },
  ],
}
