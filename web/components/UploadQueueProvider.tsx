"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { UploadQueueStore, type UploadQueueItem } from "@/lib/upload-queue";
import { calculateHash, extractMediaMetadata } from "@/lib/upload-utils";
import { PhotoMetadataCache } from "@/lib/photo-cache";

const QUEUE_MAX_ITEMS = 3000;
const META_CONCURRENCY = 3;
const UPLOAD_BASE_CONCURRENCY = 4;
const RETRY_BACKOFF_MS = [5000, 15000] as const;
const MAX_RETRIES = 2;
const SCHEDULER_INTERVAL_MS = 1500;

type ServerPhotoMarker = {
    id: string;
    contentHash?: string | null;
};

export type PendingUploadItem = {
    localId: string;
    previewUrl: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
    takenAt: string | null;
    durationMs: number | null;
    mediaType: "image" | "video";
    contentHash: string | null;
    status: UploadQueueItem["status"];
    progress: number;
    error: string | null;
    attempts: number;
    serverPhotoId: string | null;
};

type UploadQueueContextType = {
    isEnabled: boolean;
    loading: boolean;
    pendingItems: PendingUploadItem[];
    enqueueFiles: (files: File[]) => Promise<{ queued: number; duplicates: number }>;
    retry: (localId: string) => Promise<void>;
    retryAll: () => Promise<void>;
    remove: (localId: string) => Promise<void>;
    reconcileWithServerPhotos: (photos: ServerPhotoMarker[]) => Promise<void>;
};

const UploadQueueContext = createContext<UploadQueueContextType>({
    isEnabled: true,
    loading: true,
    pendingItems: [],
    enqueueFiles: async () => ({ queued: 0, duplicates: 0 }),
    retry: async () => { },
    retryAll: async () => { },
    remove: async () => { },
    reconcileWithServerPhotos: async () => { },
});

function makeLocalId() {
    return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getUploadConcurrency() {
    if (typeof navigator === "undefined") return UPLOAD_BASE_CONCURRENCY;
    const cpu = navigator.hardwareConcurrency || UPLOAD_BASE_CONCURRENCY;
    return Math.min(8, Math.max(3, Math.floor(cpu / 2)));
}

function getRetryDelay(attempts: number) {
    const index = Math.max(0, Math.min(attempts - 1, RETRY_BACKOFF_MS.length - 1));
    return RETRY_BACKOFF_MS[index];
}

async function withConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
) {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const idx = cursor++;
            if (idx >= items.length) return;
            await worker(items[idx]);
        }
    });
    await Promise.all(runners);
}

async function checkDuplicateHashes(hashes: string[]): Promise<Set<string>> {
    if (hashes.length === 0) return new Set<string>();
    return new Set<string>();
}

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [queueItems, setQueueItems] = useState<UploadQueueItem[]>([]);
    const [queueLoaded, setQueueLoaded] = useState(false);
    const inFlightRef = useRef<Set<string>>(new Set());
    const queueRef = useRef<UploadQueueItem[]>([]);
    const schedulerRef = useRef<number | null>(null);
    const previewUrlsRef = useRef<Map<string, string>>(new Map());
    const enqueueGenRef = useRef(0);

    const isEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_UPLOAD_QUEUE !== "false";

    useEffect(() => {
        queueRef.current = queueItems;
    }, [queueItems]);

    const revokePreview = useCallback((localId: string) => {
        const url = previewUrlsRef.current.get(localId);
        if (!url) return;
        URL.revokeObjectURL(url);
        previewUrlsRef.current.delete(localId);
    }, []);

    const getPreviewUrl = useCallback((localId: string, blob: Blob) => {
        const existing = previewUrlsRef.current.get(localId);
        if (existing) return existing;
        const created = URL.createObjectURL(blob);
        previewUrlsRef.current.set(localId, created);
        return created;
    }, []);

    const patchQueueItem = useCallback(async (
        localId: string,
        patch: Partial<UploadQueueItem>,
        persist = true,
    ): Promise<UploadQueueItem | null> => {
        let updated: UploadQueueItem | null = null;
        setQueueItems((prev) => prev.map((item) => {
            if (item.local_id !== localId) return item;
            updated = { ...item, ...patch };
            return updated;
        }));

        if (persist && updated) {
            try {
                await UploadQueueStore.putItem(updated);
            } catch (err) {
                console.error("[UPLOAD-QUEUE] failed to persist patch:", err);
            }
        }

        return updated;
    }, []);

    const removeQueueItem = useCallback(async (localId: string) => {
        inFlightRef.current.delete(localId);
        revokePreview(localId);
        setQueueItems((prev) => prev.filter((item) => item.local_id !== localId));
        try {
            await UploadQueueStore.deleteItem(localId);
        } catch (err) {
            console.error("[UPLOAD-QUEUE] failed to delete item:", err);
        }
    }, [revokePreview]);

    const uploadOne = useCallback(async (item: UploadQueueItem) => {
        if (!navigator.onLine) {
            await patchQueueItem(item.local_id, { status: "queued_upload", progress: 0 });
            return;
        }

        const startAttemptAt = new Date().toISOString();
        await patchQueueItem(item.local_id, {
            status: "uploading",
            progress: Math.max(item.progress, 5),
            error: null,
            last_attempt_at: startAttemptAt,
        });

        let currentItem = queueRef.current.find((entry) => entry.local_id === item.local_id) || item;

        try {
            if (!currentItem.content_hash) {
                const [hash, exif] = await Promise.all([
                    calculateHash(currentItem.file_blob as File).catch(() => null),
                    extractMediaMetadata(currentItem.file_blob as File).catch(() => ({
                        metadata: {},
                        takenAt: null,
                        width: 0,
                        height: 0,
                        durationMs: null,
                        mediaType: currentItem.mime_type.startsWith("video/") ? "video" : "image",
                    })),
                ]);
                const patched = await patchQueueItem(currentItem.local_id, {
                    content_hash: hash,
                    taken_at: exif.takenAt,
                    width: exif.width || null,
                    height: exif.height || null,
                    duration_ms: exif.durationMs ?? null,
                    metadata: exif.metadata || {},
                });
                if (patched) currentItem = patched;
            }

            await patchQueueItem(currentItem.local_id, { progress: 30 }, false);

            const formData = new FormData();
            formData.append("file", currentItem.file_blob as File);
            formData.append("takenAt", currentItem.taken_at || "");
            formData.append("durationMs", String(currentItem.duration_ms ?? ""));
            formData.append("createdAt", currentItem.created_at);
            formData.append("contentHash", currentItem.content_hash || "");

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const uploadData = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok) {
                const reason = String(uploadData?.error || `Upload failed (${uploadRes.status})`);
                if (uploadRes.status === 409 || reason.toLowerCase().includes("duplicate")) {
                    await removeQueueItem(currentItem.local_id);
                    return;
                }
                throw new Error(reason);
            }

            await patchQueueItem(currentItem.local_id, {
                status: "uploaded",
                progress: 100,
                error: null,
                attempts: 0,
                server_photo_id: uploadData?.photo?.id || null,
            });
            await PhotoMetadataCache.clear();
            await PhotoMetadataCache.setHash("");
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const latest = queueRef.current.find((entry) => entry.local_id === item.local_id);
            if (!latest) return;
            const nextAttempts = (latest.attempts || 0) + 1;
            await patchQueueItem(item.local_id, {
                status: "failed",
                progress: 0,
                error: message,
                attempts: nextAttempts,
                last_attempt_at: new Date().toISOString(),
            });
            console.warn("[UPLOAD-QUEUE] upload failed:", item.original_name, message);
        }
    }, [patchQueueItem, removeQueueItem]);

    const launchWorkers = useCallback(async () => {
        if (authLoading || !user || !queueLoaded) return;
        if (!navigator.onLine) return; // Don't attempt uploads when offline

        const concurrency = getUploadConcurrency();
        if (inFlightRef.current.size >= concurrency) return;

        const now = Date.now();
        const queue = queueRef.current;

        const candidates = queue
            .filter((item) => {
                if (inFlightRef.current.has(item.local_id)) return false;
                if (item.status === "queued_upload") return true;
                if (item.status !== "failed") return false;
                if (item.attempts >= MAX_RETRIES) return false;
                if (!item.last_attempt_at) return true;
                const delay = getRetryDelay(item.attempts);
                return now - new Date(item.last_attempt_at).getTime() >= delay;
            })
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        for (const candidate of candidates) {
            if (inFlightRef.current.size >= concurrency) break;
            inFlightRef.current.add(candidate.local_id);
            void uploadOne(candidate).finally(() => {
                inFlightRef.current.delete(candidate.local_id);
                void launchWorkers();
            });
        }
    }, [authLoading, queueLoaded, uploadOne, user]);

    const processNewItems = useCallback(async (createdItems: UploadQueueItem[]) => {
        if (createdItems.length === 0) return { queued: 0, duplicates: 0 };

        const preparedHashes = new Map<string, string | null>();

        await withConcurrency(createdItems, META_CONCURRENCY, async (item) => {
            const [hash, exif] = await Promise.all([
                calculateHash(item.file_blob as File).catch(() => null),
                extractMediaMetadata(item.file_blob as File).catch(() => ({
                    metadata: {},
                    takenAt: null,
                    width: 0,
                    height: 0,
                    durationMs: null,
                    mediaType: item.mime_type.startsWith("video/") ? "video" : "image",
                })),
            ]);

            preparedHashes.set(item.local_id, hash);
            await patchQueueItem(item.local_id, {
                content_hash: hash,
                taken_at: exif.takenAt,
                width: exif.width || null,
                height: exif.height || null,
                duration_ms: exif.durationMs ?? null,
                metadata: exif.metadata || {},
            });
        });

        const readyHashes = Array.from(
            new Set(
                Array.from(preparedHashes.values()).filter((hash): hash is string => !!hash),
            ),
        );
        const existingHashes = await checkDuplicateHashes(readyHashes);
        const createdIds = new Set(createdItems.map((item) => item.local_id));
        const queueHashes = new Set(
            queueRef.current
                .filter((item) => !createdIds.has(item.local_id))
                .map((item) => item.content_hash)
                .filter((hash): hash is string => typeof hash === "string" && hash.length > 0),
        );
        const seenInBatch = new Set<string>();

        let duplicates = 0;
        let queued = 0;
        for (const item of createdItems) {
            const localId = item.local_id;
            const hash = preparedHashes.get(localId) ?? null;

            if (hash && (existingHashes.has(hash) || queueHashes.has(hash) || seenInBatch.has(hash))) {
                duplicates += 1;
                await removeQueueItem(localId);
                continue;
            }
            if (hash) {
                seenInBatch.add(hash);
            }

            queued += 1;
            await patchQueueItem(localId, {
                status: "queued_upload",
                progress: 0,
                error: null,
            });
        }

        console.info("[UPLOAD-QUEUE] enqueue summary", { queued, duplicates, total: createdItems.length });
        void launchWorkers();
        return { queued, duplicates };
    }, [launchWorkers, patchQueueItem, removeQueueItem]);

    const enqueueFiles = useCallback(async (files: File[]) => {
        if (!user) return { queued: 0, duplicates: 0 };
        if (files.length === 0) return { queued: 0, duplicates: 0 };

        const activeCount = queueRef.current.length;
        const availableSlots = Math.max(QUEUE_MAX_ITEMS - activeCount, 0);
        const accepted = files.slice(0, availableSlots);
        const ignored = files.length - accepted.length;

        if (ignored > 0) {
            console.warn(`[UPLOAD-QUEUE] queue cap reached. Ignored ${ignored} file(s).`);
        }

        if (accepted.length === 0) return { queued: 0, duplicates: 0 };

        // Deduplicate against existing queue items by filename + size
        const existingSignatures = new Set(
            queueRef.current.map((item) => `${item.original_name}|${item.size_bytes}`),
        );
        const seenInBatch = new Set<string>();
        const deduped: File[] = [];
        let preDedup = 0;

        for (const file of accepted) {
            const sig = `${file.name}|${file.size}`;
            if (existingSignatures.has(sig) || seenInBatch.has(sig)) {
                preDedup += 1;
                continue;
            }
            seenInBatch.add(sig);
            deduped.push(file);
        }

        if (preDedup > 0) {
            console.info(`[UPLOAD-QUEUE] skipped ${preDedup} file(s) already in queue (name+size match).`);
        }

        if (deduped.length === 0) return { queued: 0, duplicates: preDedup };

        const now = Date.now();
        const created = deduped.map((file, index) => {
            const ts = new Date(now + index).toISOString();
            const item: UploadQueueItem = {
                local_id: makeLocalId(),
                user_id: user.id,
                file_blob: file,
                original_name: file.name,
                mime_type: file.type || "application/octet-stream",
                size_bytes: file.size,
                created_at: ts,
                taken_at: null,
                width: null,
                height: null,
                duration_ms: null,
                content_hash: null,
                metadata: {},
                status: "pending_hash",
                progress: 0,
                error: null,
                attempts: 0,
                last_attempt_at: null,
                server_photo_id: null,
            };
            return item;
        });

        setQueueItems((prev) => [...created, ...prev]);
        await UploadQueueStore.putItems(created);

        const generation = ++enqueueGenRef.current;
        const summary = await processNewItems(created);
        if (generation !== enqueueGenRef.current) {
            return { queued: summary.queued, duplicates: summary.duplicates + preDedup };
        }
        return { queued: summary.queued, duplicates: summary.duplicates + preDedup };
    }, [processNewItems, user]);

    const retry = useCallback(async (localId: string) => {
        const updated = await patchQueueItem(localId, {
            status: "queued_upload",
            error: null,
            attempts: 0,
            last_attempt_at: null,
            progress: 0,
        });
        if (!updated) return;
        void launchWorkers();
    }, [launchWorkers, patchQueueItem]);

    const remove = useCallback(async (localId: string) => {
        await removeQueueItem(localId);
    }, [removeQueueItem]);

    const retryAll = useCallback(async () => {
        const failedItems = queueRef.current.filter((item) => item.status === "failed");
        if (failedItems.length === 0) return;
        for (const item of failedItems) {
            await patchQueueItem(item.local_id, {
                status: "queued_upload",
                error: null,
                attempts: 0,
                last_attempt_at: null,
                progress: 0,
            });
        }
        void launchWorkers();
    }, [launchWorkers, patchQueueItem]);

    const reconcileWithServerPhotos = useCallback(async (photos: ServerPhotoMarker[]) => {
        if (photos.length === 0) return;

        const idSet = new Set(photos.map((photo) => photo.id));
        const hashSet = new Set(
            photos
                .map((photo) => photo.contentHash)
                .filter((hash): hash is string => typeof hash === "string" && hash.length > 0),
        );

        const uploadedLocals = queueRef.current.filter((item) => item.status === "uploaded");
        const matchedLocalIds: string[] = [];

        for (const item of uploadedLocals) {
            if (item.server_photo_id && idSet.has(item.server_photo_id)) {
                matchedLocalIds.push(item.local_id);
                continue;
            }
            if (item.content_hash && hashSet.has(item.content_hash)) {
                matchedLocalIds.push(item.local_id);
            }
        }

        if (matchedLocalIds.length === 0) return;

        for (const localId of matchedLocalIds) {
            revokePreview(localId);
        }
        setQueueItems((prev) => prev.filter((item) => !matchedLocalIds.includes(item.local_id)));
        await UploadQueueStore.deleteItems(matchedLocalIds);
    }, [revokePreview]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setQueueItems([]);
            setQueueLoaded(true);
            return;
        }

        let cancelled = false;
        setQueueLoaded(false);

        const load = async () => {
            try {
                const items = await UploadQueueStore.getUserItems(user.id);
                const resetItems = items
                    .map((item) => {
                        const normalized = {
                            ...item,
                            duration_ms: item.duration_ms ?? null,
                        };
                        if (item.status === "failed") {
                            return { ...normalized, attempts: 0, last_attempt_at: null };
                        }
                        if (item.status === "uploading" || item.status === "pending_hash") {
                            return {
                                ...normalized,
                                status: "queued_upload" as const,
                                progress: 0,
                                error: null,
                                last_attempt_at: null,
                            };
                        }
                        return normalized;
                    })
                    .filter((item) => item.status !== "duplicate_skipped");
                await UploadQueueStore.putItems(resetItems);
                if (cancelled) return;
                setQueueItems(resetItems);
            } catch (err) {
                console.error("[UPLOAD-QUEUE] failed loading queue:", err);
            } finally {
                if (!cancelled) setQueueLoaded(true);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [authLoading, user]);

    useEffect(() => {
        if (authLoading || !user || !queueLoaded) return;

        const tick = () => {
            void launchWorkers();
        };
        tick();
        schedulerRef.current = window.setInterval(tick, SCHEDULER_INTERVAL_MS);
        return () => {
            if (schedulerRef.current !== null) {
                window.clearInterval(schedulerRef.current);
                schedulerRef.current = null;
            }
        };
    }, [authLoading, launchWorkers, queueLoaded, user]);

    useEffect(() => {
        const activeIds = new Set(queueItems.map((item) => item.local_id));
        for (const [localId, url] of previewUrlsRef.current.entries()) {
            if (!activeIds.has(localId)) {
                URL.revokeObjectURL(url);
                previewUrlsRef.current.delete(localId);
            }
        }
    }, [queueItems]);

    useEffect(() => {
        const failedCount = queueItems.filter((item) => item.status === "failed").length;
        if (failedCount > 20) {
            console.warn("[UPLOAD-QUEUE] high failed queue count:", failedCount);
        }
    }, [queueItems]);

    useEffect(() => {
        const previewMap = previewUrlsRef.current;
        return () => {
            for (const url of previewMap.values()) {
                URL.revokeObjectURL(url);
            }
            previewMap.clear();
        };
    }, []);

    const pendingItems = useMemo(() => {
        if (!isEnabled) return [];
        return queueItems
            .filter((item) => item.status !== "duplicate_skipped")
            .map((item) => ({
                localId: item.local_id,
                previewUrl: getPreviewUrl(item.local_id, item.file_blob),
                filename: item.original_name,
                mimeType: item.mime_type,
                sizeBytes: item.size_bytes,
                createdAt: item.created_at,
                takenAt: item.taken_at,
                durationMs: item.duration_ms,
                mediaType: (item.mime_type.startsWith("video/") ? "video" : "image") as PendingUploadItem["mediaType"],
                contentHash: item.content_hash,
                status: item.status,
                progress: item.progress,
                error: item.error,
                attempts: item.attempts,
                serverPhotoId: item.server_photo_id,
            }));
    }, [getPreviewUrl, isEnabled, queueItems]);

    const value = useMemo<UploadQueueContextType>(() => ({
        isEnabled,
        loading: authLoading || !queueLoaded,
        pendingItems,
        enqueueFiles,
        retry,
        retryAll,
        remove,
        reconcileWithServerPhotos,
    }), [authLoading, enqueueFiles, isEnabled, pendingItems, queueLoaded, reconcileWithServerPhotos, remove, retry, retryAll]);

    return (
        <UploadQueueContext.Provider value={value}>
            {children}
        </UploadQueueContext.Provider>
    );
}

export function useUploadQueue() {
    return useContext(UploadQueueContext);
}
