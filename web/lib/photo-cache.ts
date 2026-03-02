/**
 * Smart Photo Cache Utility (IndexedDB + 2GB Quota)
 * 1. Caches photo metadata with server-side hash validation.
 * 2. Caches thumbnails (500MB) and full-size images (1.5GB) separately.
 * 3. Implements LRU eviction to maintain quota.
 */

const DB_NAME = "v-pics-vault-db";
const DB_VERSION = 5;

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
};

// Quotas in bytes
const THUMB_QUOTA = 500 * 1024 * 1024; // 500 MB
const FULL_QUOTA = 1500 * 1024 * 1024; // 1.5 GB

class IndexedDBStore {
    private db: IDBDatabase | null = null;
    private dbPromise: Promise<IDBDatabase> | null = null;

    async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            console.info(`🔑 Opening DB v${DB_VERSION}...`);
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => {
                console.error("❌ [Cache] Open DB error:", request.error);
                this.dbPromise = null;
                reject(request.error);
            };
            request.onblocked = () => {
                console.warn("⚠️ [Cache] DB open blocked. Please close other tabs.");
            };
            request.onsuccess = () => {
                this.db = request.result;
                this.dbPromise = null;
                // Double check stores
                if (!this.db.objectStoreNames.contains("details")) {
                    console.warn("⚠️ [Cache] 'details' store missing, might need higher version.");
                } else {
                    console.info("✅ [Cache] IndexedDB Ready (v5)");
                }
                resolve(this.db);
            };
            request.onupgradeneeded = (e) => {
                const db = (e.target as IDBOpenDBRequest).result;
                // Metadata Store
                if (!db.objectStoreNames.contains("metadata")) {
                    db.createObjectStore("metadata", { keyPath: "offset" });
                }
                // Image Blob Store
                if (!db.objectStoreNames.contains("images")) {
                    const store = db.createObjectStore("images", { keyPath: "key" });
                    store.createIndex("by_category", "category", { unique: false });
                    store.createIndex("by_timestamp", "timestamp", { unique: false });
                } else if (e.oldVersion < 2) {
                    // Migration: Re-create store with stable keyPath
                    db.deleteObjectStore("images");
                    const store = db.createObjectStore("images", { keyPath: "key" });
                    store.createIndex("by_category", "category", { unique: false });
                    store.createIndex("by_timestamp", "timestamp", { unique: false });
                }
                // Global Settings (Hash, etc.)
                if (!db.objectStoreNames.contains("settings")) {
                    db.createObjectStore("settings");
                }
                // Photo Details (Single photo EXIF/Metadata)
                if (!db.objectStoreNames.contains("details")) {
                    db.createObjectStore("details", { keyPath: "id" });
                }
            };
        });
        return this.dbPromise;
    }

    async setSetting(key: string, value: any) {
        const db = await this.getDB();
        const tx = db.transaction("settings", "readwrite");
        tx.objectStore("settings").put(value, key);
        return new Promise((res) => tx.oncomplete = res);
    }

    async getSetting(key: string): Promise<any> {
        const db = await this.getDB();
        const tx = db.transaction("settings", "readonly");
        return new Promise((res) => {
            const req = tx.objectStore("settings").get(key);
            req.onsuccess = () => res(req.result);
        });
    }

    async saveMetadata(offset: number, photos: Photo[]) {
        const db = await this.getDB();
        const tx = db.transaction("metadata", "readwrite");
        tx.objectStore("metadata").put({ offset, photos, timestamp: Date.now() });
    }

    async getMetadata(offset: number): Promise<Photo[] | null> {
        const db = await this.getDB();
        const tx = db.transaction("metadata", "readonly");
        return new Promise((res) => {
            const req = tx.objectStore("metadata").get(offset);
            req.onsuccess = () => res(req.result?.photos || null);
        });
    }

    async clearMetadata() {
        const db = await this.getDB();
        const tx = db.transaction("metadata", "readwrite");
        tx.objectStore("metadata").clear();
    }

    async saveImage(id: string, blob: Blob, category: 'thumb' | 'full') {
        const db = await this.getDB();
        const key = `${category}:${id}`;
        // 1. Check/Evict if needed
        await this.evictIfNeeded(category, blob.size);

        const tx = db.transaction("images", "readwrite");
        tx.objectStore("images").put({
            key,
            id,
            blob,
            size: blob.size,
            category,
            timestamp: Date.now()
        });
    }

    async getImage(id: string, category: 'thumb' | 'full'): Promise<Blob | null> {
        const db = await this.getDB();
        const key = `${category}:${id}`;
        const tx = db.transaction("images", "readwrite");
        const store = tx.objectStore("images");
        return new Promise((res) => {
            const req = store.get(key);
            req.onsuccess = () => {
                const data = req.result;
                if (data) {
                    // Update timestamp for LRU
                    data.timestamp = Date.now();
                    store.put(data);
                    res(data.blob);
                } else {
                    res(null);
                }
            };
        });
    }

    private async evictIfNeeded(category: 'thumb' | 'full', newSize: number) {
        const quota = category === 'thumb' ? THUMB_QUOTA : FULL_QUOTA;
        const db = await this.getDB();

        let currentUsage = await this.getCategoryUsage(category);

        if (currentUsage + newSize <= quota) return;

        console.warn(`[Cache] Quota exceeded for ${category}. Evicting...`);

        // LRU Eviction
        const tx = db.transaction("images", "readwrite");
        const store = tx.objectStore("images");
        const index = store.index("by_timestamp");
        const cursorRequest = index.openCursor();

        return new Promise<void>((resolve) => {
            cursorRequest.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
                if (!cursor || currentUsage + newSize <= quota) {
                    resolve();
                    return;
                }

                const item = cursor.value;
                if (item.category === category) {
                    currentUsage -= item.size;
                    cursor.delete();
                }
                cursor.continue();
            };
        });
    }

    private async getCategoryUsage(category: 'thumb' | 'full'): Promise<number> {
        const db = await this.getDB();
        const tx = db.transaction("images", "readonly");
        const store = tx.objectStore("images");
        const index = store.index("by_category");
        let total = 0;

        return new Promise((resolve) => {
            const request = index.openCursor(IDBKeyRange.only(category));
            request.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    total += cursor.value.size;
                    cursor.continue();
                } else {
                    resolve(total);
                }
            };
        });
    }
}

const Store = new IndexedDBStore();

/**
 * Metadata Caching
 */
export const PhotoMetadataCache = {
    async getHash(): Promise<string | null> {
        if (typeof window === "undefined") return null;
        return await Store.getSetting("photo_hash");
    },

    async setHash(hash: string) {
        if (typeof window === "undefined") return;
        await Store.setSetting("photo_hash", hash);
    },

    async get(offset: number): Promise<Photo[] | null> {
        if (typeof window === "undefined") return null;
        const photos = await Store.getMetadata(offset);
        if (photos) console.info(`✅ Cached (Metadata [${offset}])`);
        return photos;
    },

    async set(offset: number, photos: Photo[]) {
        if (typeof window === "undefined") return;
        await Store.saveMetadata(offset, photos);
    },

    async clear() {
        if (typeof window === "undefined") return;
        await Store.clearMetadata();
    }
};

/**
 * Individual Photo Detail Caching (EXIF, Camera, etc.)
 * Uses In-Memory + IndexedDB hybrid.
 */
const inMemoryDetails = new Map<string, any>();
const inFlightFetches = new Map<string, Promise<any>>();

export const PhotoDetailCache = {
    async get(id: string): Promise<any | null> {
        if (typeof window === "undefined") return null;

        // 1. Memory Check
        if (inMemoryDetails.has(id)) {
            console.info(`⚡ [Memory] Hit (details:${id.slice(0, 8)})`);
            return inMemoryDetails.get(id);
        }

        // 2. In-flight Check (Deduplication)
        if (inFlightFetches.has(id)) {
            return inFlightFetches.get(id);
        }

        try {
            const db = await Store.getDB();
            const tx = db.transaction("details", "readonly");
            const store = tx.objectStore("details");
            return new Promise((res) => {
                const req = store.get(id);
                req.onsuccess = () => {
                    const data = req.result?.data || null;
                    if (data) {
                        console.info(`✅ [Cache] Hit (details:${id.slice(0, 8)})`);
                        inMemoryDetails.set(id, data);
                    } else {
                        console.warn(`⏳ [Cache] Miss (details:${id.slice(0, 8)})`);
                    }
                    res(data);
                };
                req.onerror = () => res(null);
            });
        } catch (err) {
            return null;
        }
    },

    async set(id: string, data: any) {
        if (typeof window === "undefined") return;
        inMemoryDetails.set(id, data);
        try {
            const db = await Store.getDB();
            const tx = db.transaction("details", "readwrite");
            tx.objectStore("details").put({ id, data, timestamp: Date.now() });
            tx.oncomplete = () => console.info(`💾 [Cache] Saved (details:${id.slice(0, 8)})`);
        } catch (err) { }
    },

    async fetchAndCache(id: string): Promise<any> {
        if (typeof window === "undefined") return null;

        // 1. Try Cache
        const cached = await this.get(id);
        if (cached) return cached;

        // 2. Try In-flight
        if (inFlightFetches.has(id)) {
            console.info(`🔗 [Cache] Joining in-flight fetch (id:${id.slice(0, 8)})`);
            return inFlightFetches.get(id);
        }

        // 3. Network Fetch
        console.warn(`📡 [Network] Fetching details... (id:${id.slice(0, 8)})`);
        const fetchPromise = (async () => {
            try {
                const res = await fetch(`/api/photos/${id}`);
                if (!res.ok) throw new Error("Not found");
                const data = await res.json();
                await this.set(id, data.photo);
                return data.photo;
            } catch (err) {
                console.error(`❌ [Network] Failed to fetch:`, err);
                throw err;
            } finally {
                inFlightFetches.delete(id);
            }
        })();

        inFlightFetches.set(id, fetchPromise);
        return fetchPromise;
    },

    async delete(id: string) {
        if (typeof window === "undefined") return;
        inMemoryDetails.delete(id);
        try {
            const db = await Store.getDB();
            const tx = db.transaction("details", "readwrite");
            tx.objectStore("details").delete(id);
        } catch (err) { }
    },

    async clear() {
        if (typeof window === "undefined") return;
        inMemoryDetails.clear();
        try {
            const db = await Store.getDB();
            const tx = db.transaction("details", "readwrite");
            tx.objectStore("details").clear();
        } catch (err) { }
    }
};

/**
 * Image Blob Caching
 */
const inFlightImageFetches = new Map<string, Promise<string>>();

export const ImageBlobCache = {
    async get(id: string, category: 'thumb' | 'full'): Promise<string | null> {
        if (typeof window === "undefined") return null;
        const blob = await Store.getImage(id, category);
        if (!blob) return null;
        return URL.createObjectURL(blob);
    },

    async fetchAndCache(id: string, url: string, category: 'thumb' | 'full' = 'full', signal?: AbortSignal): Promise<string> {
        if (typeof window === "undefined") return url;

        const key = `${category}:${id}`;

        // 1. Try DB first
        const cachedUrl = await this.get(id, category);
        if (cachedUrl) {
            return cachedUrl;
        }

        // 2. Dedup: join in-flight fetch if one exists
        if (inFlightImageFetches.has(key)) {
            return inFlightImageFetches.get(key)!;
        }

        // 3. Fetch from network (proxy B2 URLs to bypass CORS)
        console.warn(`📡 [Network] Fetching ${category}... (id:${id.slice(0, 8)})`);

        const fetchPromise = (async () => {
            try {
                let fetchUrl = url;
                if (url.includes('backblazeb2.com')) {
                    fetchUrl = `/api/photos/proxy?url=${encodeURIComponent(url)}`;
                }

                const res = await fetch(fetchUrl, { signal });
                if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
                const blob = await res.blob();

                // 4. Store in DB
                await Store.saveImage(id, blob, category);

                // 5. Return Object URL
                return URL.createObjectURL(blob);
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    console.debug(`🛑 [Cache] Fetch aborted (${key})`);
                }
                throw err;
            } finally {
                inFlightImageFetches.delete(key);
            }
        })();

        inFlightImageFetches.set(key, fetchPromise);
        return fetchPromise;
    }
};
