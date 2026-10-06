import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";

/**
 * The modal dialog this project did not have. Confirmations used `window.confirm`
 * and the only `role="dialog"` anywhere was `ImageLightbox`; the ribbon's image
 * and table pickers need something real, so the behaviour that lightbox already
 * proves out (Esc, scroll lock, backdrop click, focus return) is generalised
 * here.
 *
 * It portals to `document.body`, and that is not cosmetic: `LessonEditorCore`
 * wraps its whole content tab in `<fieldset disabled={!canEdit}>`, so a dialog
 * rendered in place would have every one of its controls disabled whenever the
 * lesson is read-only — which would look like "the dialog is broken" rather than
 * "the lesson is locked". The ribbon and its popovers stay inside the fieldset
 * on purpose (they SHOULD go dead with it); only the portalled dialog escapes,
 * which is why its caller has to re-check the permission itself before writing
 * anything.
 *
 * `bg-black/60` for the backdrop rather than a token with an opacity modifier:
 * Tailwind cannot parse this project's bare `var(--color-…)` values, so it drops
 * a class like `bg-ink-950/60` from the stylesheet entirely and the backdrop
 * would come out fully opaque-black or absent. Literal colours do take alpha.
 */
export function EditorDialog({
  title,
  onClose,
  children,
  footer,
  width = 520,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Keep Tab inside the dialog: it is modal, and the page behind it is a
      // long editor the author would otherwise tab away into.
      const focusable = panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey, true);
    // Focus the first real control, so a keyboard author lands in the form.
    panel.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();

    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previous;
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: width }}
        className="w-full bg-card text-ink-900 border border-border rounded-2xl shadow-[0_24px_60px_-20px_rgba(15,30,60,0.55)] my-auto"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div id={titleId} className="font-serif font-bold text-[14px] text-ink-900 flex-1 min-w-0">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("ed_close")}
            title={t("ed_close")}
            className="p-1.5 rounded-lg border border-border bg-card text-ink-700"
          >
            <Icon name="close" size={13} />
          </button>
        </div>

        <div className="px-4 py-4 max-h-[70vh] overflow-y-auto">{children}</div>

        {footer && <div className="px-4 py-3 border-t border-border flex gap-2 flex-wrap justify-end">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** The dialogs' shared labelled field, so they look like one family. */
export function DialogField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 mb-3">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="text-[10.5px] text-muted leading-snug">{hint}</span>}
    </label>
  );
}

export const dialogInputClass =
  "px-2.5 py-2 rounded-lg border-[1.5px] border-ink-300 bg-card text-ink-900 text-[12.5px] w-full";

export function DialogButton({
  children,
  onClick,
  variant = "secondary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        variant === "primary"
          ? "border-none px-4 py-2 rounded-xl text-[12.5px] font-bold bg-brand-600 text-white disabled:opacity-50"
          : "border border-border bg-card px-4 py-2 rounded-xl text-[12.5px] font-bold text-ink-900 disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}
