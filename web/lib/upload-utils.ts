import exifr from 'exifr';

export type FileMetadata = {
    camera_make?: string;
    camera_model?: string;
    lens_model?: string;
    focal_length?: number;
    aperture?: number;
    iso?: number;
    shutter_speed?: string;
    gps_lat?: number;
    gps_lng?: number;
    orientation?: number;
    exif_raw?: any;
    content_hash?: string;
};

/**
 * Calculate a unique fingerprint of a file for de-duplication.
 * For large files (>50MB), we use a "Quick Fingerprint" (Size + First 1MB + Last 1MB) 
 * to prevent browser memory exhaustion and crashes.
 */
export async function calculateHash(file: File): Promise<string> {
    const SIZE_LIMIT = 50 * 1024 * 1024; // 50MB
    const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB

    if (file.size <= SIZE_LIMIT) {
        // Full SHA-256 for small files
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } else {
        // Quick Fingerprint for large files: [Size]-[FirstMBHash]-[LastMBHash]
        const firstChunk = file.slice(0, CHUNK_SIZE);
        const lastChunk = file.slice(file.size - CHUNK_SIZE);

        const [firstBuffer, lastBuffer] = await Promise.all([
            firstChunk.arrayBuffer(),
            lastChunk.arrayBuffer()
        ]);

        const [firstHash, lastHash] = await Promise.all([
            crypto.subtle.digest("SHA-256", firstBuffer),
            crypto.subtle.digest("SHA-256", lastBuffer)
        ]);

        const toHex = (buf: ArrayBuffer) =>
            Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");

        return `q_${file.size}_${toHex(firstHash).substring(0, 16)}_${toHex(lastHash).substring(0, 16)}`;
    }
}

/**
 * Extract comprehensive EXIF data from a file in the browser.
 */
export async function extractBrowserExif(file: File): Promise<{
    metadata: FileMetadata;
    takenAt: string | null;
    width?: number;
    height?: number;
}> {
    try {
        const raw = await exifr.parse(file, {
            translateKeys: true,
        });

        if (!raw) return { metadata: {}, takenAt: null };

        // Common EXIF date fields
        const takenAt = raw.DateTimeOriginal || raw.CreateDate || raw.ModifyDate || null;
        const takenAtIso = takenAt instanceof Date ? takenAt.toISOString() : null;

        const metadata: FileMetadata = {
            camera_make: raw.Make,
            camera_model: raw.Model,
            lens_model: raw.LensModel,
            focal_length: raw.FocalLength,
            aperture: raw.FNumber,
            iso: raw.ISO,
            shutter_speed: raw.ExposureTime ? `1/${Math.round(1 / raw.ExposureTime)}` : undefined,
            gps_lat: raw.latitude,
            gps_lng: raw.longitude,
            orientation: raw.Orientation,
            exif_raw: raw,
        };

        return {
            metadata,
            takenAt: takenAtIso,
            width: raw.ExifImageWidth,
            height: raw.ExifImageHeight,
        };
    } catch (err) {
        console.error("EXIF parsing error:", err);
        return { metadata: {}, takenAt: null };
    }
}

/**
 * Generate a thumbnail for an image file using HTML5 Canvas.
 * Resizes to THUMB_MAX while maintaining aspect ratio.
 */
export async function generateThumbnail(file: File, maxDim = 400): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let { width, height } = img;

                if (width > height) {
                    if (width > maxDim) {
                        height *= maxDim / width;
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return reject(new Error("Failed to get canvas context"));

                ctx.drawImage(img, 0, 0, width, height);

                // Try to export as webp, fallback to jpeg
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Canvas toBlob failed"));
                }, "image/webp", 0.8);
            };
            img.onerror = () => reject(new Error("Failed to load image for thumbnail"));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read file for thumbnail"));
        reader.readAsDataURL(file);
    });
}

/**
 * Upload a file directly to B2 using a presigned URL with progress tracking.
 */
export async function uploadToB2(
    file: File,
    uploadUrl: string,
    onProgress: (percent: number) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                console.log(`[B2-UPLOAD]   Progress: ${pct}% (${(e.loaded / 1024 / 1024).toFixed(2)}/${(e.total / 1024 / 1024).toFixed(2)} MB)`);
                onProgress(pct);
            }
        };

        xhr.onload = () => {
            console.log(`[B2-UPLOAD] ✅ onload fired. Status: ${xhr.status} ${xhr.statusText}`);
            console.log(`[B2-UPLOAD]   Response Headers: ${xhr.getAllResponseHeaders()}`);
            console.log(`[B2-UPLOAD]   Response Body (first 500 chars): ${xhr.responseText?.substring(0, 500)}`);
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`B2 Upload Failed: ${xhr.status} ${xhr.statusText}. Body: ${xhr.responseText?.substring(0, 200)}`));
        };

        xhr.onerror = () => {
            console.error("B2 Transport Error (Check CORS):", xhr);
            reject(new Error("B2 Network Error (Usually CORS)"));
        };

        xhr.send(file);
    });
}

/**
 * Diagnostic tool to check if B2 is reachable from the client.
 */
export async function testB2Connectivity(): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await fetch("/api/upload/presign?filename=test-connection.txt&type=text/plain");
        if (!res.ok) {
            console.error(`[B2-TEST] Presign request failed: ${res.status} ${res.statusText}`);
            return { ok: false, error: "Server failed to generate test URL" };
        }
        const { uploadUrl } = await res.json();

        return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", uploadUrl);
            xhr.setRequestHeader("Content-Type", "text/plain");
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true });
                else resolve({ ok: false, error: `B2 Rejected (Status: ${xhr.status}). Response: ${xhr.responseText?.substring(0, 200)}` });
            };
            xhr.onerror = () => {
                // If status is 0, it's almost always CORS or local network blocking
                resolve({ ok: false, error: `Network/CORS Error (Status: 0). Shields or Firewall Blocking?` });
            };

            xhr.send("test-connection");
        });
    } catch (err: any) {
        console.error(`[B2-TEST] Exception:`, err);
        return { ok: false, error: err.message };
    }
}

