import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function getEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIAL_ENCRYPTION_SECRET ?? process.env.SESSION_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error("Configure CREDENTIAL_ENCRYPTION_SECRET ou SESSION_SECRET com pelo menos 16 caracteres.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64url"),
    authTag: authTag.toString("base64url"),
    encrypted: encrypted.toString("base64url")
  });
}

export function decryptSecret(payload: string): string {
  const parsed = JSON.parse(payload) as {
    iv: string;
    authTag: string;
    encrypted: string;
  };
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(parsed.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(parsed.authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(parsed.encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
