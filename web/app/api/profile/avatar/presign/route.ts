import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getUploadUrl } from "@/lib/r2";
import { getAuthenticatedProfile } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json().catch(() => ({}));
        const contentType = String(body?.contentType || "image/webp");
        if (!contentType.startsWith("image/")) {
            return NextResponse.json({ error: "Avatar must be an image." }, { status: 400 });
        }

        const avatarKey = `avatars/${user.id}/${Date.now()}_${uuidv4()}.webp`;
        const uploadUrl = await getUploadUrl(avatarKey, "image/webp", 900);

        return NextResponse.json({
            avatarKey,
            uploadUrl,
            contentType: "image/webp",
        });
    } catch (error) {
        console.error("[PROFILE][AVATAR][PRESIGN] failed:", error);
        const message = error instanceof Error ? error.message : "Failed to generate avatar upload URL.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
