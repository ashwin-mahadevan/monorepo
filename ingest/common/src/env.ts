/**
 * Environment variable validation utilities
 */

/**
 * Retrieves a required environment variable or throws if not set
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

/**
 * Retrieves a required integer environment variable or throws if invalid
 */
export function requireInt(name: string): number {
  const value = requireEnv(name);
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got: ${value}`);
  }
  return parsed;
}
