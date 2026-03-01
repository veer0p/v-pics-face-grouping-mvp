/**
 * Photo Cache Utility
 * Reduces B2 Class B transactions by:
 * 1. Caching photo metadata (including signed URLs) in localStorage.
 * 2. Caching actual image blobs in the browser's Cache API.
 */

const METADATA_CACHE_KEY = "v_pics_photo_metadata";
const METADATA_HASH_KEY = "v_pics_metadata_hash";
const METADATA_EXPIRY_MS = 50 * 60 * 1000; // 50 minutes (Signed URLs last 1 hour)
const IMAGE_CACHE_NAME = "v-pics-image-cache-v1";

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

type CacheEntry = {
    photos: Photo[];
    timestamp: number;
    offset: number;
};

/**
 * Metadata Caching (localStorage)
 */
export const PhotoMetadataCache = {
    getMetadataHash(): string | null {
        if (typeof window === "undefined") return null;
        return localStorage.getItem(METADATA_HASH_KEY);
    },

    async calculateHash(photos: Photo[]): Promise<string> {
        if (typeof window === "undefined" || !window.crypto?.subtle) return "";
        // Use top 40 photo IDs for robust comparison
        const ids = photos.slice(0, 40).map(p => p.id).join(",");
        const msgUint8 = new TextEncoder().encode(ids);
        const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    },

    get(offset: number): Photo[] | null {
        if (typeof window === "undefined") return null;
        try {
            const raw = localStorage.getItem(`${METADATA_CACHE_KEY}_${offset}`);
            if (!raw) return null;

            const entry: CacheEntry = JSON.parse(raw);
            const now = Date.now();

            // If the metadata is older than 50 mins, it's expired (signed URLs might be invalid)
            if (now - entry.timestamp > METADATA_EXPIRY_MS) {
                console.log(`[Cache] Metadata expired for offset ${offset}.`);
                localStorage.removeItem(`${METADATA_CACHE_KEY}_${offset}`);
                return null;
            }

            console.info(`[Cache] Metadata HIT for offset ${offset}. (Zero B2/Supabase calls)`);
            return entry.photos;
        } catch (err) {
            console.error("[Cache] Failed to read metadata cache:", err);
            return null;
        }
    },

    async set(offset: number, photos: Photo[]) {
        if (typeof window === "undefined") return;
        try {
            const entry: CacheEntry = {
                photos,
                timestamp: Date.now(),
                offset,
            };
            localStorage.setItem(`${METADATA_CACHE_KEY}_${offset}`, JSON.stringify(entry));

            // If this is the first page, update the hash of the top 40 IDs
            if (offset === 0 && photos.length > 0) {
                const hash = await this.calculateHash(photos);
                localStorage.setItem(METADATA_HASH_KEY, hash);
            }
        } catch (err) {
            console.warn("[Cache] Failed to write metadata cache (Storage full?):", err);
        }
    },

    updatePhoto(updatedPhoto: Photo) {
        if (typeof window === "undefined") return;
        // Iterate through all cached offsets and update the photo if found
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(METADATA_CACHE_KEY)) {
                try {
                    const raw = localStorage.getItem(key);
                    if (!raw) continue;
                    const entry: CacheEntry = JSON.parse(raw);
                    const index = entry.photos.findIndex(p => p.id === updatedPhoto.id);
                    if (index !== -1) {
                        entry.photos[index] = updatedPhoto;
                        localStorage.setItem(key, JSON.stringify(entry));
                    }
                } catch (e) { /* ignore */ }
            }
        }
    },

    clear() {
        if (typeof window === "undefined") return;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith(METADATA_CACHE_KEY)) {
                localStorage.removeItem(key);
            }
        }
    }
};

/**
 * Image Blob Caching (Cache API)
 */
export const ImageBlobCache = {
    async get(url: string): Promise<string | null> {
        if (typeof window === "undefined" || !window.caches) return null;
        try {
            const cache = await caches.open(IMAGE_CACHE_NAME);
            const response = await cache.match(url);
            if (!response) return null;

            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (err) {
            console.error("[Cache] Failed to read image from Cache API:", err);
            return null;
        }
    },

    async set(url: string, blob: Blob) {
        if (typeof window === "undefined" || !window.caches) return;
        try {
            const cache = await caches.open(IMAGE_CACHE_NAME);
            const response = new Response(blob, {
                headers: {
                    'Content-Type': blob.type,
                    'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
                }
            });
            await cache.put(url, response);
        } catch (err) {
            console.warn("[Cache] Failed to write image to Cache API:", err);
        }
    },

    async fetchAndCache(url: string): Promise<string> {
        // 1. Try Cache API first
        const cachedUrl = await this.get(url);
        if (cachedUrl) {
            console.log(`[B2-Save] Image served from local Cache API. (Zero B2 bandwidth used)`);
            return cachedUrl;
        }

        // 2. Fetch from network
        console.warn(`[B2-Fetch] Cache MISS. Fetching image from Backblaze B2...`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
        const blob = await res.blob();

        // 3. Store in Cache API
        await this.set(url, blob);

        // 4. Return Object URL
        return URL.createObjectURL(blob);
    }
};
