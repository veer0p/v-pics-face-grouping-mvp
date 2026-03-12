import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";

export async function POST() {
  const user = await getAuthenticatedProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Duplicate checks are handled by Immich during upload.
  return NextResponse.json({ existingHashes: [] });
}
