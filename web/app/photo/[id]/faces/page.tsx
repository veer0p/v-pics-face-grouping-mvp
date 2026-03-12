"use client";
/* eslint-disable @next/next/no-img-element */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader, Trash2, UserPlus } from "lucide-react";

type PersonItem = {
  id: string;
  name: string;
  thumbnailUrl?: string;
};

type FaceItem = {
  id: string;
  personId: string | null;
  personName: string | null;
  personThumbnailUrl: string | null;
  sourceType?: string | null;
  imageWidth: number;
  imageHeight: number;
  boundingBox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
};

type AssetDetail = {
  id: string;
  filename: string;
  width: number | null;
  height: number | null;
  url: string;
  thumbUrl: string;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageMetrics = {
  renderWidth: number;
  renderHeight: number;
  naturalWidth: number;
  naturalHeight: number;
};

const MIN_BOX_SIZE = 12;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toDisplayRect(face: FaceItem, metrics: ImageMetrics): Rect {
  const sx = face.boundingBox.x1 <= 1 ? face.boundingBox.x1 * metrics.renderWidth : (face.boundingBox.x1 / Math.max(face.imageWidth, 1)) * metrics.renderWidth;
  const sy = face.boundingBox.y1 <= 1 ? face.boundingBox.y1 * metrics.renderHeight : (face.boundingBox.y1 / Math.max(face.imageHeight, 1)) * metrics.renderHeight;
  const ex = face.boundingBox.x2 <= 1 ? face.boundingBox.x2 * metrics.renderWidth : (face.boundingBox.x2 / Math.max(face.imageWidth, 1)) * metrics.renderWidth;
  const ey = face.boundingBox.y2 <= 1 ? face.boundingBox.y2 * metrics.renderHeight : (face.boundingBox.y2 / Math.max(face.imageHeight, 1)) * metrics.renderHeight;
  return {
    x: clamp(Math.min(sx, ex), 0, metrics.renderWidth),
    y: clamp(Math.min(sy, ey), 0, metrics.renderHeight),
    width: clamp(Math.abs(ex - sx), 0, metrics.renderWidth),
    height: clamp(Math.abs(ey - sy), 0, metrics.renderHeight),
  };
}

export default function PhotoFacesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [faces, setFaces] = useState<FaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>("Drag a box, select a person or type a new name, then save.");
  const [personId, setPersonId] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [nameDraftByFace, setNameDraftByFace] = useState<Record<string, string>>({});
  const [metrics, setMetrics] = useState<ImageMetrics | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [photoRes, peopleRes, facesRes] = await Promise.all([
        fetch(`/api/photos/${id}`),
        fetch("/api/people?size=300"),
        fetch(`/api/photos/${id}/faces`),
      ]);

      const photoData = await photoRes.json().catch(() => ({}));
      const peopleData = await peopleRes.json().catch(() => ({}));
      const facesData = await facesRes.json().catch(() => ({}));

      if (!photoRes.ok) throw new Error(String(photoData?.error || "Failed to load photo"));
      if (!peopleRes.ok) throw new Error(String(peopleData?.error || "Failed to load people"));
      if (!facesRes.ok) throw new Error(String(facesData?.error || "Failed to load faces"));

      const detail = photoData?.photo as AssetDetail;
      setAsset({
        id: detail.id,
        filename: detail.filename,
        width: detail.width,
        height: detail.height,
        url: detail.url,
        thumbUrl: detail.thumbUrl,
      });

      const peopleList: PersonItem[] = Array.isArray(peopleData?.people)
        ? (peopleData.people as Array<{ id: string; name?: string; thumbnailUrl?: string }>).map((person, index) => ({
            id: person.id,
            name: String(person.name || "").trim() || `Person ${index + 1}`,
            thumbnailUrl: person.thumbnailUrl || (person.id ? `/api/people/${person.id}/thumbnail` : undefined),
          }))
        : [];
      setPeople(peopleList);
      const faceItems = Array.isArray(facesData?.faces)
        ? (facesData.faces as FaceItem[]).map((face, index) => ({
            ...face,
            personName: String(face.personName || "").trim() || (face.personId ? `Person ${index + 1}` : null),
          }))
        : [];
      setFaces(faceItems);
      setPersonId((prev) => prev || peopleList[0]?.id || "");
      setNameDraftByFace({});
      setSelection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshMetrics = useCallback(() => {
    const image = imageRef.current;
    if (!image) return;
    const rect = image.getBoundingClientRect();
    const naturalWidth = image.naturalWidth || Number(asset?.width || 0);
    const naturalHeight = image.naturalHeight || Number(asset?.height || 0);
    if (!rect.width || !rect.height || !naturalWidth || !naturalHeight) return;

    setMetrics({
      renderWidth: rect.width,
      renderHeight: rect.height,
      naturalWidth,
      naturalHeight,
    });
  }, [asset?.height, asset?.width]);

  useEffect(() => {
    const onResize = () => refreshMetrics();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [refreshMetrics]);

  const existingFaceRects = useMemo(() => {
    if (!metrics) return [];
    return faces.map((face) => ({ face, rect: toDisplayRect(face, metrics) }));
  }, [faces, metrics]);

  const addAutoBox = () => {
    if (!metrics) return;
    const width = metrics.renderWidth * 0.3;
    const height = metrics.renderHeight * 0.3;
    setSelection({
      x: (metrics.renderWidth - width) / 2,
      y: (metrics.renderHeight - height) / 2,
      width,
      height,
    });
    setHint("Auto box ready. Choose a person and press Save Face.");
  };

  const createPersonByName = async (nameInput: string) => {
    const name = nameInput.trim();
    if (!name) throw new Error("Enter a name for the new person");

    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(data?.error || "Failed to create person"));

    const created = data?.person as PersonItem | undefined;
    if (!created?.id) throw new Error("Created person missing id");
    return created;
  };

  const createPersonAndSelect = async () => {
    const name = newPersonName.trim();
    if (!name || creatingPerson) return;

    setCreatingPerson(true);
    setError(null);
    try {
      const created = await createPersonByName(name);
      setPeople((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
      setPersonId(created.id);
      setHint(`Created "${created.name}". Draw a box and press Save Face.`);
      setNewPersonName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create person");
    } finally {
      setCreatingPerson(false);
    }
  };

  const createPersonAndAssignFace = async (faceId: string) => {
    const name = (nameDraftByFace[faceId] || "").trim();
    if (!name || creatingPerson || saving) return;

    setCreatingPerson(true);
    setError(null);
    try {
      const created = await createPersonByName(name);

      const assignRes = await fetch(`/api/faces/${faceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: created.id }),
      });
      const assignData = await assignRes.json().catch(() => ({}));
      if (!assignRes.ok) throw new Error(String(assignData?.error || "Failed to assign face"));

      setPeople((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
      setNameDraftByFace((prev) => ({ ...prev, [faceId]: "" }));
      setHint(`Saved "${created.name}" and linked it to this face.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to name face");
    } finally {
      setCreatingPerson(false);
    }
  };

  const createFace = async () => {
    if (!asset || !metrics || !selection || saving) return;
    const width = Math.max(selection.width, MIN_BOX_SIZE);
    const height = Math.max(selection.height, MIN_BOX_SIZE);
    const x = clamp(selection.x, 0, metrics.renderWidth - width);
    const y = clamp(selection.y, 0, metrics.renderHeight - height);

    const scaleX = metrics.naturalWidth / metrics.renderWidth;
    const scaleY = metrics.naturalHeight / metrics.renderHeight;

    setSaving(true);
    setError(null);
    setHint(null);
    try {
      let targetPersonId = personId;
      if (!targetPersonId) {
        const created = await createPersonByName(newPersonName);
        targetPersonId = created.id;
        setPeople((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
        setPersonId(created.id);
        setNewPersonName("");
      }

      const res = await fetch(`/api/photos/${id}/faces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: targetPersonId,
          x: Math.round(x * scaleX),
          y: Math.round(y * scaleY),
          width: Math.round(width * scaleX),
          height: Math.round(height * scaleY),
          imageWidth: metrics.naturalWidth,
          imageHeight: metrics.naturalHeight,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to create face"));
      setSelection(null);
      setHint("Manual face saved and grouped.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create face");
    } finally {
      setSaving(false);
    }
  };

  const reassignFace = async (faceId: string, nextPersonId: string) => {
    if (!nextPersonId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/faces/${faceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: nextPersonId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to reassign face"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reassign face");
    } finally {
      setSaving(false);
    }
  };

  const removeFace = async (faceId: string) => {
    if (!window.confirm("Remove this face detection?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/faces/${faceId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to delete face"));
      setFaces((prev) => prev.filter((face) => face.id !== faceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete face");
    } finally {
      setSaving(false);
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!metrics) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const startX = clamp(event.clientX - rect.left, 0, metrics.renderWidth);
    const startY = clamp(event.clientY - rect.top, 0, metrics.renderHeight);
    setDragStart({ x: startX, y: startY });
    setSelection({ x: startX, y: startY, width: 1, height: 1 });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!metrics || !dragStart) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const currentX = clamp(event.clientX - rect.left, 0, metrics.renderWidth);
    const currentY = clamp(event.clientY - rect.top, 0, metrics.renderHeight);
    const nextX = Math.min(dragStart.x, currentX);
    const nextY = Math.min(dragStart.y, currentY);
    const nextWidth = Math.max(Math.abs(currentX - dragStart.x), 1);
    const nextHeight = Math.max(Math.abs(currentY - dragStart.y), 1);
    setSelection({ x: nextX, y: nextY, width: nextWidth, height: nextHeight });
  };

  const onPointerUp = () => {
    setDragStart(null);
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="empty-state" style={{ minHeight: 240 }}>
          <Loader size={28} className="spin" color="var(--accent)" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "1rem" }}>
        <button className="btn btn-icon btn-secondary" onClick={() => router.push(`/photo/${id}`)} aria-label="Back to photo">
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.35rem", fontWeight: 700 }}>
            Face Tagging
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
            {asset?.filename || id}
          </p>
        </div>
      </div>

      {error && (
        <div className="panel" style={{ marginBottom: "1rem", borderColor: "var(--error)", color: "var(--error)" }}>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <span>{error}</span>
            <button className="btn btn-secondary btn-sm" style={{ width: "fit-content" }} onClick={() => void load()}>
              Retry
            </button>
          </div>
        </div>
      )}
      {hint && (
        <div className="panel" style={{ marginBottom: "1rem", color: "var(--ink-2)" }}>
          {hint}
        </div>
      )}

      <div className="panel" style={{ marginBottom: "1rem", display: "grid", gap: "0.7rem" }}>
        <p className="section-heading">1) Draw Face Box  2) Pick Person  3) Save</p>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
          New face flow: draw a box, either select a person or type a new name, then save.
        </p>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{
            position: "relative",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
            border: "1px solid var(--line)",
            touchAction: "none",
            width: "fit-content",
            maxWidth: "100%",
            marginInline: "auto",
          }}
        >
          <img
            ref={imageRef}
            src={asset?.thumbUrl || asset?.url}
            alt={asset?.filename || "Photo"}
            onLoad={() => refreshMetrics()}
            style={{ display: "block", maxWidth: "100%", maxHeight: "62vh", objectFit: "contain", background: "var(--bg-subtle)" }}
          />

          {existingFaceRects.map(({ face, rect }) => (
            <div
              key={face.id}
              style={{
                position: "absolute",
                left: `${rect.x}px`,
                top: `${rect.y}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                border: "2px solid rgba(0, 188, 212, 0.95)",
                background: "rgba(0, 188, 212, 0.12)",
                pointerEvents: "none",
              }}
            />
          ))}

          {selection && (
            <div
              style={{
                position: "absolute",
                left: `${selection.x}px`,
                top: `${selection.y}px`,
                width: `${selection.width}px`,
                height: `${selection.height}px`,
                border: "2px solid var(--accent)",
                background: "color-mix(in srgb, var(--accent) 20%, transparent)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: "0.55rem" }}>
          <select className="input" value={personId} onChange={(event) => setPersonId(event.target.value)}>
            <option value="">Select person</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={addAutoBox} disabled={!metrics}>
            Auto Box
          </button>
          <button
            className="btn btn-primary"
            onClick={createFace}
            disabled={saving || creatingPerson || !selection || (!personId && !newPersonName.trim())}
          >
            {saving ? <Loader size={14} className="spin" /> : (!personId && newPersonName.trim() ? "Create + Save Face" : "Save Face")}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "0.55rem" }}>
          <input
            className="input"
            placeholder="Create new person (e.g. Viraj)"
            value={newPersonName}
            onChange={(event) => setNewPersonName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createPersonAndSelect();
            }}
          />
          <button
            className="btn btn-secondary"
            onClick={createPersonAndSelect}
            disabled={creatingPerson || !newPersonName.trim()}
          >
            {creatingPerson ? <Loader size={14} className="spin" /> : <UserPlus size={14} />}
            Add Person
          </button>
        </div>
        {people.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            No people exist yet. Create one above, then tag the face.
          </p>
        )}
      </div>

      <div className="panel">
        <p className="section-heading" style={{ marginBottom: "0.8rem" }}>Existing Faces ({faces.length})</p>
        {faces.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No faces found for this asset.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.65rem" }}>
            {faces.map((face, index) => (
              <div key={face.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "0.7rem", display: "grid", gap: "0.55rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", minWidth: 0 }}>
                    {face.personThumbnailUrl ? (
                      <img
                        src={face.personThumbnailUrl}
                        alt={face.personName || `Person ${index + 1}`}
                        style={{ width: 30, height: 30, borderRadius: "999px", objectFit: "cover", border: "1px solid var(--line)" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "999px",
                          border: "1px solid var(--line)",
                          display: "grid",
                          placeItems: "center",
                          fontSize: "0.72rem",
                          color: "var(--muted)",
                        }}
                      >
                        {index + 1}
                      </div>
                    )}
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {face.personName || `Person ${index + 1}`}
                    </div>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        border: "1px solid var(--line)",
                        color: "var(--muted)",
                        borderRadius: "999px",
                        padding: "0.15rem 0.45rem",
                        textTransform: "capitalize",
                      }}
                    >
                      {face.sourceType === "machine-learning" ? "Auto" : face.sourceType === "manual" ? "Manual" : "Detected"}
                    </span>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={() => removeFace(face.id)} disabled={saving}>
                    <Trash2 size={14} />
                    Remove Detection
                  </button>
                </div>
                <select
                  className="input"
                  value={face.personId || ""}
                  onChange={(event) => {
                    const nextPerson = event.target.value;
                    if (nextPerson && nextPerson !== (face.personId || "")) {
                      void reassignFace(face.id, nextPerson);
                    }
                  }}
                >
                  <option value="">Unassigned</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "0.55rem" }}>
                  <input
                    className="input"
                    placeholder="Name this face (creates a new person)"
                    value={nameDraftByFace[face.id] || ""}
                    onChange={(event) =>
                      setNameDraftByFace((prev) => ({ ...prev, [face.id]: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void createPersonAndAssignFace(face.id);
                    }}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      void createPersonAndAssignFace(face.id);
                    }}
                    disabled={saving || creatingPerson || !(nameDraftByFace[face.id] || "").trim()}
                  >
                    {creatingPerson ? <Loader size={14} className="spin" /> : <UserPlus size={14} />}
                    Save Name
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
