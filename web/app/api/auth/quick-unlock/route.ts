import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { applyAuthCookie, applyLegacyAuthCookie, createAuthSession } from "@/lib/auth-api";
import { findAuthUserByIdentifier } from "@/lib/auth-login";
import { hashPin, isValidPin, normalizeUsername, verifyPin } from "@/lib/auth-server";
import { resolveAvatarUrl } from "@/lib/avatar";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const username = normalizeUsername(String(body?.username || ""));
        const pin = String(body?.pin || "");

        if (!username || !isValidPin(pin)) {
            return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
        }

        const supabase = createServiceClient();
        const user = await findAuthUserByIdentifier(supabase, username);
        if (!user) {
            return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
        }

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

        if (!valid) {
            return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
        }

        let session: { sessionId: string; token: string; expiresAt: string } | null = null;
        try {
            session = await createAuthSession(supabase, user.id, req);
        } catch (error) {
            console.warn("[AUTH][QUICK_UNLOCK] session table unavailable, falling back to legacy cookie:", error);
        }
        await supabase
            .from("users")
            .update({ last_login_at: new Date().toISOString() })
            .eq("id", user.id);

        const response = NextResponse.json({
            user: {
                id: user.id,
                full_name: user.full_name,
                username: user.username || username,
                avatar_url: resolveAvatarUrl(user.avatar_url),
            },
        });
        if (session) {
            applyAuthCookie(response, session.sessionId, session.token, session.expiresAt);
        } else {
            applyLegacyAuthCookie(response, user.id);
        }
        return response;
    } catch (error) {
        console.error("[AUTH][QUICK_UNLOCK] failed:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
