import { NextResponse } from "next/server";
import { restoreAssets, restoreTrash } from "@immich/sdk";
import { initImmich, toImmichError } from "@/lib/immich-server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const all = !!body?.all;
    const ids = Array.isArray(body?.ids) ? body.ids.map((id: unknown) => String(id)) : [];

    initImmich();

    if (all) {
      await restoreTrash();
      return NextResponse.json({ ok: true, restored: "all" });
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    await restoreAssets({ bulkIdsDto: { ids } });
    return NextResponse.json({ ok: true, restored: ids.length });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
