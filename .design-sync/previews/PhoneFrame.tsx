import { PhoneFrame, ScreenHeader, Card, ProgressBar } from "lefax-course";

export function Default() {
  return (
    <PhoneFrame>
      <ScreenHeader title="Tableau de bord" />
      <div className="p-5 flex flex-col gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted mb-1">Ma progression</div>
          <ProgressBar pct={62} />
        </Card>
        <Card className="p-4">
          <div className="font-serif font-bold text-ink-900">Biologie — Chapitre 3</div>
          <div className="text-xs text-muted mt-1">Dernière leçon consultée</div>
        </Card>
      </div>
    </PhoneFrame>
  );
}
