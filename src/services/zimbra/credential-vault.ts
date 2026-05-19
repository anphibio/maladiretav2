import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getRedisClient } from "@/lib/redis/client";

const CREDENTIAL_TTL_SECONDS = 60 * 60 * 8;
const AUTO_BOUNCE_CHECKS_KEY_PREFIX = "zimbra:campaign-bounce-checks:";

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET precisa ter pelo menos 16 caracteres para proteger credenciais temporárias.");
  }

  return createHash("sha256").update(secret).digest();
}

function getCredentialKey(campaignId: string): string {
  return `zimbra:campaign-credential:${campaignId}`;
}

function getUserCredentialKey(email: string): string {
  return `zimbra:user-credential:${email.toLowerCase()}`;
}

function getBounceChecksKey(campaignId: string): string {
  return `${AUTO_BOUNCE_CHECKS_KEY_PREFIX}${campaignId}`;
}

function encryptCredential(input: { email: string; password: string }): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(input.password, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    email: input.email,
    iv: iv.toString("base64url"),
    authTag: authTag.toString("base64url"),
    encrypted: encrypted.toString("base64url")
  });
}

function decryptCredential(payload: string) {
  const parsed = JSON.parse(payload) as {
    email: string;
    iv: string;
    authTag: string;
    encrypted: string;
  };
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(parsed.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(parsed.authTag, "base64url"));
  const password = Buffer.concat([
    decipher.update(Buffer.from(parsed.encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");

  return {
    email: parsed.email,
    password
  };
}

export async function storeTemporaryZimbraCredential(input: {
  campaignId: string;
  email: string;
  password: string;
}) {
  await getRedisClient().set(getCredentialKey(input.campaignId), encryptCredential(input), "EX", CREDENTIAL_TTL_SECONDS);
}

export async function getTemporaryZimbraCredential(campaignId: string) {
  const payload = await getRedisClient().get(getCredentialKey(campaignId));

  if (!payload) {
    return null;
  }

  return decryptCredential(payload);
}

export async function deleteTemporaryZimbraCredential(campaignId: string) {
  await getRedisClient().del(getCredentialKey(campaignId));
}

export async function storeTemporaryLoginCredential(input: { email: string; password: string }) {
  await getRedisClient().set(getUserCredentialKey(input.email), encryptCredential(input), "EX", CREDENTIAL_TTL_SECONDS);
}

export async function getTemporaryLoginCredential(email: string) {
  const payload = await getRedisClient().get(getUserCredentialKey(email));

  if (!payload) {
    return null;
  }

  return decryptCredential(payload);
}

export async function deleteTemporaryLoginCredential(email: string) {
  await getRedisClient().del(getUserCredentialKey(email));
}

export async function hasAutoBounceChecksScheduled(campaignId: string) {
  const value = await getRedisClient().get(getBounceChecksKey(campaignId));
  return value === "scheduled";
}

export async function reserveAutoBounceChecksSchedule(campaignId: string) {
  const result = await getRedisClient().set(getBounceChecksKey(campaignId), "scheduled", "EX", CREDENTIAL_TTL_SECONDS, "NX");
  return result === "OK";
}

export async function deleteAutoBounceChecksScheduled(campaignId: string) {
  await getRedisClient().del(getBounceChecksKey(campaignId));
}
