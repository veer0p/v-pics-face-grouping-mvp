import type { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
    createSessionToken,
    hashSessionToken,
    makeSessionCookieValue,
    SESSION_COOKIE_NAME,
} from "@/lib/auth-server";

const SESSION_TTL_DAYS = 30;

export function getSessionExpiryDate() {
    return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function createAuthSession(
    supabase: SupabaseClient,
    userId: string,
    req: NextRequest,
): Promise<{ sessionId: string; token: string; expiresAt: string }> {
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = getSessionExpiryDate().toISOString();

    const ipAddress =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        null;

    const { data: session, error } = await supabase
        .from("auth_sessions")
        .insert({
            user_id: userId,
            token_hash: tokenHash,
            expires_at: expiresAt,
            user_agent: req.headers.get("user-agent"),
            ip_address: ipAddress,
        })
        .select("id")
        .single();

    if (error || !session) {
        throw new Error("Failed to create auth session");
    }

    return { sessionId: session.id, token, expiresAt };
}

export function applyAuthCookie(
    response: NextResponse,
    sessionId: string,
    token: string,
    expiresAt: string,
) {
    response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: makeSessionCookieValue(sessionId, token),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(expiresAt),
    });
}

export function applyLegacyAuthCookie(response: NextResponse, userId: string) {
    response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: userId,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: getSessionExpiryDate(),
    });
}

export function clearAuthCookie(response: NextResponse) {
    response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(0),
    });
}
