import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { getReadUrl } from "@/lib/b2";

export async function GET(req: Request) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return new Response("Unauthorized", { status: 401 });

        const { searchParams } = new URL(req.url);
        const url = searchParams.get("url");

        if (!url) {
            return new Response("Missing URL", { status: 400 });
        }

        // Only allow B2 URLs for security
        if (!url.includes("backblazeb2.com")) {
            return new Response("Invalid URL", { status: 400 });
        }

        const response = await fetch(url);
        if (!response.ok) {
            return new Response("Failed to fetch from storage", { status: response.status });
        }

        const blob = await response.blob();
        const headers = new Headers();
        headers.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        headers.set("Access-Control-Allow-Origin", "*");

        return new NextResponse(blob, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error("Proxy error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
