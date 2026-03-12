import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { getImmichConfig, getImmichHeaders, getImmichMediaPath } from "@/lib/immich-server";

const ALLOWED_VARIANTS = new Set(["thumbnail", "preview", "original", "playback"]);

function copyHeaders(source: Headers, target: Headers) {
  const keys = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
    "cache-control",
    "content-disposition",
  ];
  for (const key of keys) {
    const value = source.get(key);
    if (value) target.set(key, value);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string; variant: string }> },
) {
  const user = await getAuthenticatedProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId, variant } = await params;
  if (!ALLOWED_VARIANTS.has(variant)) {
    return NextResponse.json({ error: "Unsupported media variant" }, { status: 400 });
  }

  try {
    const { baseUrl } = getImmichConfig();
    const path = getImmichMediaPath(assetId, variant);
    const upstreamUrl = `${baseUrl}${path}`;
    const range = req.headers.get("range");
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: getImmichHeaders(range ? { range } : undefined),
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Immich media request failed (${upstream.status})` },
        { status: upstream.status || 502 },
      );
    }

    const headers = new Headers();
    copyHeaders(upstream.headers, headers);
    if (!headers.get("cache-control")) {
      headers.set("cache-control", "private, max-age=60");
    }
    if (!headers.get("accept-ranges")) {
      headers.set("accept-ranges", "bytes");
    }

    if (req.nextUrl.searchParams.get("download") === "1") {
      const fileName = req.nextUrl.searchParams.get("filename");
      if (fileName) {
        headers.set("content-disposition", `attachment; filename="${fileName.replace(/"/g, "")}"`);
      } else {
        headers.set("content-disposition", "attachment");
      }
    }

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    console.error("[API][MEDIA] stream failed:", error);
    return NextResponse.json({ error: "Failed to stream media" }, { status: 500 });
  }
}
