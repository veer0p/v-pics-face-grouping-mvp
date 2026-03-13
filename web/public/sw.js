const CACHE_NAME = "vpics-static-v2";
const STATIC_ASSETS = [
    "/manifest.json",
    "/icon-512.png",
];

function isRuntimeStaticAsset(pathname) {
    if (pathname.startsWith("/_next/static/")) return true;
    return /\.(?:css|js|mjs|png|jpg|jpeg|webp|avif|svg|ico|woff|woff2)$/i.test(pathname);
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((names) => (
            Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
        )),
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) return;
    if (event.request.mode === "navigate") return;
    if (requestUrl.pathname.startsWith("/api/")) return;
    if (!isRuntimeStaticAsset(requestUrl.pathname) && !STATIC_ASSETS.includes(requestUrl.pathname)) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetched = fetch(event.request).then((response) => {
                if (response && response.status === 200 && response.type === "basic") {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached);

            return cached || fetched;
        }).catch(() => fetch(event.request)),
    );
});
