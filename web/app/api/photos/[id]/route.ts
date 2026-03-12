import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { getImmichAssetById, mapAssetToPhotoDetail, toImmichError } from "@/lib/immich-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const asset = await getImmichAssetById(id);

    return NextResponse.json({ photo: mapAssetToPhotoDetail(asset) });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
