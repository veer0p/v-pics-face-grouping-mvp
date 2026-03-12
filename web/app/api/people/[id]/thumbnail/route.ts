import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { getImmichConfig, getImmichHeaders, getImmichPersonThumbPath } from "@/lib/immich-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const { baseUrl } = getImmichConfig();
    const upstream = await fetch(`${baseUrl}${getImmichPersonThumbPath(id)}`, {
      headers: getImmichHeaders(),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Immich people thumbnail request failed (${upstream.status})` },
        { status: upstream.status || 502 },
      );
    }

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set("cache-control", "private, max-age=300");

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    console.error("[API][PEOPLE] thumbnail failed:", error);
    return NextResponse.json({ error: "Failed to fetch thumbnail" }, { status: 500 });
  }
}
