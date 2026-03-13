/**
 * CachedImage.tsx
 * Component that renders an image from the Cache API or fetches and caches it if missing.
 */

import React, { useEffect, useState } from "react";
import { ImageBlobCache } from "@/lib/photo-cache";
import { Loader } from "lucide-react";

type CachedImageProps = {
    id: string;
    src: string;
    alt: string;
    className?: string;
    style?: React.CSSProperties;
    loading?: "lazy" | "eager";
    category?: 'thumb' | 'full';
};

export function CachedImage({ id, src, alt, className, style, loading = "lazy", category = 'full' }: CachedImageProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let createdUrl: string | null = null;

        setBlobUrl(null);
        setError(false);

        async function loadImage() {
            try {
                const url = await ImageBlobCache.fetchAndCache(id, src, category);
                createdUrl = url.startsWith("blob:") ? url : null;
                if (isMounted) {
                    setBlobUrl(url);
                } else if (createdUrl) {
                    URL.revokeObjectURL(createdUrl);
                }
            } catch (err) {
                console.warn("[CachedImage] Caching failed, falling back to network direct.", err);
                if (isMounted) {
                    setError(true);
                    setBlobUrl(src);
                }
            }
        }

        loadImage();

        return () => {
            isMounted = false;
            if (createdUrl) {
                URL.revokeObjectURL(createdUrl);
            }
        };
    }, [category, id, src]);

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
            onError={() => {
                if (blobUrl?.startsWith("blob:")) {
                    URL.revokeObjectURL(blobUrl);
                }
                setError(true);
                setBlobUrl(src);
            }}
        />
    );
}
