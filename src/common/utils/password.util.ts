import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const SALT_ROUNDS = 10;

/**
 * Hashes a plain text password using bcryptjs.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error('Password is required for hashing');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Synchronous hash function for places where async context is tricky.
 */
export function hashPasswordSync(password: string): string {
  if (!password) {
    throw new Error('Password is required for hashing');
  }
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * Verifies an input password against stored hash/plain password.
 * Supports:
 * 1. bcrypt hashes ($2a$, $2b$, $2y$)
 * 2. sha256 prefixed strings (sha256:<hex>)
 * 3. Plain text legacy passwords
 */
export async function comparePassword(
  inputPassword: string,
  storedPassword: string | null | undefined,
): Promise<boolean> {
  if (!storedPassword || !inputPassword) {
    return false;
  }

  // 1. Check if stored password is a bcrypt hash
  if (
    storedPassword.startsWith('$2a$') ||
    storedPassword.startsWith('$2b$') ||
    storedPassword.startsWith('$2y$')
  ) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  // 2. Check if stored password is SHA-256 hashed
  if (storedPassword.startsWith('sha256:')) {
    const hashedInput = `sha256:${crypto.createHash('sha256').update(inputPassword).digest('hex')}`;
    return storedPassword === hashedInput;
  }

  // 3. Fallback: Direct string comparison for legacy plain text passwords
  return storedPassword === inputPassword;
}

/**
 * Gets the default plain-text password from env or fallback.
 */
export function getDefaultPassword(): string {
  return process.env.DEFAULT_PASSWORD || 'password123';
}

/**
 * Gets the default password hashed using bcryptjs.
 */
export async function getDefaultHashedPassword(): Promise<string> {
  return hashPassword(getDefaultPassword());
}

