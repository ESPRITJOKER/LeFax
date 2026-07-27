import { Card, ProgressBar } from "lefax-course";

export function Default() {
  return (
    <Card className="p-4 w-[280px]">
      <div className="font-serif font-bold text-[15px] text-ink-900">Biologie — Chapitre 3</div>
      <div className="text-xs text-muted mt-1">La cellule eucaryote</div>
    </Card>
  );
}

export function Clickable() {
  return (
    <Card className="p-4 w-[280px]" onClick={() => {}}>
      <div className="flex items-center justify-between">
        <div className="font-serif font-bold text-[15px] text-ink-900">Chimie organique</div>
        <div className="text-xs font-bold text-success-600">68%</div>
      </div>
      <div className="text-xs text-muted mt-1 mb-2">12 leçons</div>
      <ProgressBar pct={68} />
    </Card>
  );
}
