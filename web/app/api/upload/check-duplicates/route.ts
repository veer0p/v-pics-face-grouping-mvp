import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedProfile } from "@/lib/supabase-server";

const MAX_HASHES_PER_REQUEST = 500;

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const rawHashes: unknown[] = Array.isArray(body?.hashes) ? body.hashes : [];

        if (rawHashes.length === 0) {
            return NextResponse.json({ existingHashes: [] });
        }

        if (rawHashes.length > MAX_HASHES_PER_REQUEST) {
            return NextResponse.json(
                { error: `Maximum ${MAX_HASHES_PER_REQUEST} hashes allowed per request.` },
                { status: 400 },
            );
        }

        const hashes = Array.from(
            new Set(
                rawHashes
                    .filter((hash: unknown): hash is string => typeof hash === "string")
                    .map((hash: string) => hash.trim())
                    .filter(Boolean),
            ),
        );

        if (hashes.length === 0) {
            return NextResponse.json({ existingHashes: [] });
        }

        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from("photos")
            .select("content_hash")
            .eq("is_deleted", false)
            .in("content_hash", hashes);

        if (error) {
            console.error("[UPLOAD][DUP-CHECK] query failed:", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        const existingHashes = Array.from(
            new Set(
                (data || [])
                    .map((row) => row.content_hash)
                    .filter((hash): hash is string => typeof hash === "string" && hash.length > 0),
            ),
        );

        return NextResponse.json({ existingHashes });
    } catch (err) {
        console.error("[UPLOAD][DUP-CHECK] unexpected error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
