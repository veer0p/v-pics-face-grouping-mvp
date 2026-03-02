import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedProfile } from "@/lib/supabase-server";

const MAX_AVATAR_LENGTH = 1_500_000; // ~1.5MB text payload

export async function PATCH(req: NextRequest) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        const updates: Record<string, string | null> = {};

        if (typeof body.fullName === "string") {
            const fullName = body.fullName.trim();
            if (!fullName) {
                return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
            }
            updates.full_name = fullName;
        }

        if (body.avatarUrl !== undefined) {
            if (body.avatarUrl !== null && typeof body.avatarUrl !== "string") {
                return NextResponse.json({ error: "Invalid avatarUrl" }, { status: 400 });
            }

            if (typeof body.avatarUrl === "string" && body.avatarUrl.length > MAX_AVATAR_LENGTH) {
                return NextResponse.json({ error: "Avatar image is too large" }, { status: 400 });
            }

            updates.avatar_url = body.avatarUrl || null;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from("users")
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq("id", user.id)
            .select("id, full_name, avatar_url")
            .single();

        if (error || !data) {
            return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
        }

        return NextResponse.json({ user: data });
    } catch (err) {
        console.error("[PROFILE] update failed:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
