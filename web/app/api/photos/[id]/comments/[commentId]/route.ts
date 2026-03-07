import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedProfile } from "@/lib/supabase-server";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; commentId: string }> },
) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id: photoId, commentId } = await params;
        const body = await req.json();
        const text = String(body?.body || "").trim();
        if (!text) return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
        if (text.length > 2000) return NextResponse.json({ error: "Comment is too long" }, { status: 400 });

        const supabase = createServiceClient();

        const { data: comment, error: fetchError } = await supabase
            .from("photo_comments")
            .select("id, photo_id, user_id")
            .eq("id", commentId)
            .single();

        if (fetchError || !comment || comment.photo_id !== photoId) {
            return NextResponse.json({ error: "Comment not found" }, { status: 404 });
        }

        const { data: photo } = await supabase
            .from("photos")
            .select("id")
            .eq("id", photoId)
            .eq("is_deleted", false)
            .single();

        if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
        if (comment.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const { data: updated, error } = await supabase
            .from("photo_comments")
            .update({
                body: text,
                updated_at: new Date().toISOString(),
            })
            .eq("id", commentId)
            .eq("user_id", user.id)
            .select("id, photo_id, user_id, body, created_at, updated_at")
            .single();

        if (error || !updated) {
            console.error("[COMMENTS][PATCH] failed:", error);
            return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
        }

        return NextResponse.json({
            comment: {
                id: updated.id,
                photoId: updated.photo_id,
                userId: updated.user_id,
                body: updated.body,
                createdAt: updated.created_at,
                updatedAt: updated.updated_at,
            },
        });
    } catch (error) {
        console.error("[COMMENTS][PATCH] unexpected:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; commentId: string }> },
) {
    try {
        const user = await getAuthenticatedProfile();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id: photoId, commentId } = await params;
        const supabase = createServiceClient();

        const { data: comment, error: fetchError } = await supabase
            .from("photo_comments")
            .select("id, photo_id, user_id")
            .eq("id", commentId)
            .single();

        if (fetchError || !comment || comment.photo_id !== photoId) {
            return NextResponse.json({ error: "Comment not found" }, { status: 404 });
        }

        const { data: photo } = await supabase
            .from("photos")
            .select("id")
            .eq("id", photoId)
            .eq("is_deleted", false)
            .single();

        if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
        if (comment.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const { error } = await supabase
            .from("photo_comments")
            .delete()
            .eq("id", commentId)
            .eq("user_id", user.id);

        if (error) {
            console.error("[COMMENTS][DELETE] failed:", error);
            return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[COMMENTS][DELETE] unexpected:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
