import { NextResponse } from "next/server";
import { getAssetStatistics, getServerStatistics, getStorage, searchLargeAssets } from "@immich/sdk";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { initImmich, toImmichError } from "@/lib/immich-server";

export async function GET() {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    initImmich();

    const [activeStats, trashStats, favoriteStats, serverStats, storage] = await Promise.all([
      getAssetStatistics({ isTrashed: false }),
      getAssetStatistics({ isTrashed: true }),
      getAssetStatistics({ isFavorite: true, isTrashed: false }),
      getServerStatistics(),
      getStorage(),
    ]);

    let trashBytes = 0;
    try {
      const trashedAssets = await searchLargeAssets({
        size: 500,
        withDeleted: true,
        withExif: true,
        trashedAfter: "1970-01-01T00:00:00.000Z",
      });
      trashBytes = (trashedAssets || []).reduce(
        (sum, asset) => sum + Number(asset.exifInfo?.fileSizeInByte || 0),
        0,
      );
    } catch {
      trashBytes = 0;
    }

    return NextResponse.json({
      totalPhotos: Number(activeStats.total || 0),
      totalBytes: Number(serverStats.usage || 0),
      trashCount: Number(trashStats.total || 0),
      trashBytes,
      favoriteCount: Number(favoriteStats.total || 0),
      imageCount: Number(activeStats.images || 0),
      videoCount: Number(activeStats.videos || 0),
      storage: {
        diskSizeRaw: Number(storage.diskSizeRaw || 0),
        diskUseRaw: Number(storage.diskUseRaw || 0),
        diskAvailableRaw: Number(storage.diskAvailableRaw || 0),
        diskUsagePercentage: Number(storage.diskUsagePercentage || 0),
      },
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
