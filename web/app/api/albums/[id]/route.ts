import { NextRequest, NextResponse } from "next/server";
import { deleteAlbum, getAlbumInfo, updateAlbumInfo } from "@immich/sdk";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { mapAssetToPhoto, toImmichError, initImmich } from "@/lib/immich-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    initImmich();
    const album = await getAlbumInfo({ id, withoutAssets: false });

    return NextResponse.json({
      album: {
        id: album.id,
        name: album.albumName,
        count: album.assetCount || 0,
        coverUrl: album.albumThumbnailAssetId
          ? `/api/media/${album.albumThumbnailAssetId}/thumbnail`
          : null,
        createdAt: album.createdAt,
      },
      photos: (album.assets || []).map(mapAssetToPhoto),
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    initImmich();
    await deleteAlbum({ id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const name = String(body?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    initImmich();
    const updated = await updateAlbumInfo({ id, updateAlbumDto: { albumName: name } });

    return NextResponse.json({
      album: {
        id: updated.id,
        name: updated.albumName,
        count: updated.assetCount || 0,
        coverUrl: updated.albumThumbnailAssetId
          ? `/api/media/${updated.albumThumbnailAssetId}/thumbnail`
          : null,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
