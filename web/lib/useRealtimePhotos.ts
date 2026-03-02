import { useEffect, useRef } from "react";
import { getSupabaseBrowser } from "./supabase-browser";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { PhotoMetadataCache, PhotoDetailCache, type Photo } from "./photo-cache";
import { useAuth } from "@/components/AuthContext";
import { useNetwork } from "@/components/NetworkContext";

type UseRealtimePhotosOptions = {
    /** Setter to update the photos list */
    setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
    /** Whether realtime should be active */
    enabled?: boolean;
};

/**
 * Hook that subscribes to Supabase Realtime changes on the `photos` table.
 * - INSERT  → fetches signed URLs and prepends the new photo
 * - UPDATE  → updates the photo in-place (e.g. is_liked, is_deleted)
 * - DELETE  → removes the photo from the list
 */
export function useRealtimePhotos({ setPhotos, enabled = true }: UseRealtimePhotosOptions) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const { user, loading: authLoading } = useAuth();
    const { isOnline } = useNetwork();

    useEffect(() => {
        if (!enabled || authLoading || !user || !isOnline) return;

        const supabase = getSupabaseBrowser();

        const channel = supabase
            .channel("photos-realtime")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "photos" },
                async (payload: { new: any }) => {
                    const row = payload.new;
                    if (row.is_deleted) return;
                    if (row.user_id && row.user_id !== user.id) return;

                    try {
                        const res = await fetch(`/api/photos/${row.id}`);
                        if (!res.ok) return;
                        const { photo } = await res.json();
                        if (!photo) return;

                        setPhotos((prev) => {
                            if (prev.some((p) => p.id === photo.id)) return prev;
                            return [photo, ...prev];
                        });

                        // Invalidate cache on new photo
                        await PhotoMetadataCache.clear();
                        await PhotoMetadataCache.setHash("");
                    } catch (err) {
                        console.error("[Realtime] Failed to fetch new photo:", err);
                    }
                },
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "photos" },
                async (payload: { new: any }) => {
                    const row = payload.new;
                    if (row.user_id && row.user_id !== user.id) return;

                    // If soft-deleted, remove from the list
                    if (row.is_deleted) {
                        setPhotos((prev) => prev.filter((p) => p.id !== row.id));
                        await PhotoMetadataCache.clear();
                        await PhotoMetadataCache.setHash("");
                        await PhotoDetailCache.delete(row.id);
                        return;
                    }

                    // Update in-place (e.g. is_liked toggle)
                    setPhotos((prev) => {
                        const next = prev.map((p) =>
                            p.id === row.id ? { ...p, isLiked: row.is_liked ?? p.isLiked } : p,
                        );
                        return next;
                    });

                    // Invalidate cache for any update
                    await PhotoMetadataCache.clear();
                    await PhotoMetadataCache.setHash("");
                    await PhotoDetailCache.delete(row.id);
                },
            )
            .on(
                "postgres_changes",
                { event: "DELETE", schema: "public", table: "photos" },
                async (payload: { old: any }) => {
                    const row = payload.old;
                    if (row.user_id && row.user_id !== user.id) return;
                    setPhotos((prev) => prev.filter((p) => p.id !== row.id));
                    // Invalidate cache
                    await PhotoMetadataCache.clear();
                    await PhotoMetadataCache.setHash("");
                    await PhotoDetailCache.delete(row.id);
                },
            )
            .subscribe((status: string) => {
                console.log("[Realtime] Subscription status:", status);
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [enabled, setPhotos, authLoading, user?.id, isOnline]);
}
