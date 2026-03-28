import { getCredential } from "./credentials";

const EXACT_ENV_PATTERN = /^\$\{([A-Z0-9_]+)\}$/;

export interface CredentialResolverContext {
  projectEnv: Record<string, string>;
}

export async function resolveCredentialValue(
  value: string,
  context: CredentialResolverContext,
): Promise<string> {
  const match = value.match(EXACT_ENV_PATTERN);
  if (!match) {
    return value;
  }

  const key = match[1];
  const shellValue = process.env[key];
  if (shellValue) {
    return shellValue;
  }

  const envValue = context.projectEnv[key];
  if (envValue) {
    return envValue;
  }

  const stored = await getCredential(key);
  if (stored) {
    return stored;
  }

  throw new Error(`Missing credential: ${key}. Set it in your shell, .env, or cora config set ${key}`);
}

export async function resolveSourceCredentials<T extends Record<string, unknown>>(
  source: T,
  context: CredentialResolverContext,
): Promise<T> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") {
      resolved[key] = await resolveCredentialValue(value, context);
      continue;
    }

    resolved[key] = value;
  }

  return resolved as T;
}

export function extractCredentialKeysFromSource(source: Record<string, unknown>): string[] {
  const keys: string[] = [];

  for (const value of Object.values(source)) {
    if (typeof value !== "string") {
      continue;
    }

    const match = value.match(EXACT_ENV_PATTERN);
    if (match) {
      keys.push(match[1]);
    }
  }

  return keys;
}
