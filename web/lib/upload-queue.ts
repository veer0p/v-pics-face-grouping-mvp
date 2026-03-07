import type { FileMetadata } from "@/lib/upload-utils";

const DB_NAME = "v-pics-upload-queue-db";
const DB_VERSION = 1;
const STORE_ITEMS = "items";

export type UploadQueueStatus =
    | "pending_hash"
    | "queued_upload"
    | "uploading"
    | "uploaded"
    | "failed"
    | "duplicate_skipped";

export type UploadQueueItem = {
    local_id: string;
    user_id: string;
    file_blob: Blob;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
    taken_at: string | null;
    width: number | null;
    height: number | null;
    content_hash: string | null;
    metadata: FileMetadata;
    duration_ms: number | null;
    status: UploadQueueStatus;
    progress: number;
    error: string | null;
    attempts: number;
    last_attempt_at: string | null;
    server_photo_id: string | null;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            dbPromise = null;
            reject(request.error);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_ITEMS)) {
                const store = db.createObjectStore(STORE_ITEMS, { keyPath: "local_id" });
                store.createIndex("by_user", "user_id", { unique: false });
                store.createIndex("by_user_created", ["user_id", "created_at"], { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
    });

    return dbPromise;
}

function waitTx(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

export const UploadQueueStore = {
    async getUserItems(userId: string): Promise<UploadQueueItem[]> {
        const db = await openDB();
        const tx = db.transaction(STORE_ITEMS, "readonly");
        const store = tx.objectStore(STORE_ITEMS);
        const index = store.index("by_user");
        const range = IDBKeyRange.only(userId);
        const items: UploadQueueItem[] = [];

        await new Promise<void>((resolve, reject) => {
            const request = index.openCursor(range);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) {
                    resolve();
                    return;
                }
                items.push(cursor.value as UploadQueueItem);
                cursor.continue();
            };
        });

        await waitTx(tx);

        return items.sort((a, b) => {
            const aTime = new Date(a.created_at).getTime();
            const bTime = new Date(b.created_at).getTime();
            return bTime - aTime;
        });
    },

    async putItem(item: UploadQueueItem): Promise<void> {
        const db = await openDB();
        const tx = db.transaction(STORE_ITEMS, "readwrite");
        tx.objectStore(STORE_ITEMS).put(item);
        await waitTx(tx);
    },

    async putItems(items: UploadQueueItem[]): Promise<void> {
        if (items.length === 0) return;
        const db = await openDB();
        const tx = db.transaction(STORE_ITEMS, "readwrite");
        const store = tx.objectStore(STORE_ITEMS);
        for (const item of items) {
            store.put(item);
        }
        await waitTx(tx);
    },

    async deleteItem(localId: string): Promise<void> {
        const db = await openDB();
        const tx = db.transaction(STORE_ITEMS, "readwrite");
        tx.objectStore(STORE_ITEMS).delete(localId);
        await waitTx(tx);
    },

    async deleteItems(localIds: string[]): Promise<void> {
        if (localIds.length === 0) return;
        const db = await openDB();
        const tx = db.transaction(STORE_ITEMS, "readwrite");
        const store = tx.objectStore(STORE_ITEMS);
        for (const id of localIds) {
            store.delete(id);
        }
        await waitTx(tx);
    },
};
