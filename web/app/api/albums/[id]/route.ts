import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getReadUrl } from "@/lib/r2";

/**
 * GET /api/albums/[id]
 * Fetch album details and photos.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = createServiceClient();

        // 1. Fetch album details
        const { data: album, error: albumError } = await supabase
            .from("albums")
            .select("*")
            .eq("id", id)
            .single();

        if (albumError || !album) {
            return NextResponse.json({ error: "Album not found" }, { status: 404 });
        }

        // 2. Fetch photos in this album
        const { data: photosData, error: photosError } = await supabase
            .from("album_photos")
            .select(`
        photo: photos(id, original_key, thumb_key, original_name, width, height, is_liked, created_at)
      `)
            .eq("album_id", id)
            .order("added_at", { ascending: false });

        if (photosError) {
            console.error("Album photos fetch error:", photosError);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        const photos = await Promise.all(
            (photosData || []).map(async (item: any) => {
                const p = item.photo;
                return {
                    id: p.id,
                    url: await getReadUrl(p.original_key),
                    thumbUrl: p.thumb_key ? await getReadUrl(p.thumb_key) : await getReadUrl(p.original_key),
                    filename: p.original_name,
                    width: p.width,
                    height: p.height,
                    isLiked: p.is_liked,
                    createdAt: p.created_at,
                };
            })
        );

        return NextResponse.json({ album, photos });
    } catch (err) {
        console.error("Album detail error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

/**
 * DELETE /api/albums/[id]
 * Delete an album.
 */
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = createServiceClient();

        const { error } = await supabase
            .from("albums")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Album delete error:", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Album delete error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

/**
 * PATCH /api/albums/[id]
 * Update album (name, etc).
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { name } = await req.json();
        const supabase = createServiceClient();

        const { data, error } = await supabase
            .from("albums")
            .update({ name })
            .eq("id", id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        return NextResponse.json({ album: data });
    } catch (err) {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

