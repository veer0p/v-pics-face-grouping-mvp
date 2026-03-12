import { NextRequest, NextResponse } from "next/server";
import { deleteAssets } from "@immich/sdk";
import { initImmich, toImmichError } from "@/lib/immich-server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const ids = Array.isArray(body?.ids) ? body.ids.map((id: unknown) => String(id)) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    initImmich();

    const permanent = !!body?.permanent;
    await deleteAssets({ assetBulkDeleteDto: { ids, force: permanent } });

    return NextResponse.json({ ok: true, deleted: ids.length, permanent });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
