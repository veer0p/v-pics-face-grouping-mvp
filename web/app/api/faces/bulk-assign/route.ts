import { NextRequest, NextResponse } from "next/server";
import { reassignFacesById } from "@immich/sdk";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { initImmich, toImmichError } from "@/lib/immich-server";

function unique(values: string[]) {
  return Array.from(new Set(values));
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const personId = String(body?.personId || "").trim();
    const faceIds = unique(
      Array.isArray(body?.faceIds)
        ? body.faceIds
          .map((value: unknown) => String(value || "").trim())
          .filter((value: string) => !!value)
        : [],
    );

    if (!personId) return NextResponse.json({ error: "Missing personId" }, { status: 400 });
    if (!faceIds.length) return NextResponse.json({ error: "Missing faceIds" }, { status: 400 });

    initImmich();
    const results = await Promise.allSettled(
      faceIds.map((faceId) => reassignFacesById({ id: personId, faceDto: { id: faceId } })),
    );

    const failed: Array<{ faceId: string; error: string }> = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const { message } = toImmichError(result.reason);
        failed.push({ faceId: faceIds[index], error: message });
      }
    });

    return NextResponse.json({
      ok: failed.length === 0,
      assigned: faceIds.length - failed.length,
      failed,
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
