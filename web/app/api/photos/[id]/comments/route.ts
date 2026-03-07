import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedProfile } from "@/lib/supabase-server";
import { resolveAvatarUrl } from "@/lib/avatar";

type ServiceClient = ReturnType<typeof createServiceClient>;
type CommentRow = {
    id: string;
    photo_id: string;
    user_id: string;
    body: string;
    created_at: string;
    updated_at: string;
};

async function canAccessPhoto(supabase: ServiceClient, photoId: string) {
    const { data } = await supabase
        .from("photos")
        .select("id")
        .eq("id", photoId)
        .eq("is_deleted", false)
        .single();
    return !!data;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id: photoId } = await params;
        const supabase = createServiceClient();
        const allowed = await canAccessPhoto(supabase, photoId);
        if (!allowed) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

        const { data, error } = await supabase
            .from("photo_comments")
            .select("id, photo_id, user_id, body, created_at, updated_at")
            .eq("photo_id", photoId)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("[COMMENTS][GET] failed:", error);
            return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
        }

        const rows = (data || []) as CommentRow[];
        const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
        const usersById = new Map<string, { id: string; username?: string; full_name?: string; avatar_url?: string | null }>();
        if (userIds.length > 0) {
            const { data: usersData } = await supabase
                .from("users")
                .select("id, username, full_name, avatar_url")
                .in("id", userIds);
            for (const u of usersData || []) {
                usersById.set(u.id, {
                    ...u,
                    avatar_url: resolveAvatarUrl(u.avatar_url),
                });
            }
        }

        const comments = rows.map((row) => ({
            id: row.id,
            photoId: row.photo_id,
            userId: row.user_id,
            body: row.body,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            user: usersById.get(row.user_id) || null,
        }));

        return NextResponse.json({ comments });
    } catch (error) {
        console.error("[COMMENTS][GET] unexpected:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id: photoId } = await params;
        const body = await req.json();
        const text = String(body?.body || "").trim();
        if (!text) return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
        if (text.length > 2000) return NextResponse.json({ error: "Comment is too long" }, { status: 400 });

        const supabase = createServiceClient();
        const allowed = await canAccessPhoto(supabase, photoId);
        if (!allowed) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

        const { data: inserted, error } = await supabase
            .from("photo_comments")
            .insert({
                photo_id: photoId,
                user_id: user.id,
                body: text,
            })
            .select("id, photo_id, user_id, body, created_at, updated_at")
            .single();

        if (error || !inserted) {
            console.error("[COMMENTS][POST] failed:", error);
            return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
        }

        return NextResponse.json({
            comment: {
                id: inserted.id,
                photoId: inserted.photo_id,
                userId: inserted.user_id,
                body: inserted.body,
                createdAt: inserted.created_at,
                updatedAt: inserted.updated_at,
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    avatar_url: resolveAvatarUrl(user.avatar_url),
                },
            },
        });
    } catch (error) {
        console.error("[COMMENTS][POST] unexpected:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
