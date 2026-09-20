/** Who may create an admin account. Pure so it can be tested. */

export function parseAdminEmails(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

/** Returns an error message when sign-up must be refused, or null when it is allowed. */
export function adminSignupError(
  email: unknown,
  allowed: readonly string[],
  isProduction: boolean,
): string | null {
  if (allowed.length === 0) {
    return isProduction
      ? 'Admin sign-up is closed. Set ADMIN_EMAILS to the email addresses allowed to be admins.'
      : null // local development: open
  }
  const candidate = String(email ?? '').trim().toLowerCase()
  return allowed.includes(candidate) ? null : 'That email address is not on the admin list.'
}
