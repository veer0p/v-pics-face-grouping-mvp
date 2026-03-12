import { NextRequest, NextResponse } from "next/server";
import { uploadAsset } from "@immich/sdk";
import {
  initImmich,
  mapAssetToPhotoDetail,
  parseDurationMs,
  toImmichError,
  toUploadDate,
  getImmichAssetById,
} from "@/lib/immich-server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";

function ensureMediaFile(value: FormDataEntryValue | null): File | null {
  if (!(value instanceof File)) return null;
  if (!value.type.startsWith("image/") && !value.type.startsWith("video/")) return null;
  return value;
}

function buildDeviceAssetId(file: File) {
  return `vpics_${file.lastModified}_${file.size}_${file.name}`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const single = ensureMediaFile(form.get("file"));
    const many = form
      .getAll("files")
      .map((value) => ensureMediaFile(value))
      .filter((value): value is File => !!value);

    const files = single ? [single] : many;
    if (files.length === 0) {
      return NextResponse.json({ error: "No valid media file provided" }, { status: 400 });
    }

    const takenAt = String(form.get("takenAt") || form.get("taken_at") || "").trim() || null;
    const durationRaw = String(form.get("durationMs") || form.get("duration_ms") || "").trim() || null;
    const createdAtRaw = String(form.get("createdAt") || "").trim() || null;

    initImmich();

    const uploaded: Array<{ id: string; status: string; photo: unknown }> = [];

    for (const file of files) {
      const now = new Date();
      const fileCreatedAt = toUploadDate(takenAt || createdAtRaw, now);
      const fileModifiedAt = toUploadDate(file.lastModified ? new Date(file.lastModified).toISOString() : null, now);
      const rawDurationNumber = durationRaw ? Number(durationRaw) : NaN;
      const durationMs = Number.isFinite(rawDurationNumber) && rawDurationNumber > 0
        ? Math.floor(rawDurationNumber)
        : parseDurationMs(durationRaw);

      const result = await uploadAsset({
        assetMediaCreateDto: {
          assetData: file,
          deviceId: "vpics-web",
          deviceAssetId: buildDeviceAssetId(file),
          fileCreatedAt,
          fileModifiedAt,
          filename: file.name,
          duration: durationMs ? String(durationMs / 1000) : undefined,
        },
      });

      const asset = await getImmichAssetById(result.id);
      uploaded.push({
        id: result.id,
        status: result.status,
        photo: mapAssetToPhotoDetail(asset),
      });
    }

    if (single) {
      return NextResponse.json({ photo: uploaded[0].photo, status: uploaded[0].status });
    }

    return NextResponse.json({ uploaded, count: uploaded.length });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export const maxDuration = 120;
