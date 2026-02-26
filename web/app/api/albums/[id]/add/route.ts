import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/albums/[id]/add
 * Add photos to an album.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: albumId } = await params;
        const { photoIds } = await req.json();

        if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
            return NextResponse.json({ error: "No photoIds provided" }, { status: 400 });
        }

        const supabase = createServiceClient();

        // Insert associations. Using UPSERT to avoid duplicates if already 
        // in album, though we might just want to IGNORE errors on duplicates.
        const inserts = photoIds.map(photoId => ({
            album_id: albumId,
            photo_id: photoId,
        }));

        const { error } = await supabase
            .from("album_photos")
            .upsert(inserts, { onConflict: "album_id,photo_id" });

        if (error) {
            console.error("Add to album error:", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        return NextResponse.json({ ok: true, added: photoIds.length });
    } catch (err) {
        console.error("Add to album error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
