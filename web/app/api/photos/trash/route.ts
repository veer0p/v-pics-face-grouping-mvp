import { NextResponse } from "next/server";
import { AssetOrder, searchAssets } from "@immich/sdk";
import { initImmich, mapAssetToPhoto, toImmichError } from "@/lib/immich-server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";

function toInt(input: string | null, fallback: number) {
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

export async function GET(req: Request) {
  const user = await getAuthenticatedProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(toInt(url.searchParams.get("limit"), 80), 250);
  const offset = toInt(url.searchParams.get("offset"), 0);
  const page = Math.floor(offset / limit) + 1;

  initImmich();

  // Some Immich builds reject specific trash filters.
  // Try strict query first, then relaxed query.
  const attempts = [
    {
      page,
      size: limit,
      order: AssetOrder.Desc,
      withDeleted: true,
      withExif: true,
      trashedAfter: "1970-01-01T00:00:00.000Z",
    },
    {
      page,
      size: limit,
      order: AssetOrder.Desc,
      withDeleted: true,
      withExif: true,
    },
  ] as const;

  let lastError: unknown = null;
  for (const metadataSearchDto of attempts) {
    try {
      const response = await searchAssets({ metadataSearchDto });
      const items = response.assets?.items || [];
      const trashed = items
        .filter((asset) => asset.isTrashed)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return NextResponse.json({
        photos: trashed.map(mapAssetToPhoto),
        total: Number(response.assets?.total || trashed.length),
        limit,
        offset,
        page,
      });
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    const { status, message } = toImmichError(lastError);
    console.error("[API][PHOTOS][TRASH] fallback to empty list:", { status, message });
  }

  // Return a degraded but non-failing response so UI keeps working.
  return NextResponse.json({
    photos: [],
    total: 0,
    limit,
    offset,
    page,
    degraded: true,
  });
}
