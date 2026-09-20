import { APIError, type CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { adminSignupError, parseAdminEmails } from '../lib/admin-signup'

/**
 * Admins. Players never get an account: they only register a name and chapter.
 *
 * The first admin is created on the /admin screen. To stop a stranger from claiming that
 * screen on a fresh deploy, only emails listed in ADMIN_EMAILS can sign up. In production
 * with no list, sign-up is closed entirely.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  access: {
    create: authenticated,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
  },
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (operation !== 'create') return data
        const error = adminSignupError(
          data?.email,
          parseAdminEmails(process.env.ADMIN_EMAILS),
          process.env.NODE_ENV === 'production',
        )
        if (error) throw new APIError(error, 403)
        return data
      },
    ],
  },
  fields: [],
}
