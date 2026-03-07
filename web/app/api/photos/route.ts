import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedProfile } from "@/lib/supabase-server";
import { getReadUrl } from "@/lib/r2";

const MODERN_PHOTO_SELECT = "id, original_key, thumb_key, original_name, mime_type, size_bytes, width, height, thumb_width, thumb_height, is_liked, taken_at, created_at, content_hash, media_type, duration_ms";
const LEGACY_PHOTO_SELECT = "id, original_key, thumb_key, original_name, mime_type, size_bytes, width, height, thumb_width, thumb_height, is_liked, taken_at, created_at, content_hash";

type PhotoRow = {
    id: string;
    original_key: string;
    thumb_key: string | null;
    original_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    width: number | null;
    height: number | null;
    thumb_width: number | null;
    thumb_height: number | null;
    is_liked: boolean | null;
    taken_at: string | null;
    created_at: string;
    content_hash: string | null;
    media_type?: string | null;
    duration_ms?: number | null;
};

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const supabase = createServiceClient();
        const url = new URL(req.url);
        const limit = Math.min(Number(url.searchParams.get("limit") || 100), 200);
        const offset = Number(url.searchParams.get("offset") || 0);
        const photoHash: string | null = null;

        const runQuery = (columns: string) =>
            supabase
                .from("photos")
                .select(columns, { count: "exact" })
                .eq("is_deleted", false)
                .order("taken_at", { ascending: false, nullsFirst: true })
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1);

        let { data: images, error, count } = await runQuery(MODERN_PHOTO_SELECT);

        if (error?.code === "42703" && /media_type|duration_ms/i.test(String(error.message || ""))) {
            const fallback = await runQuery(LEGACY_PHOTO_SELECT);
            images = fallback.data;
            error = fallback.error;
            count = fallback.count;
        }

        if (error) {
            console.error("[API-Photos] Database query failed:", error);
            throw error;
        }

        const rows: PhotoRow[] = Array.isArray(images) ? (images as unknown as PhotoRow[]) : [];
        const photos = await Promise.all(
            rows.map(async (img) => ({
                id: img.id,
                url: await getReadUrl(img.original_key),
                thumbUrl: img.thumb_key ? await getReadUrl(img.thumb_key) : await getReadUrl(img.original_key),
                filename: img.original_name,
                mimeType: img.mime_type,
                sizeBytes: img.size_bytes,
                width: img.width,
                height: img.height,
                thumbWidth: img.thumb_width,
                thumbHeight: img.thumb_height,
                isLiked: img.is_liked,
                takenAt: img.taken_at,
                createdAt: img.created_at,
                contentHash: img.content_hash,
                mediaType: img.media_type || (String(img.mime_type || "").startsWith("video/") ? "video" : "image"),
                durationMs: img.duration_ms ?? null,
            })),
        );

        return NextResponse.json({ photos, total: count, hash: photoHash });
    } catch (err) {
        console.error("Photos fetch error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
