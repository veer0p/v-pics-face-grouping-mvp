import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedProfile } from "@/lib/supabase-server";

// Toggle liked
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id, liked } = await req.json();
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const supabase = createServiceClient();

        const { error } = await supabase
            .from("photos")
            .update({ is_liked: !!liked })
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
