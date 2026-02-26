import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/upload/complete
 * Records a successful upload in the database with client-extracted metadata.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log(`[UPLOAD] Completing upload for: ${body.original_name} (${body.size_bytes} bytes). Hash: ${body.content_hash?.substring(0, 8)}...`);
        const {
            id,
            original_key,
            thumb_key,
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

        const supabase = createServiceClient();

        const { data, error } = await supabase
            .from("photos")
            .insert({
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
                orientation: metadata?.orientation,
                exif_raw: metadata?.exif_raw,
            })
            .select()
            .single();

        if (error) {
            console.error("DB Insert Error:", error);
            // Handle duplicate hash error (Postgres error code 23505)
            if (error.code === "23505") {
                return NextResponse.json({ error: "Duplicate photo detected (content hash already exists)." }, { status: 409 });
            }
            return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
        }

        return NextResponse.json({ photo: data });
    } catch (err) {
        console.error("Completion error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
