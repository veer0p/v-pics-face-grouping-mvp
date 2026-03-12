import { NextRequest, NextResponse } from "next/server";
import { createFace, getFaces } from "@immich/sdk";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { getImmichAssetById, initImmich, toImmichError } from "@/lib/immich-server";

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toPixel(value: number, max: number) {
  if (value >= 0 && value <= 1 && max > 1) {
    return Math.round(value * max);
  }
  return Math.round(value);
}

function mapFace(face: Awaited<ReturnType<typeof getFaces>>[number], index: number) {
  const personName = String(face.person?.name || "").trim() || (face.person?.id ? `Person ${index + 1}` : null);
  return {
    id: face.id,
    personId: face.person?.id || null,
    personName,
    personThumbnailUrl: face.person?.id ? `/api/people/${face.person.id}/thumbnail` : null,
    imageWidth: face.imageWidth,
    imageHeight: face.imageHeight,
    boundingBox: {
      x1: face.boundingBoxX1,
      y1: face.boundingBoxY1,
      x2: face.boundingBoxX2,
      y2: face.boundingBoxY2,
    },
    sourceType: face.sourceType || null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    initImmich();
    const faces = await getFaces({ id });

    return NextResponse.json({
      faces: (faces || []).map((face, index) => mapFace(face, index)),
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: assetId } = await params;
    const body = await req.json().catch(() => ({}));

    const personId = String(body?.personId || "").trim();
    if (!personId) return NextResponse.json({ error: "Missing personId" }, { status: 400 });

    let imageWidth = toNumber(body?.imageWidth);
    let imageHeight = toNumber(body?.imageHeight);

    if (!imageWidth || !imageHeight) {
      const asset = await getImmichAssetById(assetId);
      imageWidth = Number(asset.width || 0);
      imageHeight = Number(asset.height || 0);
    }

    if (!imageWidth || !imageHeight) {
      return NextResponse.json({ error: "Missing image dimensions" }, { status: 400 });
    }

    const x = toNumber(body?.x);
    const y = toNumber(body?.y);
    const width = toNumber(body?.width);
    const height = toNumber(body?.height);

    if (x === null || y === null || width === null || height === null) {
      return NextResponse.json({ error: "Missing face box values (x, y, width, height)" }, { status: 400 });
    }

    const safeImageWidth = Math.max(1, Math.round(imageWidth));
    const safeImageHeight = Math.max(1, Math.round(imageHeight));

    const rawX = toPixel(x, safeImageWidth);
    const rawY = toPixel(y, safeImageHeight);
    const rawWidth = toPixel(width, safeImageWidth);
    const rawHeight = toPixel(height, safeImageHeight);

    const safeX = Math.max(0, Math.min(rawX, safeImageWidth - 1));
    const safeY = Math.max(0, Math.min(rawY, safeImageHeight - 1));
    const safeWidth = Math.max(1, Math.min(rawWidth, safeImageWidth - safeX));
    const safeHeight = Math.max(1, Math.min(rawHeight, safeImageHeight - safeY));

    initImmich();
    await createFace({
      assetFaceCreateDto: {
        assetId,
        personId,
        x: safeX,
        y: safeY,
        width: safeWidth,
        height: safeHeight,
        imageWidth: safeImageWidth,
        imageHeight: safeImageHeight,
      },
    });

    const faces = await getFaces({ id: assetId });
    return NextResponse.json({
      ok: true,
      faces: (faces || []).map((face, index) => mapFace(face, index)),
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
