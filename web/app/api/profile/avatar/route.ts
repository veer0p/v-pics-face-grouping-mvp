import { NextResponse } from "next/server";
import { getReadUrl } from "@/lib/r2";
import { isAvatarObjectKey } from "@/lib/avatar";
import { getAuthenticatedProfile } from "@/lib/supabase-server";

export async function GET(req: Request) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return new Response("Unauthorized", { status: 401 });

        const { searchParams } = new URL(req.url);
        const key = searchParams.get("key");
        if (!key || !isAvatarObjectKey(key)) {
            return new Response("Invalid avatar key", { status: 400 });
        }

        const signedUrl = await getReadUrl(key, 300);
        const response = await fetch(signedUrl);
        if (!response.ok) {
            return new Response("Avatar not found", { status: response.status });
        }

        const blob = await response.blob();
        const headers = new Headers();
        headers.set("Content-Type", response.headers.get("Content-Type") || "image/webp");
        headers.set("Cache-Control", "private, max-age=300");

        return new NextResponse(blob, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error("[PROFILE][AVATAR][GET] failed:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

