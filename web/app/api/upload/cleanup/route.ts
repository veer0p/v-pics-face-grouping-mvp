import { NextRequest, NextResponse } from "next/server";
import { deleteObject } from "@/lib/r2";

/**
 * POST /api/upload/cleanup
 * Cleans up orphaned R2 objects if an upload or DB insertion fails.
 */
export async function POST(req: NextRequest) {
    try {
        const { originalKey, thumbKey } = await req.json();

        const deletions: Promise<void>[] = [];
        if (originalKey) {
            console.log(`[UPLOAD-CLEANUP] Deleting original: ${originalKey}`);
            deletions.push(deleteObject(originalKey));
        }
        if (thumbKey) {
            console.log(`[UPLOAD-CLEANUP] Deleting thumbnail: ${thumbKey}`);
            deletions.push(deleteObject(thumbKey));
        }

        await Promise.allSettled(deletions);

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[UPLOAD-CLEANUP] Error during cleanup:", err);
        return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
    }
}

