import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { mapAssetToPhoto, searchTimeline, toImmichError } from "@/lib/immich-server";

function toInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const url = new URL(req.url);
    const limit = Math.min(toInt(url.searchParams.get("limit"), 40), 200);
    const offset = toInt(url.searchParams.get("offset"), 0);
    const page = Math.floor(offset / limit) + 1;

    const response = await searchTimeline({
      page,
      size: limit,
      withExif: true,
      personIds: [id],
    });
    const photos = (response.assets?.items || []).map(mapAssetToPhoto);

    return NextResponse.json({
      photos,
      total: Number(response.assets?.total || photos.length),
      page,
      limit,
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
