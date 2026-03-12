import { NextRequest, NextResponse } from "next/server";
import { createAlbum, getAllAlbums } from "@immich/sdk";
import { initImmich, toImmichError } from "@/lib/immich-server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";

export async function GET() {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    initImmich();
    const albums = await getAllAlbums({ shared: false });

    const mapped = (albums || []).map((album) => ({
      id: album.id,
      name: album.albumName,
      count: album.assetCount || 0,
      coverUrl: album.albumThumbnailAssetId
        ? `/api/media/${album.albumThumbnailAssetId}/thumbnail`
        : null,
      createdAt: album.createdAt,
    }));

    return NextResponse.json({ albums: mapped });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const name = String(body?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    initImmich();
    const created = await createAlbum({ createAlbumDto: { albumName: name } });

    return NextResponse.json({
      album: {
        id: created.id,
        name: created.albumName,
        count: created.assetCount || 0,
        coverUrl: created.albumThumbnailAssetId
          ? `/api/media/${created.albumThumbnailAssetId}/thumbnail`
          : null,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
