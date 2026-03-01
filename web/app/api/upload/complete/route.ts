import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedProfile } from "@/lib/supabase-server";
import { deleteObject } from "@/lib/b2";

/**
 * POST /api/upload/complete
 * Records a successful upload in the database with client-extracted metadata.
 * Ensures atomicity by cleaning up B2 objects if DB insertion fails.
 */
export async function POST(req: NextRequest) {
    let original_key: string | undefined;
    let thumb_key: string | undefined;

    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const supabase = createServiceClient();

        const body = await req.json();
        original_key = body.original_key;
        thumb_key = body.thumb_key;

        console.log(`[UPLOAD] Completing upload for: ${body.original_name} (${body.size_bytes} bytes). Hash: ${body.content_hash?.substring(0, 8)}...`);

        const {
            id,
            original_name,
            mime_type,
            size_bytes,
            width,
            height,
            blurhash,
            taken_at,
            content_hash,
            metadata, // Detailed EXIF from client
        } = body;

        if (!original_key || !original_name) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("photos")
            .insert({
                user_id: user.id,
                id: id || undefined,
                original_key,
                original_name,
                thumb_key,
                mime_type: mime_type || "image/jpeg",
                size_bytes: size_bytes || 0,
                width,
                height,
                blurhash,
                taken_at,
                content_hash,
                camera_make: metadata?.camera_make,
                camera_model: metadata?.camera_model,
                lens_model: metadata?.lens_model,
                focal_length: metadata?.focal_length,
                aperture: metadata?.aperture,
                iso: metadata?.iso,
                shutter_speed: metadata?.shutter_speed,
                gps_lat: metadata?.gps_lat,
                gps_lng: metadata?.gps_lng,
                orientation: typeof metadata?.orientation === 'number' ? metadata.orientation : null,
                exif_raw: metadata?.exif_raw,
            })
            .select()
            .single();

        if (error) {
            console.error("DB Insert Error:", error);

            // Cleanup B2 objects on failure
            if (original_key || thumb_key) {
                console.log(`[UPLOAD-ROLLBACK] Cleaning up B2 for ${original_name}...`);
                const deletions: Promise<void>[] = [];
                if (original_key) deletions.push(deleteObject(original_key));
                if (thumb_key) deletions.push(deleteObject(thumb_key));
                await Promise.allSettled(deletions);
            }

            // Handle duplicate hash error (Postgres error code 23505)
            if (error.code === "23505") {
                return NextResponse.json({ error: "Duplicate photo detected (content hash already exists)." }, { status: 409 });
            }
            return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
        }

        return NextResponse.json({ photo: data });
    } catch (err) {
        console.error("Completion error:", err);

        // Attempt emergency cleanup if we have keys
        if (original_key || thumb_key) {
            const deletions: Promise<void>[] = [];
            if (original_key) deletions.push(deleteObject(original_key));
            if (thumb_key) deletions.push(deleteObject(thumb_key));
            await Promise.allSettled(deletions);
        }

        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
