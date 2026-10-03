import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/i18n";

/**
 * Fullscreen image viewer with zoom (Correction N6: "il faudrait que les images
 * soient capables de venir en plein écran lorsqu'on clique dessus et on doit
 * être capable de zoomer").
 *
 * Desktop  — click to open, mouse wheel or +/− to zoom, drag to pan, double
 *            click to toggle fit ↔ 2×, Esc / ✕ / backdrop to close.
 * Mobile   — tap to open, pinch-to-zoom (two pointers), one-finger pan once
 *            zoomed, double tap to toggle, ✕ to close.
 *
 * The image is `object-contain` inside a fixed stage, so the aspect ratio is
 * never distorted whatever the zoom level. While the viewer is open the body is
 * locked, so closing it returns the reader to the exact same scroll offset.
 *
 * `meta` is the extension point the client asked to keep open ("on verra
 * comment ajouter les références de ces images"): any subset of caption /
 * credit / author / source link renders as a caption bar. Nothing here needs a
 * citation system — a consumer with no metadata simply omits the prop.
 */
export interface ImageMeta {
  caption?: string | null;
  credit?: string | null;
  creditUrl?: string | null;
  author?: string | null;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function ImageLightbox({
  src,
  alt = "",
  meta,
  onClose,
}: {
  src: string;
  alt?: string;
  meta?: ImageMeta;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Active pointers, so one finger pans and two fingers pinch.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  // Zoom about the viewport centre; the pan offset scales with it so the point
  // under the middle of the stage stays put instead of drifting away.
  const zoomTo = useCallback((next: number) => {
    setScale((prev) => {
      const s = clamp(next, MIN_SCALE, MAX_SCALE);
      if (s === MIN_SCALE) {
        setTx(0);
        setTy(0);
      } else if (s !== prev) {
        const ratio = s / prev;
        setTx((v) => v * ratio);
        setTy((v) => v * ratio);
      }
      return s;
    });
  }, []);

  // Esc closes, +/− zoom, 0 resets.
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") zoomTo(scale + 0.5);
      else if (e.key === "-") zoomTo(scale - 0.5);
      else if (e.key === "0") reset();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomTo, scale, reset]);

  // Lock the document while open so the page behind keeps its scroll offset.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
      panStart.current = null;
    } else if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
      // Double tap / double click toggles fit ↔ 2×.
      const now = Date.now();
      if (now - lastTap.current < 300) {
        if (scale > 1) reset();
        else zoomTo(2);
      }
      lastTap.current = now;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart.current.dist > 0) zoomTo(pinchStart.current.scale * (dist / pinchStart.current.dist));
      return;
    }
    // One finger pans, but only once zoomed in — otherwise a stray drag on a
    // fitted image would slide it off centre for no reason.
    if (panStart.current && scale > 1) {
      setTx(panStart.current.tx + (e.clientX - panStart.current.x));
      setTy(panStart.current.ty + (e.clientY - panStart.current.y));
    }
  }

  function endPointer(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  }

  const caption = meta?.caption?.trim() || null;
  const credit = meta?.credit?.trim() || null;
  const author = meta?.author?.trim() || null;
  const creditUrl = meta?.creditUrl?.trim() || null;
  const hasMeta = Boolean(caption || credit || author);
  const closeLabel = lang === "fr" ? "Fermer" : "Close";

  const body = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || closeLabel}
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Controls */}
      <div className="flex-none flex items-center justify-end gap-2 px-3 py-2.5">
        <ZoomButton label="−" onClick={() => zoomTo(scale - 0.5)} disabled={scale <= MIN_SCALE} title={lang === "fr" ? "Dézoomer" : "Zoom out"} />
        <span className="text-[12px] font-bold text-white/70 tabular-nums w-[46px] text-center">{Math.round(scale * 100)}%</span>
        <ZoomButton label="+" onClick={() => zoomTo(scale + 0.5)} disabled={scale >= MAX_SCALE} title={lang === "fr" ? "Zoomer" : "Zoom in"} />
        <ZoomButton label="⤢" onClick={reset} disabled={scale === 1} title={lang === "fr" ? "Réinitialiser" : "Reset"} />
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label={closeLabel}
          className="w-9 h-9 rounded-full bg-white/[0.12] text-white flex items-center justify-center border-none"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Stage */}
      <div
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center"
        style={{ touchAction: "none", cursor: scale > 1 ? "grab" : "zoom-in" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={(e) => zoomTo(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain select-none"
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
        />
      </div>

      {/* Reference / caption bar (Correction N6: "ajouter les références") */}
      {hasMeta && (
        <div className="flex-none px-5 py-3 text-center" style={{ background: "rgba(0,0,0,0.55)" }}>
          {caption && <div className="text-[13px] text-white leading-snug">{caption}</div>}
          {(credit || author) && (
            <div className="text-[11.5px] text-white/60 mt-0.5">
              {[author, credit].filter(Boolean).join(" · ")}
              {creditUrl && (
                <>
                  {" · "}
                  <a href={creditUrl} target="_blank" rel="noopener noreferrer" className="underline text-white/80">
                    source
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(body, document.body);
}

function ZoomButton({ label, onClick, disabled, title }: { label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title ?? label}
      className="w-9 h-9 rounded-full bg-white/[0.12] text-white text-[16px] font-bold flex items-center justify-center border-none disabled:opacity-35"
    >
      {label}
    </button>
  );
}

/**
 * An `<img>` that opens itself in {@link ImageLightbox} when clicked. Every
 * content image in the app goes through this one component — lesson body,
 * story-card front and back, editor preview — so fullscreen + zoom needs no
 * per-caller wiring and behaves identically everywhere.
 */
export function ZoomableImage({
  src,
  alt = "",
  meta,
  className = "",
  style,
  onError,
}: {
  src: string;
  alt?: string;
  meta?: ImageMeta;
  className?: string;
  style?: React.CSSProperties;
  onError?: () => void;
}) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <img
        src={src}
        alt={alt}
        style={style}
        onError={onError}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        title={lang === "fr" ? "Agrandir" : "Enlarge"}
        className={`${className} cursor-zoom-in`}
      />
      {open && <ImageLightbox src={src} alt={alt} meta={meta} onClose={() => setOpen(false)} />}
    </>
  );
}
