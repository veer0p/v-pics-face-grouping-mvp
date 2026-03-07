import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";

export async function GET(req: Request) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return new Response("Unauthorized", { status: 401 });

        const { searchParams } = new URL(req.url);
        const url = searchParams.get("url");

        if (!url) {
            return new Response("Missing URL", { status: 400 });
        }

        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return new Response("Invalid URL", { status: 400 });
        }
        const isAllowedHost =
            parsed.hostname.endsWith(".r2.cloudflarestorage.com") ||
            parsed.hostname.endsWith(".r2.dev");

        // Only allow R2 URLs for security
        if (!isAllowedHost) {
            return new Response("Invalid URL", { status: 400 });
        }

        const range = req.headers.get("range");
        const response = await fetch(url, {
            headers: range ? { range } : undefined,
        });
        if (!response.ok && response.status !== 206) {
            return new Response("Failed to fetch from storage", { status: response.status });
        }

        const headers = new Headers();
        headers.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        headers.set("Access-Control-Allow-Origin", "*");
        const contentLength = response.headers.get("Content-Length");
        const contentRange = response.headers.get("Content-Range");
        if (contentLength) headers.set("Content-Length", contentLength);
        if (contentRange) headers.set("Content-Range", contentRange);
        headers.set("Accept-Ranges", response.headers.get("Accept-Ranges") || "bytes");

        return new NextResponse(response.body, {
            status: response.status,
            headers,
        });
    } catch (error) {
        console.error("Proxy error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

