import { NextRequest, NextResponse } from "next/server";
import { removeAssetFromAlbum } from "@immich/sdk";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { initImmich, toImmichError } from "@/lib/immich-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: albumId } = await params;
    const body = await req.json().catch(() => ({}));
    const photoIds = Array.isArray(body?.photoIds) ? body.photoIds.map((id: unknown) => String(id)) : [];

    if (photoIds.length === 0) {
      return NextResponse.json({ error: "No photoIds provided" }, { status: 400 });
    }

    initImmich();
    await removeAssetFromAlbum({ id: albumId, bulkIdsDto: { ids: photoIds } });

    return NextResponse.json({ ok: true, removed: photoIds.length });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
