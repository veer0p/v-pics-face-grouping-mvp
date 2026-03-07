import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { applyAuthCookie, applyLegacyAuthCookie, createAuthSession } from "@/lib/auth-api";
import { findAuthUserByIdentifier } from "@/lib/auth-login";
import { hashPin, isValidPin, normalizeUsername, verifyPin } from "@/lib/auth-server";
import { resolveAvatarUrl } from "@/lib/avatar";

async function authenticateWithUsernameAndPin(req: NextRequest, usernameInput: string, pin: string) {
    const username = normalizeUsername(usernameInput);
    if (!username || !isValidPin(pin)) return null;

    const supabase = createServiceClient();
    const user = await findAuthUserByIdentifier(supabase, username);
    if (!user) return null;

    let valid = verifyPin(pin, user.pin_hash);
    if (!valid && user.pin && user.pin === pin) {
        valid = true;
        await supabase
            .from("users")
            .update({
                pin_hash: hashPin(pin),
                pin: "__legacy__",
            })
            .eq("id", user.id);
    }

    if (!valid) return null;

    let session: { sessionId: string; token: string; expiresAt: string } | null = null;
    try {
        session = await createAuthSession(supabase, user.id, req);
    } catch (error) {
        console.warn("[AUTH][LOGIN] session table unavailable, falling back to legacy cookie:", error);
    }
    await supabase
        .from("users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", user.id);

    return {
        user: {
            id: user.id,
            full_name: user.full_name,
            username: user.username || username,
            avatar_url: resolveAvatarUrl(user.avatar_url),
        },
        sessionId: session?.sessionId || null,
        token: session?.token || null,
        expiresAt: session?.expiresAt || null,
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const username = String(body?.username || "");
        const pin = String(body?.pin || "");

        const auth = await authenticateWithUsernameAndPin(req, username, pin);
        if (!auth) {
            return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
        }

        const response = NextResponse.json({ user: auth.user });
        if (auth.sessionId && auth.token && auth.expiresAt) {
            applyAuthCookie(response, auth.sessionId, auth.token, auth.expiresAt);
        } else {
            applyLegacyAuthCookie(response, auth.user.id);
        }
        return response;
    } catch (error) {
        console.error("[AUTH][LOGIN] failed:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
