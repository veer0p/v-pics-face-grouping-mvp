"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Check,
  Contrast,
  Crop,
  Droplets,
  Eraser,
  Focus,
  Loader,
  Palette,
  PenTool,
  RotateCw,
  SlidersHorizontal,
  Sun,
  Thermometer,
  Undo2,
  Redo2,
  Wand2,
  X,
} from "lucide-react";

type PhotoDetail = {
  id: string;
  url: string;
  thumbUrl: string;
  filename: string;
  mimeType: string;
  takenAt: string | null;
  createdAt: string;
  width: number | null;
  height: number | null;
  mediaType?: "image" | "video";
};

type CropRect = { x: number; y: number; w: number; h: number };
type CropAspect = "free" | "1:1" | "4:5" | "16:9";
type TabKey = "auto" | "crop" | "adjust" | "filter" | "markup";
type ResizeHandle = "nw" | "ne" | "sw" | "se";

type StrokePoint = { x: number; y: number };
type MarkupStroke = {
  id: string;
  color: string;
  size: number;
  erase: boolean;
  points: StrokePoint[];
};

type CropGesture =
  | { kind: "move"; startX: number; startY: number; startRect: CropRect }
  | { kind: "resize"; handle: ResizeHandle; startX: number; startY: number; startRect: CropRect }
  | null;

type DisplayRect = { left: number; top: number; width: number; height: number };

const FILTERS = ["None", "Vivid", "Warm", "Cool", "Fade", "Mono"] as const;

const TABS: Array<{ key: TabKey; label: string; Icon: typeof Wand2 }> = [
  { key: "auto", label: "Auto", Icon: Wand2 },
  { key: "crop", label: "Crop", Icon: Crop },
  { key: "adjust", label: "Adjust", Icon: SlidersHorizontal },
  { key: "filter", label: "Filter", Icon: Palette },
  { key: "markup", label: "Markup", Icon: PenTool },
];

const SLIDERS = [
  { key: "brightness", label: "Brightness", Icon: Sun, default: 50 },
  { key: "contrast", label: "Contrast", Icon: Contrast, default: 50 },
  { key: "saturation", label: "Saturation", Icon: Droplets, default: 50 },
  { key: "warmth", label: "Warmth", Icon: Thermometer, default: 50 },
  { key: "sharpness", label: "Sharpness", Icon: Focus, default: 35 },
] as const;

const MIN_CROP = 0.08;
const DEFAULT_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mediaTypeOf(photo: PhotoDetail | null) {
  if (!photo) return "image";
  if (photo.mediaType === "video") return "video";
  return String(photo.mimeType || "").startsWith("video/") ? "video" : "image";
}

function cloneStrokes(strokes: MarkupStroke[]) {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }));
}

function filterPreset(name: (typeof FILTERS)[number]) {
  switch (name) {
    case "Vivid":
      return { saturation: 22, contrast: 8, brightness: 4, warmth: 2 };
    case "Warm":
      return { saturation: 6, contrast: 3, brightness: 3, warmth: 18 };
    case "Cool":
      return { saturation: 8, contrast: 2, brightness: 2, warmth: -18 };
    case "Fade":
      return { saturation: -22, contrast: -12, brightness: 8, warmth: 0 };
    case "Mono":
      return { saturation: -100, contrast: 6, brightness: 2, warmth: 0 };
    default:
      return { saturation: 0, contrast: 0, brightness: 0, warmth: 0 };
  }
}

function buildCssFilter(values: Record<string, number>, activeFilter: (typeof FILTERS)[number]) {
  const preset = filterPreset(activeFilter);
  const brightness = clamp((values.brightness + preset.brightness) / 50, 0.2, 2.8);
  const contrast = clamp((values.contrast + preset.contrast) / 50, 0.2, 2.8);
  const saturation = clamp((values.saturation + preset.saturation) / 50, 0, 3);
  const warmth = values.warmth + preset.warmth;
  const sepia = clamp(Math.abs(warmth) / 140, 0, 0.55);
  const hue = warmth < 0 ? ` hue-rotate(${Math.round(Math.abs(warmth) * 0.5)}deg)` : "";
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(${sepia})${hue}`;
}

function aspectRatioValue(aspect: CropAspect) {
  if (aspect === "1:1") return 1;
  if (aspect === "4:5") return 4 / 5;
  if (aspect === "16:9") return 16 / 9;
  return null;
}

function fitAspectRect(aspect: CropAspect): CropRect {
  if (aspect === "free") return { ...DEFAULT_CROP };
  const ratio = aspectRatioValue(aspect) || 1;
  if (ratio >= 1) {
    const h = 1 / ratio;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  const w = ratio;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}

function normalizedRatio(aspect: CropAspect, display: DisplayRect) {
  const ratio = aspectRatioValue(aspect);
  if (!ratio || display.width <= 0 || display.height <= 0) return null;
  return ratio * (display.height / display.width);
}

function clampRect(rect: CropRect) {
  const w = clamp(rect.w, MIN_CROP, 1);
  const h = clamp(rect.h, MIN_CROP, 1);
  const x = clamp(rect.x, 0, 1 - w);
  const y = clamp(rect.y, 0, 1 - h);
  return { x, y, w, h };
}

function fileNameForCopy(originalName: string) {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${base || "edited"}-copy.webp`;
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
  });
  img.src = url;
  return loaded;
}

async function blobFromCanvas(canvas: HTMLCanvasElement, mime = "image/webp", quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate edited image"));
        return;
      }
      resolve(blob);
    }, mime, quality);
  });
}

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: MarkupStroke[],
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0,
  scale = 1,
) {
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    ctx.save();
    ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(1, stroke.size * scale);
    ctx.beginPath();
    const first = stroke.points[0];
    ctx.moveTo(first.x * width - offsetX, first.y * height - offsetY);
    for (let i = 1; i < stroke.points.length; i += 1) {
      const point = stroke.points[i];
      ctx.lineTo(point.x * width - offsetX, point.y * height - offsetY);
    }
    if (stroke.points.length === 1) {
      ctx.lineTo(first.x * width - offsetX + 0.1, first.y * height - offsetY + 0.1);
    }
    ctx.stroke();
    ctx.restore();
  }
}

export default function EditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const photoId = params.id;

  const [tab, setTab] = useState<TabKey>("adjust");
  const [photo, setPhoto] = useState<PhotoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("None");
  const [rotation, setRotation] = useState(0);
  const [cropAspect, setCropAspect] = useState<CropAspect>("free");
  const [cropRect, setCropRect] = useState<CropRect>({ ...DEFAULT_CROP });
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(SLIDERS.map((slider) => [slider.key, slider.default])),
  );
  const [brushColor, setBrushColor] = useState("#00ff66");
  const [brushSize, setBrushSize] = useState(10);
  const [eraser, setEraser] = useState(false);
  const [strokes, setStrokes] = useState<MarkupStroke[]>([]);
  const [undoStack, setUndoStack] = useState<MarkupStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<MarkupStroke[][]>([]);
  const [displayRect, setDisplayRect] = useState<DisplayRect>({ left: 0, top: 0, width: 0, height: 0 });
  const [imageNatural, setImageNatural] = useState({ width: 0, height: 0 });

  const previewRef = useRef<HTMLDivElement | null>(null);
  const markupCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropGestureRef = useRef<CropGesture>(null);
  const drawStrokeRef = useRef<MarkupStroke | null>(null);
  const drawPointerIdRef = useRef<number | null>(null);

  const isImage = mediaTypeOf(photo) === "image";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/photos/${photoId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(data?.error || "Failed to load asset"));
        if (!cancelled) setPhoto(data.photo || null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load asset");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [photoId]);

  useEffect(() => {
    if (!photo || !isImage) return;
    let cancelled = false;
    const run = async () => {
      try {
        const img = await loadImageFromUrl(photo.url);
        if (!cancelled) setImageNatural({ width: img.naturalWidth, height: img.naturalHeight });
      } catch {
        if (!cancelled) setImageNatural({ width: photo.width || 0, height: photo.height || 0 });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isImage, photo]);

  const computeDisplayRect = useCallback(() => {
    const host = previewRef.current;
    if (!host || !imageNatural.width || !imageNatural.height) return;
    const hostRect = host.getBoundingClientRect();
    const rotated = rotation % 180 === 0
      ? { width: imageNatural.width, height: imageNatural.height }
      : { width: imageNatural.height, height: imageNatural.width };
    const scale = Math.min(hostRect.width / rotated.width, hostRect.height / rotated.height);
    const width = rotated.width * scale;
    const height = rotated.height * scale;
    setDisplayRect({
      left: (hostRect.width - width) / 2,
      top: (hostRect.height - height) / 2,
      width,
      height,
    });
  }, [imageNatural.height, imageNatural.width, rotation]);

  useEffect(() => {
    computeDisplayRect();
    const host = previewRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => {
      computeDisplayRect();
    });
    observer.observe(host);
    window.addEventListener("resize", computeDisplayRect);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", computeDisplayRect);
    };
  }, [computeDisplayRect]);

  const cssFilter = useMemo(() => buildCssFilter(values, activeFilter), [values, activeFilter]);

  const pushUndo = useCallback((snapshot: MarkupStroke[]) => {
    setUndoStack((prev) => {
      const next = [...prev, cloneStrokes(snapshot)];
      return next.slice(Math.max(0, next.length - 60));
    });
    setRedoStack([]);
  }, []);

  const updateSlider = (key: string, next: number) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  };

  const applyAuto = () => {
    setValues((prev) => ({
      ...prev,
      brightness: clamp(prev.brightness + 5, 0, 100),
      contrast: clamp(prev.contrast + 7, 0, 100),
      saturation: clamp(prev.saturation + 8, 0, 100),
      warmth: clamp(prev.warmth + 3, 0, 100),
      sharpness: clamp(prev.sharpness + 8, 0, 100),
    }));
    setActiveFilter("Vivid");
    setTab("adjust");
  };

  const applyAspect = (aspect: CropAspect) => {
    setCropAspect(aspect);
    setCropRect(fitAspectRect(aspect));
  };

  const handleCropPointerMove = useCallback((event: PointerEvent) => {
    const gesture = cropGestureRef.current;
    if (!gesture || !displayRect.width || !displayRect.height) return;
    const dx = (event.clientX - gesture.startX) / displayRect.width;
    const dy = (event.clientY - gesture.startY) / displayRect.height;

    if (gesture.kind === "move") {
      setCropRect(clampRect({
        x: gesture.startRect.x + dx,
        y: gesture.startRect.y + dy,
        w: gesture.startRect.w,
        h: gesture.startRect.h,
      }));
      return;
    }

    let next: CropRect = { ...gesture.startRect };
    if (cropAspect === "free") {
      if (gesture.handle.includes("w")) {
        next.x = gesture.startRect.x + dx;
        next.w = gesture.startRect.w - dx;
      }
      if (gesture.handle.includes("e")) next.w = gesture.startRect.w + dx;
      if (gesture.handle.includes("n")) {
        next.y = gesture.startRect.y + dy;
        next.h = gesture.startRect.h - dy;
      }
      if (gesture.handle.includes("s")) next.h = gesture.startRect.h + dy;
      setCropRect(clampRect(next));
      return;
    }

    const ratio = normalizedRatio(cropAspect, displayRect);
    if (!ratio) return;
    const widthByDx = gesture.handle.includes("e")
      ? gesture.startRect.w + dx
      : gesture.handle.includes("w")
        ? gesture.startRect.w - dx
        : gesture.startRect.w;
    const heightByDy = gesture.handle.includes("s")
      ? gesture.startRect.h + dy
      : gesture.handle.includes("n")
        ? gesture.startRect.h - dy
        : gesture.startRect.h;
    const useWidth = Math.abs(dx * displayRect.width) >= Math.abs(dy * displayRect.height);
    const targetW = useWidth ? widthByDx : heightByDy * ratio;
    const targetH = useWidth ? targetW / ratio : heightByDy;
    const w = clamp(targetW, MIN_CROP, 1);
    const h = clamp(targetH, MIN_CROP, 1);
    const right = gesture.startRect.x + gesture.startRect.w;
    const bottom = gesture.startRect.y + gesture.startRect.h;
    if (gesture.handle === "nw") next = { x: right - w, y: bottom - h, w, h };
    else if (gesture.handle === "ne") next = { x: gesture.startRect.x, y: bottom - h, w, h };
    else if (gesture.handle === "sw") next = { x: right - w, y: gesture.startRect.y, w, h };
    else next = { x: gesture.startRect.x, y: gesture.startRect.y, w, h };
    setCropRect(clampRect(next));
  }, [cropAspect, displayRect]);

  const stopCropGesture = useCallback(() => {
    cropGestureRef.current = null;
    window.removeEventListener("pointermove", handleCropPointerMove);
    window.removeEventListener("pointerup", stopCropGesture);
  }, [handleCropPointerMove]);

  const startCropGesture = (event: ReactPointerEvent<Element>, kind: CropGesture) => {
    event.preventDefault();
    cropGestureRef.current = kind;
    window.addEventListener("pointermove", handleCropPointerMove);
    window.addEventListener("pointerup", stopCropGesture);
  };

  const renderMarkupCanvas = useCallback((extraStroke?: MarkupStroke | null) => {
    const canvas = markupCanvasRef.current;
    if (!canvas || !displayRect.width || !displayRect.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(displayRect.width * dpr));
    canvas.height = Math.max(1, Math.round(displayRect.height * dpr));
    canvas.style.width = `${displayRect.width}px`;
    canvas.style.height = `${displayRect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayRect.width, displayRect.height);
    drawStrokes(ctx, strokes, displayRect.width, displayRect.height);
    if (extraStroke) drawStrokes(ctx, [extraStroke], displayRect.width, displayRect.height);
  }, [displayRect.height, displayRect.width, strokes]);

  useEffect(() => {
    renderMarkupCanvas(drawStrokeRef.current);
  }, [renderMarkupCanvas]);

  const pointerToNormalized = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    return { x, y };
  };

  const onMarkupPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (tab !== "markup") return;
    const point = pointerToNormalized(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawPointerIdRef.current = event.pointerId;
    drawStrokeRef.current = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      color: brushColor,
      size: brushSize,
      erase: eraser,
      points: [point],
    };
    renderMarkupCanvas(drawStrokeRef.current);
  };

  const onMarkupPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drawPointerIdRef.current !== event.pointerId) return;
    const point = pointerToNormalized(event);
    if (!point || !drawStrokeRef.current) return;
    const points = drawStrokeRef.current.points;
    const last = points[points.length - 1];
    if (Math.hypot(last.x - point.x, last.y - point.y) < 0.002) return;
    drawStrokeRef.current = { ...drawStrokeRef.current, points: [...drawStrokeRef.current.points, point] };
    renderMarkupCanvas(drawStrokeRef.current);
  };

  const finishMarkupStroke = (pointerId?: number) => {
    if (pointerId !== undefined && drawPointerIdRef.current !== pointerId) return;
    drawPointerIdRef.current = null;
    const stroke = drawStrokeRef.current;
    drawStrokeRef.current = null;
    if (!stroke || stroke.points.length === 0) {
      renderMarkupCanvas(null);
      return;
    }
    setStrokes((prev) => {
      pushUndo(prev);
      return [...prev, stroke];
    });
  };

  const undo = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snapshot = next.pop();
      if (!snapshot) return prev;
      setRedoStack((redo) => [...redo, cloneStrokes(strokes)]);
      setStrokes(cloneStrokes(snapshot));
      return next;
    });
  };

  const redo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snapshot = next.pop();
      if (!snapshot) return prev;
      setUndoStack((undoList) => [...undoList, cloneStrokes(strokes)]);
      setStrokes(cloneStrokes(snapshot));
      return next;
    });
  };

  const clearMarkup = () => {
    if (strokes.length === 0) return;
    pushUndo(strokes);
    setStrokes([]);
  };

  const rotateClockwise = () => {
    setRotation((prev) => ((prev + 90) % 360));
  };

  const saveCopy = async () => {
    if (!photo || !isImage || saving) return;
    setSaving(true);
    setError(null);
    try {
      const sourceRes = await fetch(photo.url, { cache: "no-store" });
      if (!sourceRes.ok) throw new Error("Unable to load original image for editing");
      const sourceBlob = await sourceRes.blob();
      const sourceUrl = URL.createObjectURL(sourceBlob);
      const sourceImage = await loadImageFromUrl(sourceUrl);
      const rotateCanvas = document.createElement("canvas");
      const rotateCtx = rotateCanvas.getContext("2d");
      if (!rotateCtx) throw new Error("Canvas is unavailable in this browser");

      const rotateRad = (rotation * Math.PI) / 180;
      const rotatedWidth = rotation % 180 === 0 ? sourceImage.naturalWidth : sourceImage.naturalHeight;
      const rotatedHeight = rotation % 180 === 0 ? sourceImage.naturalHeight : sourceImage.naturalWidth;
      rotateCanvas.width = Math.max(1, Math.round(rotatedWidth));
      rotateCanvas.height = Math.max(1, Math.round(rotatedHeight));
      rotateCtx.translate(rotateCanvas.width / 2, rotateCanvas.height / 2);
      rotateCtx.rotate(rotateRad);
      rotateCtx.drawImage(sourceImage, -sourceImage.naturalWidth / 2, -sourceImage.naturalHeight / 2);
      rotateCtx.setTransform(1, 0, 0, 1, 0, 0);
      URL.revokeObjectURL(sourceUrl);

      const cropX = clamp(Math.round(cropRect.x * rotateCanvas.width), 0, rotateCanvas.width - 1);
      const cropY = clamp(Math.round(cropRect.y * rotateCanvas.height), 0, rotateCanvas.height - 1);
      const cropW = clamp(Math.round(cropRect.w * rotateCanvas.width), 1, rotateCanvas.width - cropX);
      const cropH = clamp(Math.round(cropRect.h * rotateCanvas.height), 1, rotateCanvas.height - cropY);

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = cropW;
      outputCanvas.height = cropH;
      const outputCtx = outputCanvas.getContext("2d");
      if (!outputCtx) throw new Error("Canvas is unavailable in this browser");
      outputCtx.filter = cssFilter;
      outputCtx.drawImage(rotateCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      outputCtx.filter = "none";

      const previewWidth = displayRect.width || cropW;
      const scaleFactor = cropW / previewWidth;
      drawStrokes(outputCtx, strokes, rotateCanvas.width, rotateCanvas.height, cropX, cropY, scaleFactor);

      const editedBlob = await blobFromCanvas(outputCanvas, "image/webp", 0.92);
      const editedFile = new File([editedBlob], fileNameForCopy(photo.filename), { type: "image/webp" });
      const form = new FormData();
      form.append("file", editedFile);
      form.append("takenAt", photo.takenAt || photo.createdAt || new Date().toISOString());
      form.append("createdAt", photo.createdAt || new Date().toISOString());

      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(String(uploadData?.error || "Failed to upload edited copy"));
      const newId = uploadData?.photo?.id;
      if (!newId) throw new Error("Edited copy uploaded but no asset id returned");
      router.replace(`/photo/${newId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save edited copy");
    } finally {
      setSaving(false);
    }
  };

  const imageStyle = useMemo(() => ({
    width: displayRect.width ? `${displayRect.width}px` : "100%",
    height: displayRect.height ? `${displayRect.height}px` : "100%",
    objectFit: "contain" as const,
    transform: `rotate(${rotation}deg)`,
    filter: cssFilter,
    transformOrigin: "center center",
    userSelect: "none" as const,
    WebkitUserSelect: "none" as const,
    pointerEvents: "none" as const,
  }), [cssFilter, displayRect.height, displayRect.width, rotation]);

  const cropBoxStyle = useMemo(() => ({
    left: `${cropRect.x * 100}%`,
    top: `${cropRect.y * 100}%`,
    width: `${cropRect.w * 100}%`,
    height: `${cropRect.h * 100}%`,
  }), [cropRect]);

  const drawColors = ["#00ff66", "#ffffff", "#ff4d6d", "#3b82f6", "#f59e0b", "#8b5cf6"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.75rem 1rem",
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>
          <X size={16} strokeWidth={2.5} />
          Cancel
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={saveCopy}
          disabled={saving || loading || !photo || !isImage}
          title={!isImage ? "Editing is currently image-only" : undefined}
        >
          {saving ? <Loader size={14} className="spin" /> : <Check size={16} strokeWidth={2.5} />}
          Save Copy
        </button>
      </div>

      <div
        ref={previewRef}
        style={{
          flex: "0 0 58vh",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div className="empty-state" style={{ minHeight: 120 }}>
            <Loader size={26} className="spin" color="var(--accent)" />
          </div>
        ) : error ? (
          <div className="panel" style={{ borderColor: "var(--error)", color: "var(--error)" }}>
            {error}
          </div>
        ) : !photo ? (
          <div className="empty-state" style={{ minHeight: 120 }}>
            <p className="empty-state-title">Asset not found</p>
          </div>
        ) : !isImage ? (
          <div className="empty-state" style={{ minHeight: 160, maxWidth: 460, textAlign: "center", padding: "1rem" }}>
            <p className="empty-state-title">Editing is currently image-only</p>
            <p className="empty-state-sub">This asset is a video. Crop, markup, and Save Copy are disabled.</p>
          </div>
        ) : (
          <>
            <img src={photo.url} alt={photo.filename} style={imageStyle} draggable={false} />

            <div
              style={{
                position: "absolute",
                left: displayRect.left,
                top: displayRect.top,
                width: displayRect.width,
                height: displayRect.height,
                pointerEvents: tab === "crop" ? "auto" : "none",
              }}
            >
              {tab === "crop" && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(0,0,0,0.45)",
                      clipPath: `polygon(0% 0%, 0% 100%, ${cropRect.x * 100}% 100%, ${cropRect.x * 100}% ${cropRect.y * 100}%, ${(cropRect.x + cropRect.w) * 100}% ${cropRect.y * 100}%, ${(cropRect.x + cropRect.w) * 100}% ${(cropRect.y + cropRect.h) * 100}%, ${cropRect.x * 100}% ${(cropRect.y + cropRect.h) * 100}%, ${cropRect.x * 100}% 100%, 100% 100%, 100% 0%)`,
                    }}
                  />

                  <div
                    style={{
                      position: "absolute",
                      ...cropBoxStyle,
                      border: "2px solid #00ff66",
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.4) inset",
                    }}
                    onPointerDown={(event) => startCropGesture(event, {
                      kind: "move",
                      startX: event.clientX,
                      startY: event.clientY,
                      startRect: cropRect,
                    })}
                  >
                    <div style={{ position: "absolute", left: "33.333%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.45)" }} />
                    <div style={{ position: "absolute", left: "66.666%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.45)" }} />
                    <div style={{ position: "absolute", top: "33.333%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.45)" }} />
                    <div style={{ position: "absolute", top: "66.666%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.45)" }} />

                    {(["nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => (
                      <button
                        key={handle}
                        type="button"
                        aria-label={`Resize ${handle}`}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          startCropGesture(event, {
                            kind: "resize",
                            handle,
                            startX: event.clientX,
                            startY: event.clientY,
                            startRect: cropRect,
                          });
                        }}
                        style={{
                          position: "absolute",
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          border: "2px solid #00ff66",
                          background: "#fff",
                          cursor: "nwse-resize",
                          left: handle.includes("w") ? -8 : undefined,
                          right: handle.includes("e") ? -8 : undefined,
                          top: handle.includes("n") ? -8 : undefined,
                          bottom: handle.includes("s") ? -8 : undefined,
                        }}
                      />
                    ))}
                  </div>
                </>
              )}

              <canvas
                ref={markupCanvasRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: tab === "markup" ? "auto" : "none",
                  touchAction: "none",
                }}
                onPointerDown={onMarkupPointerDown}
                onPointerMove={onMarkupPointerMove}
                onPointerUp={(event) => finishMarkupStroke(event.pointerId)}
                onPointerCancel={(event) => finishMarkupStroke(event.pointerId)}
                onPointerLeave={(event) => finishMarkupStroke(event.pointerId)}
              />
            </div>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.2rem",
          padding: "0.35rem 0.5rem",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-subtle)",
          overflowX: "auto",
        }}
      >
        {TABS.map((item) => (
          <button
            key={item.key}
            className={`chip${tab === item.key ? " active" : ""}`}
            onClick={() => setTab(item.key)}
            style={{ gap: "0.3rem", opacity: !isImage && item.key !== "adjust" && item.key !== "filter" ? 0.55 : 1 }}
            disabled={!isImage && item.key !== "adjust" && item.key !== "filter"}
          >
            <item.Icon size={14} strokeWidth={2} />
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "grid", gap: "1rem" }}>
        {tab === "auto" && (
          <div className="empty-state" style={{ minHeight: 120, padding: "1rem" }}>
            <Wand2 size={28} strokeWidth={1.5} color="var(--accent)" />
            <p style={{ fontSize: "0.88rem", fontWeight: 600 }}>One tap auto-enhance</p>
            <button className="btn btn-primary btn-sm" onClick={applyAuto} disabled={!isImage}>
              <Wand2 size={14} />
              Apply Auto
            </button>
          </div>
        )}

        {tab === "crop" && (
          <div style={{ display: "grid", gap: "0.85rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn btn-secondary btn-sm" onClick={rotateClockwise} disabled={!isImage}>
                <RotateCw size={14} />
                Rotate 90deg
              </button>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(["free", "1:1", "4:5", "16:9"] as CropAspect[]).map((aspect) => (
                <button
                  key={aspect}
                  className={`chip${cropAspect === aspect ? " active" : ""}`}
                  onClick={() => applyAspect(aspect)}
                  disabled={!isImage}
                >
                  {aspect}
                </button>
              ))}
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
              Drag the crop box to move it. Use corner handles to resize.
            </p>
          </div>
        )}

        {tab === "adjust" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {SLIDERS.map((slider) => (
              <div key={slider.key} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <slider.Icon size={16} color="var(--muted)" />
                <label style={{ minWidth: 86, fontSize: "0.85rem", fontWeight: 600 }}>{slider.label}</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={values[slider.key]}
                  onChange={(event) => updateSlider(slider.key, Number(event.target.value))}
                  style={{ flex: 1 }}
                  disabled={!photo}
                />
                <span style={{ fontSize: "0.78rem", color: "var(--muted)", minWidth: 26, textAlign: "right" }}>
                  {values[slider.key]}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "filter" && (
          <div style={{ display: "flex", gap: "0.65rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
            {FILTERS.map((name) => (
              <button
                key={name}
                onClick={() => setActiveFilter(name)}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.35rem",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  fontFamily: "var(--font-ui)",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "var(--r-sm)",
                    background: `linear-gradient(135deg, ${name === "Warm" ? "#ffd93d,#ff6b6b" : name === "Cool" ? "#60c8ff,#5b4eff" : name === "Vivid" ? "#ff6b6b,#ffd93d,#10b981" : name === "Fade" ? "#d5d5d5,#b5b5b5" : name === "Mono" ? "#333,#888" : "var(--bg-subtle),var(--line)"})`,
                    border: activeFilter === name ? "2px solid var(--accent)" : "2px solid transparent",
                    transition: "border-color 150ms",
                  }}
                />
                <span style={{ fontSize: "0.72rem", fontWeight: activeFilter === name ? 700 : 500, color: activeFilter === name ? "var(--accent)" : "var(--muted)" }}>
                  {name}
                </span>
              </button>
            ))}
          </div>
        )}

        {tab === "markup" && (
          <div style={{ display: "grid", gap: "0.8rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className={`btn btn-sm ${eraser ? "btn-secondary" : "btn-primary"}`} onClick={() => setEraser((prev) => !prev)}>
                {eraser ? <PenTool size={14} /> : <Eraser size={14} />}
                {eraser ? "Draw" : "Eraser"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={undo} disabled={undoStack.length === 0}>
                <Undo2 size={14} />
                Undo
              </button>
              <button className="btn btn-ghost btn-sm" onClick={redo} disabled={redoStack.length === 0}>
                <Redo2 size={14} />
                Redo
              </button>
              <button className="btn btn-ghost btn-sm" onClick={clearMarkup} disabled={strokes.length === 0}>
                Clear
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <label style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--muted)" }}>Brush</label>
              <input
                type="range"
                min={2}
                max={36}
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                disabled={eraser}
              />
              <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{brushSize}px</span>
            </div>

            {!eraser && (
              <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                {drawColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Color ${color}`}
                    onClick={() => setBrushColor(color)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: brushColor === color ? "2px solid #fff" : "1px solid rgba(255,255,255,0.25)",
                      background: color,
                    }}
                  />
                ))}
              </div>
            )}

            <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
              Draw directly on the preview. Undo and redo are available for markup strokes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
