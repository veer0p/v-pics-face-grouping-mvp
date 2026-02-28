import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getReadUrl } from "@/lib/b2";

export async function GET(req: NextRequest) {
    try {
        const supabase = createServiceClient();
        const url = new URL(req.url);
        const limit = Math.min(Number(url.searchParams.get("limit") || 100), 200);
        const offset = Number(url.searchParams.get("offset") || 0);

        // Fetch photos sorted by taken_at primarily, then created_at
        // Using coalesce or multiple sort orders in Supabase
        // We'll sort by taken_at DESC, created_at DESC
        const { data: images, error, count } = await supabase
            .from("photos")
            .select("id, original_key, thumb_key, original_name, mime_type, size_bytes, width, height, thumb_width, thumb_height, is_liked, taken_at, created_at", { count: "exact" })
            .eq("is_deleted", false)
            .order("taken_at", { ascending: false, nullsFirst: true })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error("Supabase fetch error:", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        const photos = await Promise.all(
            (images || []).map(async (img) => ({
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
            })),
        );

        return NextResponse.json({ photos, total: count });
    } catch (err) {
        console.error("Photos fetch error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
