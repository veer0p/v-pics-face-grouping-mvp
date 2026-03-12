import {
  AssetMediaSize,
  AssetOrder,
  AssetTypeEnum,
  getAssetInfo,
  getAssetOriginalPath,
  getAssetPlaybackPath,
  getAssetThumbnailPath,
  getPeopleThumbnailPath,
  init,
  isHttpError,
  searchAssets,
  type AssetResponseDto,
  type MetadataSearchDto,
} from "@immich/sdk";

type NormalizedPhoto = {
  id: string;
  url: string;
  thumbUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  thumbWidth: number | null;
  thumbHeight: number | null;
  isLiked: boolean;
  takenAt: string | null;
  createdAt: string;
  contentHash: string | null;
  mediaType: "image" | "video";
  durationMs: number | null;
};

function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const hasApiPrefix = /\/api$/i.test(trimmed);
  return hasApiPrefix ? trimmed : `${trimmed}/api`;
}

function toIso(input: string | number | Date): string {
  return new Date(input).toISOString();
}

export function parseDurationMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;

  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.round(numeric * 1000);
  }

  const parts = text.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const [a, b, c] = parts.length === 3 ? parts : ["0", parts[0], parts[1]];
  const secParts = c.split(".");
  const hours = Number(a);
  const minutes = Number(b);
  const seconds = Number(secParts[0]);
  const millis = Number((secParts[1] || "0").slice(0, 3).padEnd(3, "0"));
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    !Number.isFinite(millis)
  ) {
    return null;
  }
  return Math.max(0, ((hours * 3600 + minutes * 60 + seconds) * 1000) + millis);
}

function inferMimeType(asset: AssetResponseDto): string {
  if (asset.originalMimeType) return asset.originalMimeType;
  return asset.type === AssetTypeEnum.Video ? "video/mp4" : "image/jpeg";
}

function normalizeTakenAt(asset: AssetResponseDto): string | null {
  return asset.exifInfo?.dateTimeOriginal || asset.fileCreatedAt || null;
}

export function mapAssetToPhoto(asset: AssetResponseDto): NormalizedPhoto {
  const mediaType = asset.type === AssetTypeEnum.Video ? "video" : "image";
  return {
    id: asset.id,
    url: mediaType === "video"
      ? `/api/media/${asset.id}/playback`
      : `/api/media/${asset.id}/preview`,
    thumbUrl: `/api/media/${asset.id}/thumbnail`,
    filename: asset.originalFileName || `${asset.id}.${mediaType === "video" ? "mp4" : "jpg"}`,
    mimeType: inferMimeType(asset),
    sizeBytes: Number(asset.exifInfo?.fileSizeInByte || 0),
    width: asset.width ?? null,
    height: asset.height ?? null,
    thumbWidth: null,
    thumbHeight: null,
    isLiked: !!asset.isFavorite,
    takenAt: normalizeTakenAt(asset),
    createdAt: asset.createdAt,
    contentHash: asset.checksum || null,
    mediaType,
    durationMs: parseDurationMs(asset.duration),
  };
}

export function mapAssetToPhotoDetail(asset: AssetResponseDto) {
  const base = mapAssetToPhoto(asset);
  const mediaType = asset.type === AssetTypeEnum.Video ? "video" : "image";
  return {
    ...base,
    url: mediaType === "video"
      ? `/api/media/${asset.id}/playback`
      : `/api/media/${asset.id}/original`,
    thumbUrl: `/api/media/${asset.id}/preview`,
    blurhash: asset.thumbhash ?? null,
    cameraMake: asset.exifInfo?.make ?? null,
    cameraModel: asset.exifInfo?.model ?? null,
    lensModel: asset.exifInfo?.lensModel ?? null,
    focalLength: asset.exifInfo?.focalLength ?? null,
    aperture: asset.exifInfo?.fNumber ?? null,
    iso: asset.exifInfo?.iso ?? null,
    shutterSpeed: asset.exifInfo?.exposureTime ?? null,
    gpsLat: asset.exifInfo?.latitude ?? null,
    gpsLng: asset.exifInfo?.longitude ?? null,
    orientation: asset.exifInfo?.orientation ?? null,
    exifRaw: asset.exifInfo ?? null,
  };
}

export function getImmichConfig() {
  const baseUrl = normalizeBaseUrl(mustEnv("IMMICH_BASE_URL"));
  const apiKey = mustEnv("IMMICH_API_KEY");
  return { baseUrl, apiKey };
}

export function initImmich() {
  const { baseUrl, apiKey } = getImmichConfig();
  init({ baseUrl, apiKey });
  return { baseUrl, apiKey };
}

export function getImmichHeaders(extra?: HeadersInit): HeadersInit {
  const { apiKey } = getImmichConfig();
  return { "x-api-key": apiKey, ...(extra || {}) };
}

export function getImmichMediaPath(assetId: string, variant: string): string {
  if (variant === "original") return getAssetOriginalPath(assetId);
  if (variant === "playback") return getAssetPlaybackPath(assetId);
  if (variant === "preview") {
    return `${getAssetThumbnailPath(assetId)}?size=${AssetMediaSize.Preview}`;
  }
  return `${getAssetThumbnailPath(assetId)}?size=${AssetMediaSize.Thumbnail}`;
}

export function getImmichPersonThumbPath(personId: string): string {
  return getPeopleThumbnailPath(personId);
}

export async function searchTimeline({
  page,
  size,
  withExif = true,
  personIds,
}: {
  page: number;
  size: number;
  withExif?: boolean;
  personIds?: string[];
}) {
  initImmich();
  const metadataSearchDto: MetadataSearchDto = {
    page,
    size,
    order: AssetOrder.Desc,
    withExif,
    withPeople: false,
    withDeleted: false,
  };
  if (personIds?.length) {
    metadataSearchDto.personIds = personIds;
  }
  return searchAssets({ metadataSearchDto });
}

export async function getImmichAssetById(id: string) {
  initImmich();
  return getAssetInfo({ id });
}

export function toImmichError(err: unknown): { status: number; message: string } {
  if (isHttpError(err)) {
    return {
      status: err.status,
      message: err.data?.message || err.data?.error || `Immich error (${err.status})`,
    };
  }
  return {
    status: 500,
    message: err instanceof Error ? err.message : "Unexpected Immich error",
  };
}

export function toUploadDate(value: string | null | undefined, fallback: Date): string {
  if (!value) return fallback.toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback.toISOString();
  return toIso(date);
}
