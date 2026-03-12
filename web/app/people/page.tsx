"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader, Upload, Users } from "lucide-react";
import type { Photo } from "@/lib/photo-cache";

type PersonItem = {
  id: string;
  name: string;
  thumbnailUrl: string;
  isFavorite?: boolean;
  isHidden?: boolean;
};

type PersonDetails = {
  person: PersonItem & { birthDate?: string | null };
  stats: { assets: number };
};

type UnassignedFace = {
  faceId: string;
  assetId: string;
  filename: string;
  assetThumbUrl: string;
  assetPreviewUrl: string;
  assetWidth: number | null;
  assetHeight: number | null;
  imageWidth: number;
  imageHeight: number;
  boundingBox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  sourceType: string | null;
};

function normalizePercent(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(max) || max <= 0) return Math.max(0, Math.min(value * 100, 100));
  if (value >= 0 && value <= 1) return value * 100;
  return (value / max) * 100;
}

function buildFaceBoxStyle(face: UnassignedFace) {
  const maxW = Math.max(1, face.imageWidth);
  const maxH = Math.max(1, face.imageHeight);
  const x1 = normalizePercent(face.boundingBox.x1, maxW);
  const y1 = normalizePercent(face.boundingBox.y1, maxH);
  const x2 = normalizePercent(face.boundingBox.x2, maxW);
  const y2 = normalizePercent(face.boundingBox.y2, maxH);
  return {
    left: `${Math.max(0, Math.min(x1, x2))}%`,
    top: `${Math.max(0, Math.min(y1, y2))}%`,
    width: `${Math.max(1, Math.abs(x2 - x1))}%`,
    height: `${Math.max(1, Math.abs(y2 - y1))}%`,
  };
}

export default function PeoplePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPersonIdParam = searchParams.get("personId");

  const [people, setPeople] = useState<PersonItem[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<PersonDetails | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosTotal, setPhotosTotal] = useState(0);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingPersonData, setLoadingPersonData] = useState(false);

  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [merging, setMerging] = useState(false);

  const [unassignedFaces, setUnassignedFaces] = useState<UnassignedFace[]>([]);
  const [selectedFaceIds, setSelectedFaceIds] = useState<string[]>([]);
  const [bulkPersonId, setBulkPersonId] = useState("");
  const [loadingUnassigned, setLoadingUnassigned] = useState(true);
  const [assigningFaces, setAssigningFaces] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedPersonId) || null,
    [people, selectedPersonId],
  );
  const viewerContextIds = useMemo(() => photos.map((photo) => photo.id), [photos]);

  const clearAlerts = () => {
    setMessage(null);
    setError(null);
  };

  const loadPeople = useCallback(async () => {
    setLoadingPeople(true);
    clearAlerts();
    try {
      const res = await fetch("/api/people?size=300");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to load people"));

      const next = Array.isArray(data?.people) ? (data.people as PersonItem[]) : [];
      setPeople(next);

      setSelectedPersonId((prev) => {
        const preferred = selectedPersonIdParam && next.some((item) => item.id === selectedPersonIdParam)
          ? selectedPersonIdParam
          : null;
        if (preferred) return preferred;
        if (prev && next.some((item) => item.id === prev)) return prev;
        return next[0]?.id || null;
      });

      setBulkPersonId((prev) => prev || next[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load people");
    } finally {
      setLoadingPeople(false);
    }
  }, [selectedPersonIdParam]);

  const loadUnassigned = useCallback(async () => {
    setLoadingUnassigned(true);
    try {
      const res = await fetch("/api/faces/unassigned?limit=80");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to load unassigned faces"));
      const nextFaces = Array.isArray(data?.faces) ? (data.faces as UnassignedFace[]) : [];
      setUnassignedFaces(nextFaces);
      setSelectedFaceIds((prev) => prev.filter((id) => nextFaces.some((face) => face.faceId === id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load unassigned faces");
    } finally {
      setLoadingUnassigned(false);
    }
  }, []);

  useEffect(() => {
    void loadPeople();
    void loadUnassigned();
  }, [loadPeople, loadUnassigned]);

  useEffect(() => {
    if (!selectedPersonId) {
      setSelectedDetails(null);
      setPhotos([]);
      setPhotosTotal(0);
      return;
    }

    let cancelled = false;
    const loadPersonData = async () => {
      setLoadingPersonData(true);
      clearAlerts();
      try {
        const [detailRes, photosRes] = await Promise.all([
          fetch(`/api/people/${selectedPersonId}`),
          fetch(`/api/people/${selectedPersonId}/photos?limit=120&offset=0`),
        ]);

        const detailData = await detailRes.json().catch(() => ({}));
        const photosData = await photosRes.json().catch(() => ({}));
        if (!detailRes.ok) throw new Error(String(detailData?.error || "Failed to load person details"));
        if (!photosRes.ok) throw new Error(String(photosData?.error || "Failed to load person photos"));

        if (cancelled) return;
        setSelectedDetails(detailData as PersonDetails);
        setNameDraft(String(detailData?.person?.name || ""));
        setPhotos(Array.isArray(photosData?.photos) ? photosData.photos : []);
        setPhotosTotal(Number(photosData?.total || 0));
        setBulkPersonId((prev) => prev || selectedPersonId);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load person data");
      } finally {
        if (!cancelled) setLoadingPersonData(false);
      }
    };

    void loadPersonData();
    return () => {
      cancelled = true;
    };
  }, [selectedPersonId]);

  const savePersonName = async () => {
    if (!selectedPersonId || savingName) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setError("Name cannot be empty");
      return;
    }
    if (trimmed === (selectedDetails?.person?.name || "").trim()) {
      setMessage("Name is already up to date.");
      return;
    }

    setSavingName(true);
    clearAlerts();
    try {
      const res = await fetch(`/api/people/${selectedPersonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to update person"));

      setPeople((prev) => prev.map((person) => (
        person.id === selectedPersonId ? { ...person, name: data.person?.name || trimmed } : person
      )));
      setSelectedDetails((prev) => prev ? {
        ...prev,
        person: {
          ...prev.person,
          name: data.person?.name || trimmed,
        },
      } : prev);
      setMessage("Person renamed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update person");
    } finally {
      setSavingName(false);
    }
  };

  const mergeIntoSelected = async () => {
    if (!selectedPersonId || !mergeSourceId || mergeSourceId === selectedPersonId || merging) return;

    setMerging(true);
    clearAlerts();
    try {
      const res = await fetch(`/api/people/${selectedPersonId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIds: [mergeSourceId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to merge people"));

      setMergeSourceId("");
      setMessage("People merged.");
      await Promise.all([loadPeople(), loadUnassigned()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge people");
    } finally {
      setMerging(false);
    }
  };

  const toggleFace = (faceId: string) => {
    setSelectedFaceIds((prev) => (
      prev.includes(faceId) ? prev.filter((id) => id !== faceId) : [...prev, faceId]
    ));
  };

  const assignFaces = async (faceIds: string[]) => {
    if (!faceIds.length || assigningFaces) return;
    const targetPersonId = bulkPersonId || selectedPersonId;
    if (!targetPersonId) {
      setError("Select a target person first.");
      return;
    }

    setAssigningFaces(true);
    clearAlerts();
    try {
      const res = await fetch("/api/faces/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: targetPersonId, faceIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to assign faces"));

      const assigned = Number(data?.assigned || 0);
      const failedCount = Array.isArray(data?.failed) ? data.failed.length : 0;
      setMessage(failedCount ? `Assigned ${assigned}; ${failedCount} failed.` : `Assigned ${assigned} face(s).`);
      setSelectedFaceIds((prev) => prev.filter((id) => !faceIds.includes(id)));
      await Promise.all([loadUnassigned(), loadPeople()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign faces");
    } finally {
      setAssigningFaces(false);
    }
  };

  return (
    <div className="page-shell">
      <div style={{ marginBottom: "1.1rem" }}>
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
          Manage names, merges, and unassigned faces
        </p>
      </div>

      {error && (
        <div className="panel" style={{ marginBottom: "0.8rem", borderColor: "var(--error)", color: "var(--error)" }}>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <span>{error}</span>
            <button
              className="btn btn-secondary btn-sm"
              style={{ width: "fit-content" }}
              onClick={() => {
                void loadPeople();
                void loadUnassigned();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}
      {message && (
        <div className="panel" style={{ marginBottom: "0.8rem", color: "var(--ink-2)" }}>
          {message}
        </div>
      )}

      {loadingPeople ? (
        <div className="empty-state" style={{ minHeight: 220 }}>
          <Loader size={28} className="spin" color="var(--accent)" />
        </div>
      ) : people.length === 0 ? (
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
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(106px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
            {people.map((person) => {
              const active = selectedPersonId === person.id;
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setSelectedPersonId(person.id)}
                  style={{
                    border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
                    borderRadius: "var(--r-md)",
                    background: "var(--bg-elevated)",
                    padding: "0.5rem",
                    display: "grid",
                    gap: "0.45rem",
                    textAlign: "left",
                  }}
                >
                  <img
                    src={person.thumbnailUrl}
                    alt={person.name}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "var(--r-sm)" }}
                  />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {person.name}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="panel" style={{ marginBottom: "1rem", display: "grid", gap: "0.75rem" }}>
            <p className="section-heading">Person Manager</p>

            {loadingPersonData ? (
              <div className="empty-state" style={{ minHeight: 120 }}>
                <Loader size={22} className="spin" color="var(--accent)" />
              </div>
            ) : selectedPerson ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "86px minmax(0,1fr)", gap: "0.8rem", alignItems: "center" }}>
                  <img
                    src={selectedPerson.thumbnailUrl}
                    alt={selectedPerson.name}
                    style={{ width: 86, height: 86, borderRadius: "var(--r-md)", objectFit: "cover", border: "1px solid var(--line)" }}
                  />
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    <p style={{ fontWeight: 700 }}>{selectedDetails?.person.name || selectedPerson.name}</p>
                    <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                      Assets: {selectedDetails?.stats.assets ?? photosTotal}
                    </p>
                    <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                      Recent loaded: {photos.length}
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "0.55rem" }}>
                  <input
                    className="input"
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    placeholder="Rename person"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void savePersonName();
                    }}
                  />
                  <button className="btn btn-primary" onClick={savePersonName} disabled={savingName || !nameDraft.trim()}>
                    {savingName ? <Loader size={14} className="spin" /> : "Save Name"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "0.55rem" }}>
                  <select className="input" value={mergeSourceId} onChange={(event) => setMergeSourceId(event.target.value)}>
                    <option value="">Select duplicate person to merge into this</option>
                    {people.filter((person) => person.id !== selectedPersonId).map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-secondary" onClick={mergeIntoSelected} disabled={merging || !mergeSourceId}>
                    {merging ? <Loader size={14} className="spin" /> : "Merge"}
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="panel" style={{ marginBottom: "1rem", display: "grid", gap: "0.7rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <p className="section-heading">Unassigned Faces Inbox</p>
              <button className="btn btn-ghost btn-sm" onClick={() => void loadUnassigned()} disabled={loadingUnassigned || assigningFaces}>
                Refresh
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "0.55rem" }}>
              <select className="input" value={bulkPersonId} onChange={(event) => setBulkPersonId(event.target.value)}>
                <option value="">Choose target person</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={() => void assignFaces(selectedFaceIds)}
                disabled={assigningFaces || !bulkPersonId || selectedFaceIds.length === 0}
              >
                {assigningFaces ? <Loader size={14} className="spin" /> : `Assign Selected (${selectedFaceIds.length})`}
              </button>
            </div>

            {loadingUnassigned ? (
              <div className="empty-state" style={{ minHeight: 140 }}>
                <Loader size={22} className="spin" color="var(--accent)" />
              </div>
            ) : unassignedFaces.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No unassigned faces right now.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "0.65rem" }}>
                {unassignedFaces.map((face, index) => {
                  const checked = selectedFaceIds.includes(face.faceId);
                  return (
                    <div key={face.faceId} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "0.45rem", display: "grid", gap: "0.45rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.78rem", color: "var(--muted)", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFace(face.faceId)}
                        />
                        Face #{index + 1}
                      </label>

                      <div style={{ position: "relative", borderRadius: "var(--r-sm)", overflow: "hidden", border: "1px solid var(--line)" }}>
                        <img src={face.assetThumbUrl} alt={face.filename} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                        <div
                          style={{
                            position: "absolute",
                            border: "2px solid var(--accent)",
                            background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                            pointerEvents: "none",
                            ...buildFaceBoxStyle(face),
                          }}
                        />
                      </div>

                      <p style={{ fontSize: "0.74rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {face.filename}
                      </p>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => router.push(`/photo/${face.assetId}`)}
                        >
                          Open
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void assignFaces([face.faceId])}
                          disabled={assigningFaces || !bulkPersonId}
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {loadingPersonData ? (
            <div className="empty-state" style={{ minHeight: 160 }}>
              <Loader size={22} className="spin" color="var(--accent)" />
            </div>
          ) : photos.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 170 }}>
              <p className="empty-state-title">No photos for this person</p>
            </div>
          ) : (
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
