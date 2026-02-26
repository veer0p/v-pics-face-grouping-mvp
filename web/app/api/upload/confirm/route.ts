import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const imageIds: string[] = body.imageIds;

        if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
            return NextResponse.json({ error: "No imageIds provided" }, { status: 400 });
        }

        const supabase = createServiceClient();

        const { error } = await supabase
            .from("job_images")
            .update({ upload_state: "uploaded" })
            .in("id", imageIds);

        if (error) {
            console.error("Supabase update error:", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Upload confirm error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
