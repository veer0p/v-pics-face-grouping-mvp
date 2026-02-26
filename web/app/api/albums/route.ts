import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getReadUrl } from "@/lib/b2";

/**
 * GET /api/albums
 * List all albums with photo count and cover image.
 */
export async function GET() {
    try {
        const supabase = createServiceClient();

        // Fetch albums with photo counts and cover info
        // We join albums with album_photos to get counts and first photo as cover
        const { data: albums, error } = await supabase
            .from("albums")
            .select(`
        *,
        photos_count: album_photos(count),
        cover_photo: album_photos(
          photo: photos(id, original_key, thumb_key)
        )
      `)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Albums fetch error:", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        const processedAlbums = await Promise.all(
            (albums || []).map(async (album) => {
                // Find a cover photo. Use the first one associated if exist
                let coverUrl = null;
                const firstPhoto = album.cover_photo?.[0]?.photo;
                if (firstPhoto) {
                    coverUrl = await getReadUrl(firstPhoto.thumb_key || firstPhoto.original_key);
                }

                return {
                    id: album.id,
                    name: album.name,
                    count: album.photos_count?.[0]?.count || 0,
                    coverUrl,
                    createdAt: album.created_at,
                };
            })
        );

        return NextResponse.json({ albums: processedAlbums });
    } catch (err) {
        console.error("Albums error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * POST /api/albums
 * Create a new album.
 */
export async function POST(req: NextRequest) {
    try {
        const { name } = await req.json();
        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from("albums")
            .insert({ name })
            .select()
            .single();

        if (error) {
            console.error("Album create error:", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        return NextResponse.json({ album: data });
    } catch (err) {
        console.error("Album create error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
