import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { resolveAvatarUrl } from "@/lib/avatar";

export async function GET() {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json({
            user: {
                id: user.id,
                full_name: user.full_name,
                username: user.username || String(user.full_name || "").trim().toLowerCase(),
                avatar_url: resolveAvatarUrl(user.avatar_url),
            },
        });
    } catch (error) {
        console.error("[AUTH][ME] failed:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
