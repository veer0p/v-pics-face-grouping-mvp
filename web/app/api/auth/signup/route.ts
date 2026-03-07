import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { createAuthSession, applyAuthCookie, applyLegacyAuthCookie } from "@/lib/auth-api";
import { hashPin, isValidPin, isValidUsername, normalizeUsername } from "@/lib/auth-server";
import { resolveAvatarUrl } from "@/lib/avatar";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const username = normalizeUsername(String(body?.username || ""));
        const fullName = String(body?.fullName || username).trim();
        const pin = String(body?.pin || "");

        if (!isValidUsername(username)) {
            return NextResponse.json(
                { error: "Username must be 3-32 chars (a-z, 0-9, underscore)." },
                { status: 400 },
            );
        }
        if (!fullName) {
            return NextResponse.json({ error: "Full name is required." }, { status: 400 });
        }
        if (!isValidPin(pin)) {
            return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
        }

        const supabase = createServiceClient();
        const pinHash = hashPin(pin);

        const { data: createdUser, error: createError } = await supabase
            .from("users")
            .insert({
                username,
                full_name: fullName,
                pin_hash: pinHash,
                pin: "__legacy__",
            })
            .select("id, full_name, username, avatar_url")
            .single();

        if (createError || !createdUser) {
            const isConflict = createError?.code === "23505";
            return NextResponse.json(
                { error: isConflict ? "Username already exists." : "Failed to create account." },
                { status: isConflict ? 409 : 500 },
            );
        }

        let session: { sessionId: string; token: string; expiresAt: string } | null = null;
        try {
            session = await createAuthSession(supabase, createdUser.id, req);
        } catch (error) {
            console.warn("[AUTH][SIGNUP] session table unavailable, falling back to legacy cookie:", error);
        }
        await supabase
            .from("users")
            .update({ last_login_at: new Date().toISOString() })
            .eq("id", createdUser.id);

        const response = NextResponse.json({
            user: {
                ...createdUser,
                avatar_url: resolveAvatarUrl(createdUser.avatar_url),
            },
        });
        if (session) {
            applyAuthCookie(response, session.sessionId, session.token, session.expiresAt);
        } else {
            applyLegacyAuthCookie(response, createdUser.id);
        }
        return response;
    } catch (error) {
        console.error("[AUTH][SIGNUP] failed:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
