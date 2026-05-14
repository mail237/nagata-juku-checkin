import { createHmac, timingSafeEqual } from "crypto";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_FALLBACK_SECRET,
} from "./admin-constants";
import { requireEnv } from "./env";

function signingSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || ADMIN_SESSION_FALLBACK_SECRET;
}

export function createAdminSessionToken(): string {
  const pin = requireEnv("ADMIN_PIN");
  return createHmac("sha256", signingSecret()).update(pin).digest("hex");
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const pin = process.env.ADMIN_PIN;
  if (!pin) return false;
  const expected = createHmac("sha256", signingSecret())
    .update(pin)
    .digest("hex");
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export { ADMIN_SESSION_COOKIE };
