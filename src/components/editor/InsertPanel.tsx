import { useState } from "react";
import { FormulaTool } from "../FormulaTool";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { SYMBOL_GROUPS } from "../../lib/math";
import type { RibbonPanel } from "./ribbonTypes";

/**
 * One panel with three tabs — Maths, Chimie, Symboles — rather than three
 * separate panels.
 *
 * The maths and chemistry tabs ARE `FormulaTool`, unchanged: a template palette,
 * a TeX field, a live typeset preview and a validity message. Only the symbol tab
 * is new, and it is deliberately different: it inserts **bare Unicode**, not TeX.
 * A degree sign or a reaction arrow in a sentence should stay selectable,
 * searchable text rather than becoming a KaTeX span, so `→` goes in as `→`. The
 * checkbox is for the author who really does want `$…$` around it.
 *
 * Keeping all three behind one component keeps the caret handling in one place:
 * no tab ever takes the textarea's selection, because `MarkupField` snapshots it
 * before the panel opens and the panel only ever calls back out.
 */
export function InsertPanel({
  panel,
  onInsert,
  onSwitch,
  onClose,
}: {
  panel: RibbonPanel;
  onInsert: (text: string) => void;
  onSwitch: (panel: RibbonPanel) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [asFormula, setAsFormula] = useState(false);

  const tabs = <PanelTabs panel={panel} onPick={onSwitch} />;

  if (panel !== "symbol") {
    return <FormulaTool mode={panel} onInsert={onInsert} onClose={onClose} header={tabs} />;
  }

  return (
    <div className="rounded-2xl border-[1.5px] border-brand-600 bg-card p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        {tabs}
        <div className="flex-1" />
        <button type="button" onClick={onClose} aria-label={t("ed_close")} className="p-1 rounded-md border border-border text-ink-700">
          <Icon name="close" size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto">
        {SYMBOL_GROUPS.map((group) => (
          <div key={group.key}>
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted mb-1.5">{t(group.titleKey)}</div>
            <div className="flex flex-wrap gap-1">
              {group.chars.map((ch, i) => (
                <button
                  key={`${group.key}-${i}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onInsert(asFormula ? `$${ch}$` : ch)}
                  title={ch}
                  aria-label={ch}
                  className="w-8 h-8 rounded-lg border border-border bg-card hover:bg-ink-50 text-[15px] text-ink-900 flex items-center justify-center"
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 mt-3 text-[11.5px] text-ink-800">
        <input type="checkbox" checked={asFormula} onChange={(e) => setAsFormula(e.target.checked)} />
        {t("ed_symbolAsFormula")}
      </label>
    </div>
  );
}

/** The three tabs, rendered in the header of whichever panel is open. */
function PanelTabs({ panel, onPick }: { panel: RibbonPanel; onPick: (p: RibbonPanel) => void }) {
  const { t } = useI18n();
  const tabs: { id: RibbonPanel; label: string }[] = [
    { id: "math", label: t("ed_mathTab") },
    { id: "chem", label: t("ed_chemTab") },
    { id: "symbol", label: t("ed_symbolTab") },
  ];
  return (
    <div role="tablist" aria-label={t("ed_grpInsert")} className="flex items-center gap-1 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={panel === tab.id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(tab.id)}
          className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold border ${
            panel === tab.id ? "border-brand-600 bg-ink-100 text-brand-600" : "border-border bg-card text-ink-800"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
