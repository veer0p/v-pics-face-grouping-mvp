import { NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedProfile } from "@/lib/supabase-server";
import { getReadUrl } from "@/lib/b2";

// Get trash (soft-deleted photos)
export async function GET() {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from("photos")
            .select("id, thumb_key, original_key, original_name, size_bytes, created_at")
            .eq("user_id", user.id)
            .eq("is_deleted", true)
            .order("updated_at", { ascending: false })
            .limit(100);

        if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });

        const photos = await Promise.all(
            (data || []).map(async (p) => ({
                id: p.id,
                thumbUrl: p.thumb_key ? await getReadUrl(p.thumb_key) : await getReadUrl(p.original_key),
                filename: p.original_name,
                sizeBytes: p.size_bytes,
                createdAt: p.created_at,
            })),
        );

        return NextResponse.json({ photos });
    } catch {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
