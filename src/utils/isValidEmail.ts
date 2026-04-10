/** Basic email validation — checks for user@domain.tld structure. */
export function isValidEmail(email: string): boolean {
  const atIndex = email.indexOf('@')
  if (atIndex < 1) return false
  const afterAt = email.slice(atIndex + 1)
  const dotIndex = afterAt.indexOf('.')
  return dotIndex > 0 && dotIndex < afterAt.length - 1
}
