/**
 * CachedImage.tsx
 * Component that renders an image from the Cache API or fetches and caches it if missing.
 */

import React, { useEffect, useState } from "react";
import { ImageBlobCache } from "@/lib/photo-cache";
import { Loader } from "lucide-react";

type CachedImageProps = {
    src: string;
    alt: string;
    className?: string;
    style?: React.CSSProperties;
    loading?: "lazy" | "eager";
};

export function CachedImage({ src, alt, className, style, loading = "lazy" }: CachedImageProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;

        async function loadImage() {
            try {
                const url = await ImageBlobCache.fetchAndCache(src);
                if (isMounted) setBlobUrl(url);
            } catch (err) {
                console.warn("[CachedImage] Caching failed, falling back to network direct.", err);
                if (isMounted) {
                    setError(true);
                    // Fallback to direct src if caching fails (e.g. storage full)
                    setBlobUrl(src);
                }
            }
        }

        loadImage();

        return () => {
            isMounted = false;
        };
    }, [src]);

    if (!blobUrl && !error) {
        return (
            <div className={`flex items-center justify-center bg-gray-100/50 animate-pulse ${className}`} style={style}>
                <Loader className="w-5 h-5 text-gray-300 animate-spin" />
            </div>
        );
    }

    return (
        <img
            src={blobUrl || src}
            alt={alt}
            className={className}
            style={style}
            loading={loading}
            onError={() => setError(true)}
        />
    );
}
