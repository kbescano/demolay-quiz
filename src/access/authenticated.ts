import type { Access } from 'payload'

/** Only a logged-in admin (every user of this app is an admin). */
export const authenticated: Access = ({ req: { user } }) => Boolean(user)

/** Nobody through the REST/GraphQL API. Server code uses the Local API, which bypasses access control. */
export const nobody: Access = () => false
