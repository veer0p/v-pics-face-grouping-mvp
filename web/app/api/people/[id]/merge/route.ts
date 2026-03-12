import { NextRequest, NextResponse } from "next/server";
import { mergePerson } from "@immich/sdk";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { initImmich, toImmichError } from "@/lib/immich-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: targetPersonId } = await params;
    const body = await req.json().catch(() => ({}));

    const sourceIds = Array.isArray(body?.sourceIds)
      ? body.sourceIds
        .map((value: unknown) => String(value || "").trim())
        .filter((value: string) => !!value && value !== targetPersonId)
      : [];

    if (!sourceIds.length) {
      return NextResponse.json({ error: "sourceIds is required" }, { status: 400 });
    }

    initImmich();
    const merged = await mergePerson({
      id: targetPersonId,
      mergePersonDto: { ids: sourceIds },
    });

    return NextResponse.json({
      ok: true,
      mergedCount: Array.isArray(merged) ? merged.length : sourceIds.length,
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
