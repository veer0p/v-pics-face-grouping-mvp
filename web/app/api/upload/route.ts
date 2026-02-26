import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase-server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { encode } from "blurhash";

function mustEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env: ${name}`);
    return v;
}

let _s3: S3Client | null = null;
function getS3(): S3Client {
    if (!_s3) {
        _s3 = new S3Client({
            endpoint: mustEnv("B2_ENDPOINT"),
            region: process.env.B2_REGION || "eu-central-003",
            credentials: {
                accessKeyId: mustEnv("B2_KEY_ID"),
                secretAccessKey: mustEnv("B2_APP_KEY"),
            },
            forcePathStyle: true,
        });
    }
    return _s3;
}

const ALLOWED_TYPES = new Set([
    "image/jpeg", "image/png", "image/webp", "image/heic",
    "image/heif", "image/avif", "image/gif", "image/tiff",
]);

const THUMB_MAX = 400;

// ── Blurhash ───────────────────────────────────────────
async function generateBlurhash(buffer: Buffer): Promise<string | null> {
    try {
        const BH_SIZE = 32;
        const { data, info } = await sharp(buffer)
            .resize(BH_SIZE, BH_SIZE, { fit: "cover" })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
    } catch {
        return null;
    }
}

// ── EXIF extraction — all fields + raw dump ────────────
async function extractAllExif(buffer: Buffer): Promise<{
    takenAt?: string;
    cameraMake?: string;
    cameraModel?: string;
    lensModel?: string;
    focalLength?: number;
    aperture?: number;
    iso?: number;
    shutterSpeed?: string;
    gpsLat?: number;
    gpsLng?: number;
    orientation?: number;
    exifRaw?: Record<string, unknown>;
}> {
    try {
        const exifr = await import("exifr");
        const raw = await exifr.default.parse(buffer, true);
        if (!raw) return {};

        // Compute shutter speed string from ExposureTime
        let shutterSpeed: string | undefined;
        if (raw.ExposureTime) {
            const et = raw.ExposureTime;
            shutterSpeed = et < 1 ? `1/${Math.round(1 / et)}` : `${et}s`;
        }

        // Clean raw — remove Buffer/ArrayBuffer values for JSON storage
        const cleanRaw: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(raw)) {
            if (value instanceof Uint8Array || value instanceof ArrayBuffer || Buffer.isBuffer(value)) continue;
            if (typeof value === "function") continue;
            cleanRaw[key] = value;
        }

        return {
            takenAt: raw.DateTimeOriginal?.toISOString?.() || raw.CreateDate?.toISOString?.() || undefined,
            cameraMake: raw.Make || undefined,
            cameraModel: raw.Model || undefined,
            lensModel: raw.LensModel || raw.LensMake || undefined,
            focalLength: raw.FocalLength || undefined,
            aperture: raw.FNumber || raw.ApertureValue || undefined,
            iso: raw.ISO || undefined,
            shutterSpeed,
            gpsLat: raw.latitude ?? undefined,
            gpsLng: raw.longitude ?? undefined,
            orientation: raw.Orientation || undefined,
            exifRaw: cleanRaw,
        };
    } catch {
        return {};
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const files = formData.getAll("files") as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: "No files provided" }, { status: 400 });
        }

        // Validate MIME types
        for (const file of files) {
            if (!ALLOWED_TYPES.has(file.type)) {
                return NextResponse.json(
                    { error: `Unsupported type: ${file.type}. Allowed: JPEG, PNG, WebP, HEIC, AVIF, GIF, TIFF` },
                    { status: 400 },
                );
            }
        }

        const supabase = createServiceClient();
        const s3 = getS3();
        const bucket = mustEnv("B2_BUCKET_NAME");
        const uploaded: { id: string; key: string }[] = [];

        for (const file of files) {
            const id = randomUUID();
            const ext = file.name.replace(/.*\./, "").toLowerCase() || "jpg";
            const safeFilename = file.name.replace(/[^\w.\-()[\] ]/g, "_");
            const originalKey = `photos/${id}.${ext}`;
            const thumbKey = `thumbs/${id}.webp`;

            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Image dimensions + thumbnail
            let width: number | undefined;
            let height: number | undefined;
            let thumbWidth: number | undefined;
            let thumbHeight: number | undefined;
            let thumbBuffer: Buffer | undefined;

            try {
                const image = sharp(buffer);
                const metadata = await image.metadata();
                width = metadata.width;
                height = metadata.height;

                const thumb = await image
                    .resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toBuffer({ resolveWithObject: true });
                thumbBuffer = thumb.data;
                thumbWidth = thumb.info.width;
                thumbHeight = thumb.info.height;
            } catch (err) {
                console.warn("Thumbnail failed:", err);
            }

            // Blurhash + EXIF in parallel
            const [blurhash, exif] = await Promise.all([
                generateBlurhash(buffer),
                extractAllExif(buffer),
            ]);

            // Upload original to B2
            await s3.send(new PutObjectCommand({
                Bucket: bucket, Key: originalKey, Body: buffer, ContentType: file.type,
                CacheControl: "public, max-age=31536000, immutable",
            }));

            // Upload thumbnail
            if (thumbBuffer) {
                await s3.send(new PutObjectCommand({
                    Bucket: bucket, Key: thumbKey, Body: thumbBuffer, ContentType: "image/webp",
                    CacheControl: "public, max-age=31536000, immutable",
                }));
            }

            // Insert into DB with all metadata
            const { data, error } = await supabase
                .from("photos")
                .insert({
                    original_key: originalKey,
                    thumb_key: thumbBuffer ? thumbKey : null,
                    original_name: safeFilename,
                    mime_type: file.type,
                    size_bytes: file.size,
                    width, height,
                    thumb_width: thumbWidth,
                    thumb_height: thumbHeight,
                    blurhash,
                    taken_at: exif.takenAt || null,
                    camera_make: exif.cameraMake || null,
                    camera_model: exif.cameraModel || null,
                    lens_model: exif.lensModel || null,
                    focal_length: exif.focalLength || null,
                    aperture: exif.aperture || null,
                    iso: exif.iso || null,
                    shutter_speed: exif.shutterSpeed || null,
                    gps_lat: exif.gpsLat || null,
                    gps_lng: exif.gpsLng || null,
                    orientation: exif.orientation || null,
                    exif_raw: exif.exifRaw || null,
                })
                .select("id")
                .single();

            if (error) { console.error("DB insert error:", error); continue; }
            uploaded.push({ id: data.id, key: originalKey });
        }

        return NextResponse.json({ uploaded, count: uploaded.length });
    } catch (err) {
        console.error("Upload error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Upload failed" },
            { status: 500 },
        );
    }
}

export const maxDuration = 60;
