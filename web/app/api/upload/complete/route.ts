import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { parseCompleteUploadPayload } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseCompleteUploadPayload(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid completion payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { jobId, objectPaths } = parsed.data;

  const { error: markError } = await supabase.rpc("rpc_mark_uploads_complete", {
    p_job_id: jobId,
    p_object_paths: objectPaths,
  });
  if (markError) {
    return NextResponse.json({ error: markError.message }, { status: 500 });
  }

  const { error: queueError } = await supabase.rpc("rpc_enqueue_job", {
    p_job_id: jobId,
  });
  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  return NextResponse.json({ status: "queued" });
}
