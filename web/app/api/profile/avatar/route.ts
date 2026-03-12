import { NextRequest, NextResponse } from "next/server";
import { createProfileImage, deleteProfileImage, getMyUser, getProfileImage } from "@immich/sdk";
import { getReadUrl } from "@/lib/r2";
import { isAvatarObjectKey } from "@/lib/avatar";
import { createServiceClient, getAuthenticatedProfile } from "@/lib/supabase-server";
import { initImmich, toImmichError } from "@/lib/immich-server";

const MAX_AVATAR_SIZE = 8 * 1024 * 1024;
const CACHE_CONTROL = "private, max-age=300";

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);

    // Backward compatibility for previously stored R2 object keys.
    const key = searchParams.get("key");
    if (key) {
      if (!isAvatarObjectKey(key)) return new Response("Invalid avatar key", { status: 400 });

      const signedUrl = await getReadUrl(key, 300);
      const response = await fetch(signedUrl);
      if (!response.ok) return new Response("Avatar not found", { status: response.status });

      const blob = await response.blob();
      return new NextResponse(blob, {
        status: 200,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "image/webp",
          "Cache-Control": CACHE_CONTROL,
        },
      });
    }

    initImmich();
    const me = await getMyUser();
    const blob = await getProfileImage({ id: me.id });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": blob.type || "image/jpeg",
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error) {
    const { status, message } = toImmichError(error);
    if (status === 400 || status === 404) {
      // Immich can respond 400/404 when no profile image is set.
      return new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "private, max-age=60" },
      });
    }
    console.error("[PROFILE][AVATAR][GET] failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing avatar file" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Avatar must be an image" }, { status: 400 });
    }
    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json({ error: "Avatar is too large (max 8MB)" }, { status: 400 });
    }

    initImmich();
    const uploaded = await createProfileImage({ createProfileImageDto: { file } });
    const cacheBust = uploaded.profileChangedAt || String(Date.now());
    const avatarUrl = `/api/profile/avatar?v=${encodeURIComponent(cacheBust)}`;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("users")
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id, full_name, avatar_url")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to persist avatar URL" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: data.id,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
      },
    });
  } catch (error) {
    const { status, message } = toImmichError(error);
    console.error("[PROFILE][AVATAR][POST] failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    initImmich();
    await deleteProfileImage().catch(() => null);

    const supabase = createServiceClient();
    await supabase
      .from("users")
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = toImmichError(error);
    console.error("[PROFILE][AVATAR][DELETE] failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
