import { NextResponse } from "next/server";
import { createServiceClient, getActiveSession } from "@/lib/supabase-server";
import { clearAuthCookie } from "@/lib/auth-api";

export async function POST() {
    try {
        const session = await getActiveSession();
        if (session) {
            const supabase = createServiceClient();
            await supabase
                .from("auth_sessions")
                .update({ revoked_at: new Date().toISOString() })
                .eq("id", session.id);
        }

        const response = NextResponse.json({ ok: true });
        clearAuthCookie(response);
        return response;
    } catch (error) {
        console.error("[AUTH][LOGOUT] failed:", error);
        const response = NextResponse.json({ ok: true });
        clearAuthCookie(response);
        return response;
    }
}
