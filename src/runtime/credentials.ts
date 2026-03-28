import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

import { fileExists } from "../workspace";

interface StoreEnvelope {
  iv: string;
  tag: string;
  data: string;
}

interface StorePayload {
  credentials: Record<string, string>;
}

const MASTER_KEY_BYTES = 32;
const ROOT_DIR_MODE = 0o700;
const SECRET_FILE_MODE = 0o600;

function getStorePaths() {
  const root = path.join(os.homedir(), ".cora");
  return {
    root,
    storePath: path.join(root, "store.enc"),
    saltPath: path.join(root, "salt.bin"),
    masterKeyPath: path.join(root, "master.key"),
  };
}

async function ensureRootDir(): Promise<void> {
  const { root } = getStorePaths();
  await mkdir(root, { recursive: true, mode: ROOT_DIR_MODE });
  await chmod(root, ROOT_DIR_MODE).catch(() => {});
}

async function writeSecretFile(filePath: string, data: Buffer | string): Promise<void> {
  await writeFile(filePath, data, { mode: SECRET_FILE_MODE });
  await chmod(filePath, SECRET_FILE_MODE).catch(() => {});
}

async function getOrCreateMasterKey(): Promise<Buffer> {
  await ensureRootDir();
  const { masterKeyPath } = getStorePaths();

  if (await fileExists(masterKeyPath)) {
    const key = await readFile(masterKeyPath);
    if (key.length !== MASTER_KEY_BYTES) {
      throw new Error("Invalid Cora master key length.");
    }
    await chmod(masterKeyPath, SECRET_FILE_MODE).catch(() => {});
    return key;
  }

  const key = randomBytes(MASTER_KEY_BYTES);
  await writeSecretFile(masterKeyPath, key);
  return key;
}

async function readLegacySalt(): Promise<Buffer | null> {
  const { saltPath } = getStorePaths();
  if (!(await fileExists(saltPath))) {
    return null;
  }

  await chmod(saltPath, SECRET_FILE_MODE).catch(() => {});
  return readFile(saltPath);
}

function deriveLegacyKey(salt: Buffer): Buffer {
  const fingerprint = [
    os.platform(),
    os.arch(),
    os.hostname(),
    os.userInfo().username,
  ].join("|");

  return scryptSync(fingerprint, salt, 32);
}

function encryptPayload(payload: StorePayload, key: Buffer): StoreEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");

  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

function decryptPayload(envelope: StoreEnvelope, key: Buffer): StorePayload {
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const data = Buffer.from(envelope.data, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  const parsed = JSON.parse(decrypted.toString("utf8")) as StorePayload;

  return {
    credentials: parsed.credentials ?? {},
  };
}

async function readStorePayload(): Promise<StorePayload> {
  await ensureRootDir();

  const { storePath } = getStorePaths();
  if (!(await fileExists(storePath))) {
    return { credentials: {} };
  }

  await chmod(storePath, SECRET_FILE_MODE).catch(() => {});
  const raw = await readFile(storePath, "utf8");
  const envelope = JSON.parse(raw) as StoreEnvelope;
  const key = await getOrCreateMasterKey();

  try {
    return decryptPayload(envelope, key);
  } catch (primaryError) {
    // Backward-compatible migration path for stores encrypted with legacy host-derived keys.
    const legacySalt = await readLegacySalt();
    if (!legacySalt) {
      throw primaryError;
    }

    const legacyKey = deriveLegacyKey(legacySalt);
    const payload = decryptPayload(envelope, legacyKey);
    await writeStorePayload(payload);
    return payload;
  }
}

async function writeStorePayload(payload: StorePayload): Promise<void> {
  await ensureRootDir();

  const { storePath } = getStorePaths();
  const key = await getOrCreateMasterKey();
  const envelope = encryptPayload(payload, key);

  await writeSecretFile(storePath, `${JSON.stringify(envelope, null, 2)}\n`);
}

export async function setCredential(key: string, value: string): Promise<void> {
  const payload = await readStorePayload();
  payload.credentials[key] = value;
  await writeStorePayload(payload);
}

export async function removeCredential(key: string): Promise<void> {
  const payload = await readStorePayload();
  delete payload.credentials[key];
  await writeStorePayload(payload);
}

export async function getCredential(key: string): Promise<string | undefined> {
  const payload = await readStorePayload();
  return payload.credentials[key];
}

export async function hasCredential(key: string): Promise<boolean> {
  const value = await getCredential(key);
  return typeof value === "string" && value.length > 0;
}

export async function listCredentialKeys(): Promise<string[]> {
  const payload = await readStorePayload();
  return Object.keys(payload.credentials);
}
