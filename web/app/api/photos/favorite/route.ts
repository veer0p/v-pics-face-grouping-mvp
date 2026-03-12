import { NextRequest, NextResponse } from "next/server";
import { updateAsset } from "@immich/sdk";
import { initImmich, toImmichError } from "@/lib/immich-server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, liked } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    initImmich();
    await updateAsset({ id: String(id), updateAssetDto: { isFavorite: !!liked } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
