import { NextRequest, NextResponse } from "next/server";
import { searchAssets, searchPerson, searchSmart } from "@immich/sdk";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { initImmich, mapAssetToPhoto, toImmichError } from "@/lib/immich-server";

function toInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const query = String(url.searchParams.get("q") || "").trim();
    if (!query) {
      return NextResponse.json({ photos: [], people: [], total: 0, smartSearchAvailable: false });
    }

    const page = toInt(url.searchParams.get("page"), 1);
    const size = Math.min(toInt(url.searchParams.get("limit"), 80), 200);

    initImmich();

    let smartAssets: ReturnType<typeof mapAssetToPhoto>[] = [];
    let smartAvailable = true;
    try {
      const smart = await searchSmart({
        smartSearchDto: { query, page, size, withExif: true },
      });
      smartAssets = (smart.assets?.items || []).map(mapAssetToPhoto);
    } catch {
      smartAvailable = false;
    }

    const metadata = await searchAssets({
      metadataSearchDto: {
        page,
        size,
        withExif: true,
        withPeople: true,
        ocr: query,
        originalFileName: query,
        description: query,
      },
    });

    const metadataPhotos = (metadata.assets?.items || []).map(mapAssetToPhoto);
    const merged = new Map<string, ReturnType<typeof mapAssetToPhoto>>();
    for (const item of [...smartAssets, ...metadataPhotos]) {
      if (!merged.has(item.id)) merged.set(item.id, item);
    }

    const people = await searchPerson({ name: query, withHidden: false }).catch(() => []);

    return NextResponse.json({
      query,
      smartSearchAvailable: smartAvailable,
      total: Number(metadata.assets?.total || merged.size),
      photos: Array.from(merged.values()),
      people: (people || []).map((person, index) => {
        const safeName = String(person.name || "").trim() || `Person ${index + 1}`;
        return {
          id: person.id,
          name: safeName,
          isFavorite: !!person.isFavorite,
          thumbnailUrl: `/api/people/${person.id}/thumbnail`,
        };
      }),
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
