import { NextResponse } from "next/server";
import type { ClusterGroup, FaceInGroup, JobResultResponse, JobSummary } from "@/types/api";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RpcGroup = {
  cluster_id: string;
  cluster_label: number;
  face_count: number;
  preview_crop_path: string | null;
};

type RpcFace = {
  face_id: string;
  cluster_id: string | null;
  cluster_label: number;
  det_score: number;
  crop_path: string | null;
  source_image_path: string | null;
};

type RpcPayload = {
  job: {
    id: string;
    status: "draft" | "queued" | "processing" | "completed" | "failed";
    stats: Record<string, number>;
    error_message: string | null;
  } | null;
  groups: RpcGroup[];
  faces: RpcFace[];
};

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

async function createSignedUrlOrNull(
  path: string | null,
  bucket: "photo-originals" | "face-crops",
): Promise<string | null> {
  if (!path) {
    return null;
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 15);
  if (error || !data) {
    return null;
  }
  return data.signedUrl;
}

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: "Missing job id." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("rpc_get_job_result", {
    p_job_id: jobId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || !(data as RpcPayload).job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const rpcPayload = data as RpcPayload;
  const job: JobSummary = {
    id: rpcPayload.job!.id,
    status: rpcPayload.job!.status,
    stats: rpcPayload.job!.stats ?? {},
    errorMessage: rpcPayload.job!.error_message,
  };

  const groups: ClusterGroup[] = [];
  for (const group of rpcPayload.groups ?? []) {
    const previewUrl = await createSignedUrlOrNull(group.preview_crop_path, "face-crops");
    groups.push({
      clusterId: group.cluster_id,
      clusterLabel: group.cluster_label,
      faceCount: group.face_count,
      previewUrl,
    });
  }

  const facesByGroup: Record<string, FaceInGroup[]> = {};
  for (const face of rpcPayload.faces ?? []) {
    if (!face.cluster_id) {
      continue;
    }
    const cropUrl = await createSignedUrlOrNull(face.crop_path, "face-crops");
    const sourceImageUrl = await createSignedUrlOrNull(face.source_image_path, "photo-originals");
    const normalized: FaceInGroup = {
      faceId: face.face_id,
      clusterId: face.cluster_id,
      clusterLabel: face.cluster_label,
      detScore: Number(face.det_score ?? 0),
      cropUrl,
      sourceImageUrl,
    };
    if (!facesByGroup[face.cluster_id]) {
      facesByGroup[face.cluster_id] = [];
    }
    facesByGroup[face.cluster_id].push(normalized);
  }

  const response: JobResultResponse = {
    job,
    groups,
    facesByGroup,
  };
  return NextResponse.json(response);
}
