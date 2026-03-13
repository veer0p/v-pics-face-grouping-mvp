const DB_NAME = "v-pics-vault-db";
const DB_VERSION = 5;
const DB_OPEN_TIMEOUT_MS = 1500;

const THUMB_QUOTA = 250 * 1024 * 1024;
const FULL_QUOTA = 750 * 1024 * 1024;
const VIDEO_QUOTA = 500 * 1024 * 1024;

export type Photo = {
    id: string;
    url: string;
    thumbUrl: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    isLiked: boolean;
    takenAt: string | null;
    createdAt: string;
    contentHash?: string | null;
    mediaType?: "image" | "video";
    durationMs?: number | null;
};

type BlobCategory = "thumb" | "full" | "video";

function waitTransaction(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
        tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
    });
}

function waitRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
}

class IndexedDBStore {
    private db: IDBDatabase | null = null;
    private dbPromise: Promise<IDBDatabase> | null = null;
    private unavailable = false;

    async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;
        if (this.dbPromise) return this.dbPromise;
        if (this.unavailable || typeof window === "undefined" || typeof window.indexedDB === "undefined") {
            this.unavailable = true;
            throw new Error("IndexedDB unavailable");
        }

        this.dbPromise = new Promise((resolve, reject) => {
            let settled = false;
            const timeoutId = window.setTimeout(() => {
                if (settled) return;
                settled = true;
                this.dbPromise = null;
                reject(new Error("IndexedDB open timed out"));
            }, DB_OPEN_TIMEOUT_MS);

            const finishResolve = (db: IDBDatabase) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                this.db = db;
                this.dbPromise = null;
                resolve(db);
            };

            const finishReject = (error: unknown) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                this.dbPromise = null;
                reject(error instanceof Error ? error : new Error(String(error)));
            };

            let request: IDBOpenDBRequest;
            try {
                request = indexedDB.open(DB_NAME, DB_VERSION);
            } catch (error) {
                finishReject(error);
                return;
            }

            request.onerror = () => finishReject(request.error || new Error("Failed to open IndexedDB"));
            request.onblocked = () => finishReject(new Error("IndexedDB open blocked"));
            request.onsuccess = () => {
                const db = request.result;
                db.onclose = () => {
                    if (this.db === db) this.db = null;
                };
                db.onversionchange = () => {
                    db.close();
                    if (this.db === db) this.db = null;
                };
                finishResolve(db);
            };
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains("metadata")) {
                    db.createObjectStore("metadata", { keyPath: "offset" });
                }

                if (!db.objectStoreNames.contains("images")) {
                    const store = db.createObjectStore("images", { keyPath: "key" });
                    store.createIndex("by_category", "category", { unique: false });
                    store.createIndex("by_timestamp", "timestamp", { unique: false });
                } else if (event.oldVersion < 2) {
                    db.deleteObjectStore("images");
                    const store = db.createObjectStore("images", { keyPath: "key" });
                    store.createIndex("by_category", "category", { unique: false });
                    store.createIndex("by_timestamp", "timestamp", { unique: false });
                }

                if (!db.objectStoreNames.contains("settings")) {
                    db.createObjectStore("settings");
                }

                if (!db.objectStoreNames.contains("details")) {
                    db.createObjectStore("details", { keyPath: "id" });
                }
            };
        });

        return this.dbPromise;
    }

    async setSetting(key: string, value: unknown) {
        const db = await this.getDB();
        const tx = db.transaction("settings", "readwrite");
        tx.objectStore("settings").put(value, key);
        await waitTransaction(tx);
    }

    async getSetting<T = unknown>(key: string): Promise<T | null> {
        const db = await this.getDB();
        const tx = db.transaction("settings", "readonly");
        const result = await waitRequest(tx.objectStore("settings").get(key));
        return (result as T | undefined) ?? null;
    }

    async saveMetadata(offset: number, photos: Photo[]) {
        const db = await this.getDB();
        const tx = db.transaction("metadata", "readwrite");
        tx.objectStore("metadata").put({ offset, photos, timestamp: Date.now() });
        await waitTransaction(tx);
    }

    async getMetadata(offset: number): Promise<Photo[] | null> {
        const db = await this.getDB();
        const tx = db.transaction("metadata", "readonly");
        const result = await waitRequest<{ offset: number; photos: Photo[]; timestamp: number } | undefined>(
            tx.objectStore("metadata").get(offset),
        );
        return result?.photos ?? null;
    }

    async clearMetadata() {
        const db = await this.getDB();
        const tx = db.transaction("metadata", "readwrite");
        tx.objectStore("metadata").clear();
        await waitTransaction(tx);
    }

    async saveDetail(id: string, data: unknown) {
        const db = await this.getDB();
        const tx = db.transaction("details", "readwrite");
        tx.objectStore("details").put({ id, data, timestamp: Date.now() });
        await waitTransaction(tx);
    }

    async getDetail<T = unknown>(id: string): Promise<T | null> {
        const db = await this.getDB();
        const tx = db.transaction("details", "readonly");
        const result = await waitRequest<{ id: string; data: T; timestamp: number } | undefined>(
            tx.objectStore("details").get(id),
        );
        return result?.data ?? null;
    }

    async deleteDetail(id: string) {
        const db = await this.getDB();
        const tx = db.transaction("details", "readwrite");
        tx.objectStore("details").delete(id);
        await waitTransaction(tx);
    }

    async clearDetails() {
        const db = await this.getDB();
        const tx = db.transaction("details", "readwrite");
        tx.objectStore("details").clear();
        await waitTransaction(tx);
    }

    async saveImage(id: string, blob: Blob, category: BlobCategory) {
        await this.evictIfNeeded(category, blob.size);

        const db = await this.getDB();
        const tx = db.transaction("images", "readwrite");
        tx.objectStore("images").put({
            key: `${category}:${id}`,
            id,
            blob,
            size: blob.size,
            category,
            timestamp: Date.now(),
        });
        await waitTransaction(tx);
    }

    async getImage(id: string, category: BlobCategory): Promise<Blob | null> {
        const db = await this.getDB();
        const tx = db.transaction("images", "readonly");
        const result = await waitRequest<{ blob: Blob } | undefined>(
            tx.objectStore("images").get(`${category}:${id}`),
        );
        return result?.blob ?? null;
    }

    private async evictIfNeeded(category: BlobCategory, newSize: number) {
        const quota =
            category === "thumb"
                ? THUMB_QUOTA
                : category === "full"
                    ? FULL_QUOTA
                    : VIDEO_QUOTA;

        let usage = await this.getCategoryUsage(category);
        if (usage + newSize <= quota) return;

        const db = await this.getDB();
        const tx = db.transaction("images", "readwrite");
        const store = tx.objectStore("images");
        const index = store.index("by_timestamp");

        await new Promise<void>((resolve, reject) => {
            const request = index.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor || usage + newSize <= quota) {
                    resolve();
                    return;
                }

                const value = cursor.value as {
                    key: string;
                    size: number;
                    category: BlobCategory;
                };

                if (value.category === category) {
                    usage -= value.size;
                    cursor.delete();
                }
                cursor.continue();
            };
            request.onerror = () => reject(request.error || new Error("Failed during cache eviction"));
        });

        await waitTransaction(tx);
    }

    private async getCategoryUsage(category: BlobCategory): Promise<number> {
        const db = await this.getDB();
        const tx = db.transaction("images", "readonly");
        const index = tx.objectStore("images").index("by_category");
        let total = 0;

        await new Promise<void>((resolve, reject) => {
            const request = index.openCursor(IDBKeyRange.only(category));
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const value = cursor.value as { size: number };
                    total += value.size;
                    cursor.continue();
                    return;
                }
                resolve();
            };
            request.onerror = () => reject(request.error || new Error("Failed to calculate cache usage"));
        });

        return total;
    }
}

const Store = new IndexedDBStore();

async function safeCacheRead<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await operation();
    } catch {
        return fallback;
    }
}

const inMemoryDetails = new Map<string, any>();
const inFlightDetailFetches = new Map<string, Promise<any>>();
const inFlightImageFetches = new Map<string, Promise<string>>();
const inFlightVideoFetches = new Map<string, Promise<string>>();

export const PhotoMetadataCache = {
    async getHash(): Promise<string | null> {
        if (typeof window === "undefined") return null;
        return safeCacheRead(() => Store.getSetting<string>("photo_hash"), null);
    },

    async setHash(hash: string) {
        if (typeof window === "undefined") return;
        await safeCacheRead(async () => {
            await Store.setSetting("photo_hash", hash);
            return undefined;
        }, undefined);
    },

    async get(offset: number): Promise<Photo[] | null> {
        if (typeof window === "undefined") return null;
        return safeCacheRead(() => Store.getMetadata(offset), null);
    },

    async set(offset: number, photos: Photo[]) {
        if (typeof window === "undefined") return;
        await safeCacheRead(async () => {
            await Store.saveMetadata(offset, photos);
            return undefined;
        }, undefined);
    },

    async clear() {
        if (typeof window === "undefined") return;
        await safeCacheRead(async () => {
            await Store.clearMetadata();
            return undefined;
        }, undefined);
    },
};

export const PhotoDetailCache = {
    async get(id: string): Promise<any | null> {
        if (typeof window === "undefined") return null;

        if (inMemoryDetails.has(id)) {
            return inMemoryDetails.get(id) ?? null;
        }

        return safeCacheRead(async () => {
            const cached = await Store.getDetail(id);
            if (cached) {
                inMemoryDetails.set(id, cached);
            }
            return cached;
        }, null);
    },

    async set(id: string, data: any) {
        if (typeof window === "undefined") return;

        inMemoryDetails.set(id, data);
        await safeCacheRead(async () => {
            await Store.saveDetail(id, data);
            return undefined;
        }, undefined);
    },

    async fetchAndCache(id: string): Promise<any> {
        if (typeof window === "undefined") return null;

        const cached = await this.get(id);
        if (cached) return cached;

        if (inFlightDetailFetches.has(id)) {
            return inFlightDetailFetches.get(id)!;
        }

        const fetchPromise = (async () => {
            try {
                const response = await fetch(`/api/photos/${id}`);
                if (!response.ok) throw new Error("Failed to fetch photo details");
                const payload = await response.json();
                await this.set(id, payload.photo);
                return payload.photo;
            } finally {
                inFlightDetailFetches.delete(id);
            }
        })();

        inFlightDetailFetches.set(id, fetchPromise);
        return fetchPromise;
    },

    async delete(id: string) {
        if (typeof window === "undefined") return;

        inMemoryDetails.delete(id);
        await safeCacheRead(async () => {
            await Store.deleteDetail(id);
            return undefined;
        }, undefined);
    },

    async clear() {
        if (typeof window === "undefined") return;

        inMemoryDetails.clear();
        await safeCacheRead(async () => {
            await Store.clearDetails();
            return undefined;
        }, undefined);
    },
};

function getStorageFetchUrl(url: string) {
    if (url.includes("r2.cloudflarestorage.com") || url.includes(".r2.dev")) {
        return `/api/photos/proxy?url=${encodeURIComponent(url)}`;
    }

    return url;
}

export const ImageBlobCache = {
    async get(id: string, category: "thumb" | "full"): Promise<string | null> {
        if (typeof window === "undefined") return null;

        return safeCacheRead(async () => {
            const blob = await Store.getImage(id, category);
            if (!blob) return null;
            return URL.createObjectURL(blob);
        }, null);
    },

    async fetchAndCache(
        id: string,
        url: string,
        category: "thumb" | "full" = "full",
        signal?: AbortSignal,
    ): Promise<string> {
        if (typeof window === "undefined") return url;

        const key = `${category}:${id}`;
        const cached = await this.get(id, category);
        if (cached) return cached;

        if (inFlightImageFetches.has(key)) {
            return inFlightImageFetches.get(key)!;
        }

        const fetchPromise = (async () => {
            try {
                const response = await fetch(getStorageFetchUrl(url), { signal });
                if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

                const blob = await response.blob();
                await safeCacheRead(async () => {
                    await Store.saveImage(id, blob, category);
                    return undefined;
                }, undefined);

                return URL.createObjectURL(blob);
            } finally {
                inFlightImageFetches.delete(key);
            }
        })();

        inFlightImageFetches.set(key, fetchPromise);
        return fetchPromise;
    },
};

export const VideoBlobCache = {
    async get(id: string): Promise<string | null> {
        if (typeof window === "undefined") return null;

        return safeCacheRead(async () => {
            const blob = await Store.getImage(id, "video");
            if (!blob) return null;
            return URL.createObjectURL(blob);
        }, null);
    },

    async fetchAndCache(id: string, url: string, signal?: AbortSignal): Promise<string> {
        if (typeof window === "undefined") return url;

        const key = `video:${id}`;
        const cached = await this.get(id);
        if (cached) return cached;

        if (inFlightVideoFetches.has(key)) {
            return inFlightVideoFetches.get(key)!;
        }

        const fetchPromise = (async () => {
            try {
                const response = await fetch(getStorageFetchUrl(url), { signal });
                if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`);

                const blob = await response.blob();
                await safeCacheRead(async () => {
                    await Store.saveImage(id, blob, "video");
                    return undefined;
                }, undefined);

                return URL.createObjectURL(blob);
            } finally {
                inFlightVideoFetches.delete(key);
            }
        })();

        inFlightVideoFetches.set(key, fetchPromise);
        return fetchPromise;
    },
};
