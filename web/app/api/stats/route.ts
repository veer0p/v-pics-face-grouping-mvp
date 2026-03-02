import { NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedProfile } from "@/lib/supabase-server";

export async function GET() {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from("photos")
            .select("size_bytes, is_deleted, is_liked")
            .eq("user_id", user.id)
            .limit(10000);

        if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });

        const photos = data || [];
        const active = photos.filter((p) => !p.is_deleted);
        const deleted = photos.filter((p) => p.is_deleted);
        const liked = photos.filter((p) => p.is_liked && !p.is_deleted);

        return NextResponse.json({
            totalPhotos: active.length,
            totalBytes: active.reduce((s, p) => s + (p.size_bytes || 0), 0),
            trashCount: deleted.length,
            trashBytes: deleted.reduce((s, p) => s + (p.size_bytes || 0), 0),
            favoriteCount: liked.length,
        });
    } catch {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
