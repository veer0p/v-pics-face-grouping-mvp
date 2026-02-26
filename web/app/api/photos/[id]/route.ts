import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getReadUrl } from "@/lib/b2";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const supabase = createServiceClient();

        const { data: photo, error } = await supabase
            .from("photos")
            .select("*")
            .eq("id", id)
            .eq("is_deleted", false)
            .single();

        if (error || !photo) {
            return NextResponse.json({ error: "Photo not found" }, { status: 404 });
        }

        const url = await getReadUrl(photo.original_key, 7200);
        const thumbUrl = photo.thumb_key ? await getReadUrl(photo.thumb_key) : url;

        return NextResponse.json({
            photo: {
                id: photo.id,
                url,
                thumbUrl,
                filename: photo.original_name,
                mimeType: photo.mime_type,
                sizeBytes: photo.size_bytes,
                width: photo.width,
                height: photo.height,
                isLiked: photo.is_liked,
                blurhash: photo.blurhash,
                takenAt: photo.taken_at,
                cameraMake: photo.camera_make,
                cameraModel: photo.camera_model,
                lensModel: photo.lens_model,
                focalLength: photo.focal_length,
                aperture: photo.aperture,
                iso: photo.iso,
                shutterSpeed: photo.shutter_speed,
                gpsLat: photo.gps_lat,
                gpsLng: photo.gps_lng,
                orientation: photo.orientation,
                exifRaw: photo.exif_raw,
                createdAt: photo.created_at,
            },
        });
    } catch {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
