import { getRedisClient } from "@/lib/redis/client";
import { decryptSecret, encryptSecret } from "@/lib/security/credential-encryption";

const CREDENTIAL_TTL_SECONDS = 60 * 60 * 8;
const AUTO_BOUNCE_CHECKS_KEY_PREFIX = "zimbra:campaign-bounce-checks:";

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
  return JSON.stringify({
    email: input.email,
    encryptedPassword: encryptSecret(input.password)
  });
}

function decryptCredential(payload: string) {
  const parsed = JSON.parse(payload) as {
    email: string;
    encryptedPassword?: string;
    iv?: string;
    authTag?: string;
    encrypted?: string;
  };
  const password = parsed.encryptedPassword
    ? decryptSecret(parsed.encryptedPassword)
    : decryptSecret(
        JSON.stringify({
          iv: parsed.iv,
          authTag: parsed.authTag,
          encrypted: parsed.encrypted
        })
      );

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
