/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password (minimum 6 characters)
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

/**
 * Validate required field
 */
export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}

