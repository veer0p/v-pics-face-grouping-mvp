import { NextRequest, NextResponse } from "next/server";
import { getPerson, getPersonStatistics, updatePerson } from "@immich/sdk";
import { getAuthenticatedProfile } from "@/lib/supabase-server";
import { initImmich, toImmichError } from "@/lib/immich-server";

function toSafeName(input: string | null | undefined, fallback = "Person") {
  const name = String(input || "").trim();
  return name || fallback;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    initImmich();
    const [person, stats] = await Promise.all([
      getPerson({ id }),
      getPersonStatistics({ id }).catch(() => ({ assets: 0 })),
    ]);

    return NextResponse.json({
      person: {
        id: person.id,
        name: toSafeName(person.name),
        isFavorite: !!person.isFavorite,
        isHidden: !!person.isHidden,
        birthDate: person.birthDate || null,
        thumbnailUrl: `/api/people/${person.id}/thumbnail`,
      },
      stats: {
        assets: Number(stats?.assets || 0),
      },
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const personUpdateDto: {
      name?: string;
      isHidden?: boolean;
      isFavorite?: boolean;
    } = {};

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      personUpdateDto.name = name;
    }
    if (typeof body?.isHidden === "boolean") {
      personUpdateDto.isHidden = body.isHidden;
    }
    if (typeof body?.isFavorite === "boolean") {
      personUpdateDto.isFavorite = body.isFavorite;
    }

    if (Object.keys(personUpdateDto).length === 0) {
      return NextResponse.json({ error: "No valid updates provided" }, { status: 400 });
    }

    initImmich();
    const person = await updatePerson({
      id,
      personUpdateDto,
    });

    return NextResponse.json({
      ok: true,
      person: {
        id: person.id,
        name: toSafeName(person.name),
        isFavorite: !!person.isFavorite,
        isHidden: !!person.isHidden,
        birthDate: person.birthDate || null,
        thumbnailUrl: `/api/people/${person.id}/thumbnail`,
      },
    });
  } catch (err) {
    const { status, message } = toImmichError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
