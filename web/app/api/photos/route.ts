import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedProfile } from "@/lib/supabase-server";
import { getReadUrl } from "@/lib/b2";

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const supabase = createServiceClient();
        const url = new URL(req.url);
        const limit = Math.min(Number(url.searchParams.get("limit") || 100), 200);
        const offset = Number(url.searchParams.get("offset") || 0);
        const clientHash = url.searchParams.get("hash");

        // Smart Caching: Use the server-side photo_hash from the user record
        // This avoids recalculating hashes on every request.
        const photoHash = (user as any).photo_hash;

        if (clientHash && clientHash === photoHash) {
            console.log(`✅ Cached (Hash matched: ${photoHash.slice(0, 8)}...)`);
            return NextResponse.json({ match: true, hash: photoHash });
        }

        console.log(`❌ B2 (Full fetch triggered)`);

        const { data: images, error, count } = await supabase
            .from("photos")
            .select("id, original_key, thumb_key, original_name, mime_type, size_bytes, width, height, thumb_width, thumb_height, is_liked, taken_at, created_at, content_hash", { count: "exact" })
            .eq("user_id", user.id)
            .eq("is_deleted", false)
            .order("taken_at", { ascending: false, nullsFirst: true })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error("[API-Error] Database query failed:", error);
            throw error;
        }

        const photos = await Promise.all(
            ((images as any[]) || []).map(async (img) => ({
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
            })),
        );

        console.info(`[API-Success] Returned ${photos.length} photos with presigned B2 URLs.`);
        return NextResponse.json({ photos, total: count, hash: photoHash });
    } catch (err) {
        console.error("Photos fetch error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
