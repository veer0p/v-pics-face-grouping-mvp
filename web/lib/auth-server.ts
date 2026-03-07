import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "v-pics-session";
const PIN_REGEX = /^\d{4}$/;

export function normalizeUsername(value: string): string {
    return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
    return /^[a-z0-9_]{3,32}$/.test(value);
}

export function isValidPin(pin: string): boolean {
    return PIN_REGEX.test(pin);
}

export function hashPin(pin: string): string {
    const salt = randomBytes(16).toString("hex");
    const digest = scryptSync(pin, salt, 32).toString("hex");
    return `scrypt$${salt}$${digest}`;
}

export function verifyPin(pin: string, storedHash: string | null | undefined): boolean {
    if (!storedHash || !storedHash.startsWith("scrypt$")) return false;
    const parts = storedHash.split("$");
    if (parts.length !== 3) return false;
    const [, salt, digestHex] = parts;
    const candidate = scryptSync(pin, salt, 32);
    const expected = Buffer.from(digestHex, "hex");
    if (expected.length !== candidate.length) return false;
    return timingSafeEqual(candidate, expected);
}

export function createSessionToken(): string {
    return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export function makeSessionCookieValue(sessionId: string, token: string): string {
    return `${sessionId}.${token}`;
}

export function parseSessionCookieValue(raw: string | null | undefined): { sessionId: string; token: string } | null {
    if (!raw) return null;
    const [sessionId, token] = raw.split(".");
    if (!sessionId || !token) return null;
    return { sessionId, token };
}
