import { NextRequest, NextResponse } from "next/server";
import { createPerson, getAllPeople } from "@immich/sdk";
import { initImmich, toImmichError } from "@/lib/immich-server";
import { getAuthenticatedProfile } from "@/lib/supabase-server";

function toInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const page = toInt(url.searchParams.get("page"), 1);
    const size = Math.min(toInt(url.searchParams.get("size"), 100), 500);

    initImmich();
    const response = await getAllPeople({ page, size, withHidden: false });
    const people = (response.people || []).map((person, index) => {
      const fallbackIndex = ((page - 1) * size) + index + 1;
      const safeName = String(person.name || "").trim() || `Person ${fallbackIndex}`;
      return {
        id: person.id,
        name: safeName,
        isFavorite: !!person.isFavorite,
        isHidden: !!person.isHidden,
        thumbnailUrl: `/api/people/${person.id}/thumbnail`,
      };
    });

    return NextResponse.json({
      people,
      total: response.total || people.length,
      hidden: response.hidden || 0,
      hasNextPage: !!response.hasNextPage,
      page,
      size,
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Person name is required" }, { status: 400 });
    }

    initImmich();
    const person = await createPerson({ personCreateDto: { name } });
    return NextResponse.json({
      ok: true,
      person: {
        id: person.id,
        name: person.name || name,
        isFavorite: !!person.isFavorite,
        isHidden: !!person.isHidden,
        thumbnailUrl: `/api/people/${person.id}/thumbnail`,
      },
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
