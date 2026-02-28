import { NextRequest, NextResponse } from "next/server";
import { getUploadUrl } from "@/lib/b2";
import { v4 as uuidv4 } from "uuid";

/**
 * GET /api/upload/presign?filename=foo.jpg&type=image/jpeg
 * Returns a presigned URL for direct client-to-B2 upload.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const filename = searchParams.get("filename") || "unnamed";
        const contentType = searchParams.get("type") || "application/octet-stream";

        console.log(`[UPLOAD] Requesting Presign URL: ${filename} (${contentType})`);

        // Generate unique keys for original and thumbnail
        const fileId = uuidv4();
        const ext = filename.split(".").pop() || "jpg";
        const originalKey = `photos/${fileId}.${ext}`;
        const thumbKey = `thumbs/${fileId}.webp`;

        const uploadUrl = await getUploadUrl(originalKey, contentType, 3600); // 1 hour for large files
        const thumbUploadUrl = await getUploadUrl(thumbKey, "image/webp", 3600);

        // ── Detailed debug logging ──
        console.log(`[UPLOAD] Presign Created for ${filename}`);
        console.log(`[UPLOAD]   Orig Key: ${originalKey}`);
        console.log(`[UPLOAD]   Thumb Key: ${thumbKey}`);

        return NextResponse.json({
            fileId,
            originalKey,
            thumbKey,
            uploadUrl,
            thumbUploadUrl,
        });
    } catch (err) {
        console.error("Presign error:", err);
        return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
    }
}
