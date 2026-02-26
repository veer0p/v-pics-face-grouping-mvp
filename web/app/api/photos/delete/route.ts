import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getClient, getBucket } from "@/lib/b2";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const ids: string[] = body.ids;
        const permanent: boolean = body.permanent === true;

        console.log(`[Delete API] Request: ids=${ids?.length}, permanent=${permanent}`);

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "No ids provided" }, { status: 400 });
        }

        const supabase = createServiceClient();

        if (permanent) {
            console.log("[Delete API] Starting permanent deletion...");
            const s3 = getClient();
            const bucket = getBucket();

            // Fetch keys before deleting from DB
            const { data: photos, error: fetchError } = await supabase
                .from("photos")
                .select("id, original_key, thumb_key")
                .in("id", ids);

            if (fetchError) {
                console.error("[Delete API] DB Fetch Error:", fetchError);
                return NextResponse.json({ error: "DB fetch error" }, { status: 500 });
            }

            console.log(`[Delete API] Found ${photos?.length || 0} photos to delete from storage`);

            for (const photo of photos || []) {
                try {
                    console.log(`[Delete API] Deleting original: ${photo.original_key}`);
                    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: photo.original_key }));

                    if (photo.thumb_key) {
                        console.log(`[Delete API] Deleting thumbnail: ${photo.thumb_key}`);
                        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: photo.thumb_key }));
                    }
                } catch (err) {
                    console.error(`[Delete API] B2 delete failed for ${photo.original_key}:`, err);
                }
            }

            // Remove from DB permanently
            const { error: dbError } = await supabase.from("photos").delete().in("id", ids);
            if (dbError) {
                console.error("[Delete API] DB Delete Error:", dbError);
                return NextResponse.json({ error: "DB delete error" }, { status: 500 });
            }

            console.log("[Delete API] Permanent deletion complete");

        } else {
            console.log("[Delete API] Soft deleting photos...");
            const { error: softError } = await supabase
                .from("photos")
                .update({
                    is_deleted: true,
                    deleted_at: new Date().toISOString()
                })
                .in("id", ids);

            if (softError) {
                console.error("[Delete API] Soft Delete Error:", softError);
                return NextResponse.json({ error: "DB soft delete error" }, { status: 500 });
            }
            console.log("[Delete API] Soft deletion complete");
        }

        return NextResponse.json({ ok: true, deleted: ids.length, permanent });
    } catch (err) {
        console.error("[Delete API] Unexpected Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
