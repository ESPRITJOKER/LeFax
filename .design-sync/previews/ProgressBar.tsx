import { ProgressBar } from "lefax-course";

export function Colors() {
  return (
    <div className="flex flex-col gap-4 p-4 w-[240px] bg-surface">
      <div>
        <div className="text-xs text-muted mb-1">Progression globale — 72%</div>
        <ProgressBar pct={72} color="success" />
      </div>
      <div>
        <div className="text-xs text-muted mb-1">Chapitre en cours — 45%</div>
        <ProgressBar pct={45} color="ink" />
      </div>
      <div>
        <div className="text-xs text-muted mb-1">FaxCoins hebdo — 90%</div>
        <ProgressBar pct={90} color="ochre" />
      </div>
    </div>
  );
}

export function Empty() {
  return (
    <div className="p-4 w-[240px] bg-surface">
      <ProgressBar pct={0} />
    </div>
  );
}
