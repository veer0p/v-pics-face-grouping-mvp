import { NextResponse } from "next/server";
import type { InitUploadResponse, UploadDescriptor } from "@/types/api";
import { createServiceClient } from "@/lib/supabase-server";
import { parseInitUploadPayload } from "@/lib/validators";

export const runtime = "nodejs";

type JobImageRow = {
  id: string;
  object_path: string;
};

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseInitUploadPayload(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid upload payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { files, config } = parsed.data;

  const { data: jobId, error: createError } = await supabase.rpc("rpc_create_job", {
    p_files: files,
    p_config: config ?? {},
  });
  if (createError || !jobId) {
    return NextResponse.json(
      { error: createError?.message ?? "Failed to create job." },
      { status: 500 },
    );
  }

  const { data: imageRows, error: imageError } = await supabase
    .from("job_images")
    .select("id,object_path")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (imageError || !imageRows) {
    return NextResponse.json(
      { error: imageError?.message ?? "Failed to fetch job image rows." },
      { status: 500 },
    );
  }

  const uploads: UploadDescriptor[] = [];
  for (const row of imageRows as JobImageRow[]) {
    const { data, error } = await supabase.storage
      .from("photo-originals")
      .createSignedUploadUrl(row.object_path);
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create signed upload URL." },
        { status: 500 },
      );
    }
    uploads.push({
      imageId: row.id,
      objectPath: row.object_path,
      signedUploadUrl: data.signedUrl,
      token: data.token,
    });
  }

  const response: InitUploadResponse = {
    jobId,
    uploads,
  };
  return NextResponse.json(response);
}
