import { NextRequest, NextResponse } from "next/server";
import { AssetOrder, searchAssets } from "@immich/sdk";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { initImmich, toImmichError } from "@/lib/immich-server";

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
    const limit = Math.min(toInt(url.searchParams.get("limit"), 60), 200);
    const pageSize = Math.min(toInt(url.searchParams.get("pageSize"), 80), 250);

    initImmich();

    let page = 1;
    let scannedAssets = 0;
    const faces: Array<{
      faceId: string;
      assetId: string;
      filename: string;
      assetThumbUrl: string;
      assetPreviewUrl: string;
      assetWidth: number | null;
      assetHeight: number | null;
      imageWidth: number;
      imageHeight: number;
      boundingBox: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      };
      sourceType: string | null;
    }> = [];

    while (faces.length < limit && page <= 20) {
      const response = await searchAssets({
        metadataSearchDto: {
          page,
          size: pageSize,
          order: AssetOrder.Desc,
          withDeleted: false,
          withPeople: true,
          withExif: false,
        },
      });

      const items = response.assets?.items || [];
      if (!items.length) break;
      scannedAssets += items.length;

      for (const asset of items) {
        const unassigned = asset.unassignedFaces || [];
        for (const face of unassigned) {
          faces.push({
            faceId: face.id,
            assetId: asset.id,
            filename: asset.originalFileName || asset.id,
            assetThumbUrl: `/api/media/${asset.id}/thumbnail`,
            assetPreviewUrl: `/api/media/${asset.id}/preview`,
            assetWidth: asset.width ?? null,
            assetHeight: asset.height ?? null,
            imageWidth: face.imageWidth,
            imageHeight: face.imageHeight,
            boundingBox: {
              x1: face.boundingBoxX1,
              y1: face.boundingBoxY1,
              x2: face.boundingBoxX2,
              y2: face.boundingBoxY2,
            },
            sourceType: face.sourceType || null,
          });
          if (faces.length >= limit) break;
        }
        if (faces.length >= limit) break;
      }

      if (items.length < pageSize) break;
      page += 1;
    }

    return NextResponse.json({
      faces,
      scannedAssets,
      total: faces.length,
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
