"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Images, Loader, ScanFace, Settings2, Upload, Users } from "lucide-react";
import { useHeaderSyncAction } from "@/components/HeaderSyncContext";
import { PageHeader } from "@/components/PageHeader";
import { safeSessionStorageSet } from "@/lib/browser-storage";
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

type PeopleSnapshot = {
  people: PersonItem[];
  selectedPersonId: string | null;
  unassignedFaces: UnassignedFace[];
  byPerson: Record<string, {
    details: PersonDetails | null;
    photos: Photo[];
    total: number;
  }>;
};

let peoplePageSnapshot: PeopleSnapshot = {
  people: [],
  selectedPersonId: null,
  unassignedFaces: [],
  byPerson: {},
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

function formatDateHeader(date: Date) {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  };
  return date.toLocaleDateString(undefined, options);
}

export default function PeoplePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPersonIdParam = searchParams.get("personId");
  const cachedSelectedData = peoplePageSnapshot.selectedPersonId
    ? peoplePageSnapshot.byPerson[peoplePageSnapshot.selectedPersonId]
    : null;
  const personLoadRequest = useRef(0);

  const [people, setPeople] = useState<PersonItem[]>(() => peoplePageSnapshot.people);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(() => peoplePageSnapshot.selectedPersonId);
  const [selectedDetails, setSelectedDetails] = useState<PersonDetails | null>(() => cachedSelectedData?.details || null);
  const [photos, setPhotos] = useState<Photo[]>(() => cachedSelectedData?.photos || []);
  const [photosTotal, setPhotosTotal] = useState(() => cachedSelectedData?.total || 0);
  const [loadingPeople, setLoadingPeople] = useState(() => peoplePageSnapshot.people.length === 0);
  const [loadingPersonData, setLoadingPersonData] = useState(() => !cachedSelectedData && !!peoplePageSnapshot.selectedPersonId);
  const [syncing, setSyncing] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"timeline" | "unassigned">("timeline");

  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [merging, setMerging] = useState(false);

  const [unassignedFaces, setUnassignedFaces] = useState<UnassignedFace[]>(() => peoplePageSnapshot.unassignedFaces);
  const [selectedFaceIds, setSelectedFaceIds] = useState<string[]>([]);
  const [bulkPersonId, setBulkPersonId] = useState("");
  const [loadingUnassigned, setLoadingUnassigned] = useState(() => peoplePageSnapshot.unassignedFaces.length === 0);
  const [assigningFaces, setAssigningFaces] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedPersonId) || null,
    [people, selectedPersonId],
  );
  const viewerContextIds = useMemo(() => photos.map((photo) => photo.id), [photos]);
  const selectedPersonName = selectedDetails?.person.name || selectedPerson?.name || "No person selected";
  const groupedPhotos = useMemo(() => {
    const sorted = [...photos].sort((a, b) => {
      const dateA = new Date(a.takenAt || a.createdAt).getTime();
      const dateB = new Date(b.takenAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    const groups: Array<{ title: string; photos: Photo[] }> = [];
    sorted.forEach((photo) => {
      const date = new Date(photo.takenAt || photo.createdAt);
      const title = formatDateHeader(date);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.title === title) lastGroup.photos.push(photo);
      else groups.push({ title, photos: [photo] });
    });
    return groups;
  }, [photos]);

  const clearAlerts = useCallback(() => {
    setMessage(null);
    setError(null);
  }, []);

  const loadPeople = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoadingPeople(peoplePageSnapshot.people.length === 0);
    clearAlerts();
    try {
      const res = await fetch("/api/people?size=300", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to load people"));

      const next = Array.isArray(data?.people) ? (data.people as PersonItem[]) : [];
      peoplePageSnapshot.people = next;
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
  }, [clearAlerts, selectedPersonIdParam]);

  const loadUnassigned = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoadingUnassigned(peoplePageSnapshot.unassignedFaces.length === 0);
    try {
      const res = await fetch("/api/faces/unassigned?limit=80", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to load unassigned faces"));
      const nextFaces = Array.isArray(data?.faces) ? (data.faces as UnassignedFace[]) : [];
      peoplePageSnapshot.unassignedFaces = nextFaces;
      setUnassignedFaces(nextFaces);
      setSelectedFaceIds((prev) => prev.filter((id) => nextFaces.some((face) => face.faceId === id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load unassigned faces");
    } finally {
      setLoadingUnassigned(false);
    }
  }, [clearAlerts]);

  const loadPersonData = useCallback(async (personId: string, options?: { silent?: boolean }) => {
    if (!personId) {
      setSelectedDetails(null);
      setPhotos([]);
      setPhotosTotal(0);
      return;
    }

    const requestId = personLoadRequest.current + 1;
    personLoadRequest.current = requestId;
    const cached = peoplePageSnapshot.byPerson[personId];
    if (cached) {
      setSelectedDetails(cached.details);
      setNameDraft(String(cached.details?.person?.name || ""));
      setPhotos(cached.photos);
      setPhotosTotal(cached.total);
      if (options?.silent) {
        setLoadingPersonData(false);
      }
    }

    if (!options?.silent) setLoadingPersonData(!cached);
    clearAlerts();
    try {
      const [detailRes, photosRes] = await Promise.all([
        fetch(`/api/people/${personId}`, { cache: "no-store" }),
        fetch(`/api/people/${personId}/photos?limit=120&offset=0`, { cache: "no-store" }),
      ]);

      const detailData = await detailRes.json().catch(() => ({}));
      const photosData = await photosRes.json().catch(() => ({}));
      if (!detailRes.ok) throw new Error(String(detailData?.error || "Failed to load person details"));
      if (!photosRes.ok) throw new Error(String(photosData?.error || "Failed to load person photos"));

      const next = {
        details: detailData as PersonDetails,
        photos: Array.isArray(photosData?.photos) ? photosData.photos : [],
        total: Number(photosData?.total || 0),
      };

      if (personLoadRequest.current !== requestId) return;
      peoplePageSnapshot.byPerson[personId] = next;
      setSelectedDetails(next.details);
      setNameDraft(String(next.details?.person?.name || ""));
      setPhotos(next.photos);
      setPhotosTotal(next.total);
      setBulkPersonId((prev) => prev || personId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load person data");
    } finally {
      setLoadingPersonData(false);
    }
  }, [clearAlerts]);

  useEffect(() => {
    void loadPeople({ silent: peoplePageSnapshot.people.length > 0 });
    void loadUnassigned({ silent: peoplePageSnapshot.unassignedFaces.length > 0 });
  }, [loadPeople, loadUnassigned]);

  useEffect(() => {
    if (!selectedPersonId) {
      setSelectedDetails(null);
      setPhotos([]);
      setPhotosTotal(0);
      setBulkPersonId("");
      return;
    }

    peoplePageSnapshot.selectedPersonId = selectedPersonId;
    setBulkPersonId(selectedPersonId);
    void loadPersonData(selectedPersonId, { silent: !!peoplePageSnapshot.byPerson[selectedPersonId] });
  }, [loadPersonData, selectedPersonId]);

  const syncAll = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await Promise.all([
        loadPeople(),
        loadUnassigned(),
        selectedPersonId ? loadPersonData(selectedPersonId) : Promise.resolve(),
      ]);
    } finally {
      setSyncing(false);
    }
  }, [loadPeople, loadPersonData, loadUnassigned, selectedPersonId, syncing]);

  useHeaderSyncAction(useMemo(() => ({
    label: "Sync",
    loading: syncing,
    onClick: () => {
      void syncAll();
    },
    ariaLabel: "Sync people and faces",
  }), [syncAll, syncing]));

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
      if (peoplePageSnapshot.byPerson[selectedPersonId]) {
        peoplePageSnapshot.byPerson[selectedPersonId] = {
          ...peoplePageSnapshot.byPerson[selectedPersonId],
          details: peoplePageSnapshot.byPerson[selectedPersonId].details ? {
            ...peoplePageSnapshot.byPerson[selectedPersonId].details!,
            person: {
              ...peoplePageSnapshot.byPerson[selectedPersonId].details!.person,
              name: data.person?.name || trimmed,
            },
          } : null,
        };
      }
      peoplePageSnapshot.people = peoplePageSnapshot.people.map((person) => (
        person.id === selectedPersonId ? { ...person, name: data.person?.name || trimmed } : person
      ));
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
      await Promise.all([loadPeople(), loadUnassigned(), loadPersonData(selectedPersonId)]);
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
      await Promise.all([
        loadUnassigned(),
        loadPeople(),
        targetPersonId && targetPersonId === selectedPersonId
          ? loadPersonData(targetPersonId, { silent: false })
          : Promise.resolve(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign faces");
    } finally {
      setAssigningFaces(false);
    }
  };

  const handleSelectPerson = useCallback((personId: string) => {
    setSelectedPersonId(personId);
    setToolsOpen(false);
  }, []);

  const handleToggleTools = useCallback((personId: string) => {
    setSelectedPersonId(personId);
    setToolsOpen((open) => (selectedPersonId === personId ? !open : true));
  }, [selectedPersonId]);

  return (
    <div className="page-shell">
      <PageHeader title="People" />

      {syncing && (people.length > 0 || unassignedFaces.length > 0) && (
        <div className="status-banner success" style={{ marginBottom: "0.85rem", color: "var(--ink-2)" }}>
          Pulling the latest people and face groups.
        </div>
      )}

      {error && (
        <div className="status-banner error" style={{ marginBottom: "0.8rem" }}>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <span>{error}</span>
            <button
              className="btn btn-secondary btn-sm"
              style={{ width: "fit-content" }}
              onClick={() => {
                void syncAll();
              }}
            >
              Sync again
            </button>
          </div>
        </div>
      )}
      {message && (
        <div className="status-banner success" style={{ marginBottom: "0.8rem", color: "var(--ink-2)" }}>
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
        <div className="section-stack">
          <section className="panel stack-md">
            <div className="action-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <p className="section-heading">People</p>
              <span className="info-chip">{people.length}</span>
            </div>

            <div className="people-strip" role="list" aria-label="People">
            {people.map((person) => {
              const active = selectedPersonId === person.id;
              return (
                <div
                  key={person.id}
                  className={`people-strip-card glass${active ? " active" : ""}`}
                  style={{ borderRadius: 'var(--r-xl)', padding: '8px', border: 'none' }}
                  role="listitem"
                >
                  <div className="people-strip-avatar-wrap">
                    <button
                      type="button"
                      className="people-strip-select"
                      onClick={() => handleSelectPerson(person.id)}
                      aria-pressed={active}
                      aria-label={`Show ${person.name}`}
                    >
                      <img
                        src={person.thumbnailUrl}
                        alt={person.name}
                        className="people-strip-avatar"
                      />
                    </button>
                    {active && (
                      <button
                        type="button"
                        className={`people-strip-settings${toolsOpen ? " active" : ""}`}
                        onClick={() => handleToggleTools(person.id)}
                        aria-label={`${toolsOpen ? "Close" : "Open"} settings for ${person.name}`}
                      >
                        <Settings2 size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="people-strip-name-button"
                    onClick={() => handleSelectPerson(person.id)}
                  >
                    <span className="people-strip-name">{person.name}</span>
                  </button>
                </div>
              );
            })}
            </div>
          </section>

          <section className="panel stack-md">
            {loadingPersonData ? (
              <div className="empty-state" style={{ minHeight: 160 }}>
                <Loader size={22} className="spin" color="var(--accent)" />
              </div>
            ) : selectedPerson ? (
              toolsOpen ? (
                <div className="stack-md">
                  <div className="action-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div className="stack-xs">
                      <p className="section-heading">{selectedPersonName}</p>
                      <p className="muted-copy">{selectedDetails?.stats.assets ?? photosTotal} items</p>
                    </div>
                    <span className="info-chip">Settings</span>
                  </div>

                  <div className="split-input-row">
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
                      {savingName ? <Loader size={14} className="spin" /> : "Save name"}
                    </button>
                  </div>

                  <div className="split-input-row">
                    <select className="input" value={mergeSourceId} onChange={(event) => setMergeSourceId(event.target.value)}>
                      <option value="">Merge another person into {selectedPersonName}</option>
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
                </div>
              ) : (
                <>
                  <div className="people-panel-switcher" role="tablist" aria-label="Person views">
                    <button
                      type="button"
                      className={`people-panel-tab${activePanel === "timeline" ? " active" : ""}`}
                      onClick={() => setActivePanel("timeline")}
                      aria-label={`Show ${selectedPersonName} timeline`}
                      aria-pressed={activePanel === "timeline"}
                    >
                      <Images size={16} />
                      <span className="people-panel-tab-count">{photosTotal}</span>
                    </button>
                    <button
                      type="button"
                      className={`people-panel-tab${activePanel === "unassigned" ? " active" : ""}`}
                      onClick={() => setActivePanel("unassigned")}
                      aria-label={`Show unassigned faces for ${selectedPersonName}`}
                      aria-pressed={activePanel === "unassigned"}
                    >
                      <ScanFace size={16} />
                      <span className="people-panel-tab-count">{unassignedFaces.length}</span>
                    </button>
                  </div>

                  {activePanel === "timeline" ? (
                    photos.length === 0 ? (
                      <div className="empty-state" style={{ minHeight: 170 }}>
                        <p className="empty-state-title">No photos for this person</p>
                      </div>
                    ) : (
                      <div className="stack-lg">
                        {groupedPhotos.map((group) => (
                          <div key={group.title} className="stack-sm">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
                              <h2 style={{ fontSize: "0.96rem", fontWeight: 700, color: "var(--ink-2)" }}>{group.title}</h2>
                              <span className="info-chip">{group.photos.length}</span>
                            </div>
                            <div className="responsive-grid">
                              {group.photos.map((photo) => (
                                <button
                                  key={photo.id}
                                  type="button"
                                  onClick={() => {
                                    safeSessionStorageSet("current_gallery_context", JSON.stringify(viewerContextIds));
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
                          </div>
                        ))}
                      </div>
                    )
                  ) : loadingUnassigned ? (
                    <div className="empty-state" style={{ minHeight: 140 }}>
                      <Loader size={22} className="spin" color="var(--accent)" />
                    </div>
                  ) : unassignedFaces.length === 0 ? (
                    <p className="muted-copy">No unassigned faces right now.</p>
                  ) : (
                    <div className="stack-md">
                      <div className="action-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <p className="section-heading">Assign to {selectedPersonName}</p>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => void assignFaces(selectedFaceIds)}
                          disabled={assigningFaces || !selectedPersonId || selectedFaceIds.length === 0}
                        >
                          {assigningFaces ? <Loader size={14} className="spin" /> : `Assign selected (${selectedFaceIds.length})`}
                        </button>
                      </div>

                      <div className="media-card-grid">
                        {unassignedFaces.map((face, index) => {
                          const checked = selectedFaceIds.includes(face.faceId);
                          return (
                            <div key={face.faceId} className="media-card">
                              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.78rem", color: "var(--muted)", cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleFace(face.faceId)}
                                />
                                Face #{index + 1}
                              </label>

                              <div className="media-card-thumb-wrap">
                                <img src={face.assetThumbUrl} alt={face.filename} className="media-card-thumb" />
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

                              <p style={{ fontSize: "0.76rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {face.filename}
                              </p>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem" }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => router.push(`/photo/${face.assetId}`)}
                                >
                                  Open
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => void assignFaces([face.faceId])}
                                  disabled={assigningFaces || !selectedPersonId}
                                >
                                  Assign
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )
            ) : (
              <div className="empty-state" style={{ minHeight: 170 }}>
                <p className="muted-copy">Pick a person above to load their photos.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
