"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader, Upload, Users } from "lucide-react";
import type { Photo } from "@/lib/photo-cache";

type PersonItem = {
  id: string;
  name: string;
  thumbnailUrl: string;
};

export default function PeoplePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPersonIdParam = searchParams.get("personId");
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonItem | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingPeople(true);
      try {
        const res = await fetch("/api/people?size=200");
        const data = await res.json();
        const next = Array.isArray(data?.people) ? data.people : [];
        setPeople(next);

        const preselected = next.find((item: PersonItem) => item.id === selectedPersonIdParam) || next[0] || null;
        setSelectedPerson(preselected);
      } catch (error) {
        console.error("[People] failed loading people", error);
      } finally {
        setLoadingPeople(false);
      }
    };
    void load();
  }, [selectedPersonIdParam]);

  useEffect(() => {
    if (!selectedPerson) {
      setPhotos([]);
      return;
    }

    const loadPhotos = async () => {
      setLoadingPhotos(true);
      try {
        const res = await fetch(`/api/people/${selectedPerson.id}/photos?limit=200&offset=0`);
        const data = await res.json();
        setPhotos(Array.isArray(data?.photos) ? data.photos : []);
      } catch (error) {
        console.error("[People] failed loading person photos", error);
      } finally {
        setLoadingPhotos(false);
      }
    };

    void loadPhotos();
  }, [selectedPerson]);

  const viewerContextIds = useMemo(() => photos.map((photo) => photo.id), [photos]);

  return (
    <div className="page-shell">
      <div style={{ marginBottom: "1.25rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          People
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.95rem", marginTop: "0.5rem" }}>
          Face groups from Immich
        </p>
      </div>

      {loadingPeople && (
        <div className="empty-state" style={{ minHeight: 220 }}>
          <Loader size={28} className="spin" color="var(--accent)" />
        </div>
      )}

      {!loadingPeople && people.length === 0 && (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div className="empty-state">
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "var(--r-lg)",
                background: "var(--accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={28} strokeWidth={1.5} color="var(--accent)" />
            </div>
            <p className="empty-state-title">No people yet</p>
            <p className="empty-state-sub">Upload media and let Immich face detection run.</p>
            <button className="btn btn-primary" onClick={() => router.push("/upload")}> 
              <Upload size={16} strokeWidth={2.5} /> Upload Photos
            </button>
          </div>
        </div>
      )}

      {people.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: "0.8rem", marginBottom: "1.1rem" }}>
            {people.map((person) => {
              const active = selectedPerson?.id === person.id;
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setSelectedPerson(person)}
                  style={{
                    border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
                    borderRadius: "var(--r-md)",
                    background: "var(--bg-elevated)",
                    padding: "0.55rem",
                    display: "grid",
                    gap: "0.5rem",
                    textAlign: "left",
                  }}
                >
                  <img
                    src={person.thumbnailUrl}
                    alt={person.name}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "var(--r-sm)" }}
                  />
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {person.name}
                  </span>
                </button>
              );
            })}
          </div>

          {loadingPhotos && (
            <div className="empty-state" style={{ minHeight: 160 }}>
              <Loader size={22} className="spin" color="var(--accent)" />
            </div>
          )}

          {!loadingPhotos && photos.length === 0 && (
            <div className="empty-state" style={{ minHeight: 180 }}>
              <p className="empty-state-title">No photos for this person</p>
            </div>
          )}

          {photos.length > 0 && (
            <div className="responsive-grid">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem("current_gallery_context", JSON.stringify(viewerContextIds));
                    router.push(`/photo/${photo.id}`);
                  }}
                  style={{ border: "none", background: "transparent", padding: 0, borderRadius: "var(--r-sm)", overflow: "hidden" }}
                >
                  <img
                    src={photo.thumbUrl || photo.url}
                    alt={photo.filename}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
