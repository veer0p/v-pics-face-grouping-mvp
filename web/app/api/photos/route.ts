import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { mapAssetToPhoto, searchTimeline, toImmichError } from "@/lib/immich-server";

function toInt(input: string | null, fallback: number) {
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

function computeHash(ids: string[], total: number) {
  return createHash("sha1").update(`${total}:${ids.join(",")}`).digest("hex");
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const limit = Math.min(toInt(url.searchParams.get("limit"), 40), 200);
    const offset = toInt(url.searchParams.get("offset"), 0);
    const page = Math.floor(offset / limit) + 1;
    const requestedHash = url.searchParams.get("hash") || "";

    const response = await searchTimeline({ page, size: limit, withExif: true });
    const assets = response.assets?.items || [];
    const total = Number(response.assets?.total || assets.length || 0);
    const hash = computeHash(
      assets.slice(0, Math.min(20, assets.length)).map((asset) => `${asset.id}:${asset.updatedAt}`),
      total,
    );

    const photos = assets.map(mapAssetToPhoto);
    const match = offset === 0 && !!requestedHash && requestedHash === hash;

    return NextResponse.json({ photos, total, hash, match });
  } catch (err) {
    const { status, message } = toImmichError(err);
    console.error("[API][PHOTOS] fetch failed:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
