import { useEffect, useRef } from "react";
import { getSupabaseBrowser } from "./supabase-browser";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { PhotoMetadataCache, type Photo } from "./photo-cache";

type UseRealtimePhotosOptions = {
    /** Current photos state */
    photos: Photo[];
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
export function useRealtimePhotos({ photos, setPhotos, enabled = true }: UseRealtimePhotosOptions) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const photosRef = useRef<Photo[]>(photos);

    // Keep photosRef in sync with the latest prop
    useEffect(() => {
        photosRef.current = photos;
    }, [photos]);

    useEffect(() => {
        if (!enabled) return;

        const supabase = getSupabaseBrowser();

        const channel = supabase
            .channel("photos-realtime")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "photos" },
                async (payload) => {
                    const row = payload.new as any;
                    if (row.is_deleted) return;

                    try {
                        const res = await fetch(`/api/photos/${row.id}`);
                        if (!res.ok) return;
                        const { photo } = await res.json();
                        if (!photo) return;

                        setPhotos((prev) => {
                            if (prev.some((p) => p.id === photo.id)) return prev;
                            return [photo, ...prev];
                        });

                        // Update cache using the latest ref content
                        if (PhotoMetadataCache.get(0)) {
                            PhotoMetadataCache.set(0, [photo, ...photosRef.current].slice(0, 40));
                        }
                    } catch (err) {
                        console.error("[Realtime] Failed to fetch new photo:", err);
                    }
                },
            )
            // ... [rest of the component] ...
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "photos" },
                (payload) => {
                    const row = payload.new as any;

                    // If soft-deleted, remove from the list
                    if (row.is_deleted) {
                        setPhotos((prev) => prev.filter((p) => p.id !== row.id));
                        return;
                    }

                    // Update in-place (e.g. is_liked toggle)
                    setPhotos((prev) => {
                        const next = prev.map((p) =>
                            p.id === row.id ? { ...p, isLiked: row.is_liked ?? p.isLiked } : p,
                        );
                        // Update cache for any photo updated
                        const updated = next.find(p => p.id === row.id);
                        if (updated) PhotoMetadataCache.updatePhoto(updated);
                        return next;
                    });
                },
            )
            .on(
                "postgres_changes",
                { event: "DELETE", schema: "public", table: "photos" },
                (payload) => {
                    const row = payload.old as any;
                    setPhotos((prev) => {
                        const next = prev.filter((p) => p.id !== row.id);
                        // Clear cache on delete to be safe, or we could update specifically
                        PhotoMetadataCache.clear();
                        return next;
                    });
                },
            )
            .subscribe((status) => {
                console.log("[Realtime] Subscription status:", status);
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [enabled, setPhotos]);
}
