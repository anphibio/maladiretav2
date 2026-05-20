import { createHash, randomBytes, timingSafeEqual } from "crypto";

const TOKEN_PREFIX = "app";

export function generateApiToken(): { token: string; tokenHash: string; tokenPrefix: string } {
  const raw = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}_${raw}`;

  return {
    token,
    tokenHash: hashApiToken(token),
    tokenPrefix: token.slice(0, 14)
  };
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeTokenEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}
