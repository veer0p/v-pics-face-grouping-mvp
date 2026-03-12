import { NextRequest, NextResponse } from "next/server";
import { deleteFace, reassignFacesById } from "@immich/sdk";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { initImmich, toImmichError } from "@/lib/immich-server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ faceId: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { faceId } = await params;
    const body = await req.json().catch(() => ({}));
    const personId = String(body?.personId || "").trim();
    if (!personId) return NextResponse.json({ error: "Missing personId" }, { status: 400 });

    initImmich();
    const person = await reassignFacesById({
      id: personId,
      faceDto: { id: faceId },
    });

    return NextResponse.json({
      ok: true,
      person: {
        id: person.id,
        name: person.name,
      },
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ faceId: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { faceId } = await params;
    const body = await req.json().catch(() => ({}));
    const force = body?.force !== false;

    initImmich();
    await deleteFace({
      id: faceId,
      assetFaceDeleteDto: { force },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
