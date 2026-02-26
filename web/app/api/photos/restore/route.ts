import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// Restore soft-deleted photos
export async function POST(req: NextRequest) {
    try {
        const { ids } = await req.json();
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "No ids" }, { status: 400 });
        }

        const supabase = createServiceClient();
        const { error } = await supabase
            .from("photos")
            .update({ is_deleted: false })
            .in("id", ids);

        if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });
        return NextResponse.json({ ok: true, restored: ids.length });
    } catch {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
