import { NextResponse } from "next/server";
import { AssetOrder, searchAssets } from "@immich/sdk";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { getImmichConfig, getImmichHeaders, getImmichMediaPath, getImmichPersonThumbPath, initImmich } from "@/lib/immich-server";

function toPixel(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  if (value >= 0 && value <= 1 && max > 1) return Math.round(value * max);
  return Math.round(value);
}

async function buildFallbackFaceThumb(personId: string) {
  initImmich();
  const result = await searchAssets({
    metadataSearchDto: {
      page: 1,
      size: 40,
      order: AssetOrder.Desc,
      withDeleted: false,
      withPeople: true,
      withExif: false,
      personIds: [personId],
    },
  });

  const assets = result.assets?.items || [];
  if (!assets.length) return null;

  const assetWithFace = assets.find((asset) => {
    const person = asset.people?.find((entry) => entry.id === personId);
    return !!person?.faces?.length;
  }) || assets[0];

  const person = assetWithFace.people?.find((entry) => entry.id === personId);
  const face = person?.faces?.[0];

  const { baseUrl } = getImmichConfig();
  const previewRes = await fetch(`${baseUrl}${getImmichMediaPath(assetWithFace.id, "preview")}`, {
    headers: getImmichHeaders(),
  });
  if (!previewRes.ok) return null;
  const previewContentType = previewRes.headers.get("content-type") || "image/jpeg";
  const previewBuffer = Buffer.from(await previewRes.arrayBuffer());

  if (!face) {
    return { buffer: previewBuffer, contentType: previewContentType };
  }

  try {
    const sharp = (await import("sharp")).default;
    const image = sharp(previewBuffer);
    const meta = await image.metadata();
    const imgW = Number(meta.width || assetWithFace.width || face.imageWidth || 0);
    const imgH = Number(meta.height || assetWithFace.height || face.imageHeight || 0);
    if (!imgW || !imgH) return { buffer: previewBuffer, contentType: previewContentType };

    const faceRefW = Number(face.imageWidth || imgW);
    const faceRefH = Number(face.imageHeight || imgH);
    const x1 = toPixel(face.boundingBoxX1, faceRefW);
    const x2 = toPixel(face.boundingBoxX2, faceRefW);
    const y1 = toPixel(face.boundingBoxY1, faceRefH);
    const y2 = toPixel(face.boundingBoxY2, faceRefH);

    const rawX = Math.min(x1, x2);
    const rawY = Math.min(y1, y2);
    const rawW = Math.max(1, Math.abs(x2 - x1));
    const rawH = Math.max(1, Math.abs(y2 - y1));

    const scaleX = faceRefW > 0 ? imgW / faceRefW : 1;
    const scaleY = faceRefH > 0 ? imgH / faceRefH : 1;

    let cx = Math.round(rawX * scaleX);
    let cy = Math.round(rawY * scaleY);
    let cw = Math.round(rawW * scaleX);
    let ch = Math.round(rawH * scaleY);

    // Add margin around the face to make person chips look natural.
    const marginX = Math.round(cw * 0.35);
    const marginY = Math.round(ch * 0.45);
    cx -= marginX;
    cy -= marginY;
    cw += marginX * 2;
    ch += marginY * 2;

    cx = Math.max(0, Math.min(cx, imgW - 1));
    cy = Math.max(0, Math.min(cy, imgH - 1));
    cw = Math.max(1, Math.min(cw, imgW - cx));
    ch = Math.max(1, Math.min(ch, imgH - cy));

    const cropped = await sharp(previewBuffer)
      .extract({ left: cx, top: cy, width: cw, height: ch })
      .resize(320, 320, { fit: "cover" })
      .webp({ quality: 88 })
      .toBuffer();

    return { buffer: cropped, contentType: "image/webp" };
  } catch {
    return { buffer: previewBuffer, contentType: previewContentType };
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const { baseUrl } = getImmichConfig();
    const upstream = await fetch(`${baseUrl}${getImmichPersonThumbPath(id)}`, {
      headers: getImmichHeaders(),
    });

    if (!upstream.ok) {
      const fallback = await buildFallbackFaceThumb(id);
      if (!fallback) {
        return NextResponse.json(
          { error: `Immich people thumbnail request failed (${upstream.status})` },
          { status: upstream.status || 502 },
        );
      }
      return new NextResponse(new Uint8Array(fallback.buffer), {
        status: 200,
        headers: {
          "content-type": fallback.contentType,
          "cache-control": "private, max-age=300",
        },
      });
    }

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set("cache-control", "private, max-age=300");

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    console.error("[API][PEOPLE] thumbnail failed:", error);
    return NextResponse.json({ error: "Failed to fetch thumbnail" }, { status: 500 });
  }
}
