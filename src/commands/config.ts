import { hasCredential, removeCredential, setCredential } from "../runtime/credentials";
import { promptSecret } from "../runtime/prompt";

export async function runConfigSet(key: string, valueFromFlag?: string): Promise<void> {
  if (!key) {
    throw new Error("Usage: cora config set <key>");
  }

  const value = valueFromFlag ?? (await promptSecret(`Enter value for ${key}: `));

  if (!value) {
    throw new Error("Credential value cannot be empty.");
  }

  await setCredential(key, value);
  console.log(`Stored credential for ${key}.`);
}

export async function runConfigGet(key: string): Promise<void> {
  if (!key) {
    throw new Error("Usage: cora config get <key>");
  }

  const exists = await hasCredential(key);
  console.log(exists ? `${key}: exists` : `${key}: missing`);
}

export async function runConfigUnset(key: string): Promise<void> {
  if (!key) {
    throw new Error("Usage: cora config unset <key>");
  }

  await removeCredential(key);
  console.log(`Removed credential for ${key}.`);
}
