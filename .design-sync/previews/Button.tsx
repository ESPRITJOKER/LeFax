import { Button } from "lefax-course";

export function Variants() {
  return (
    <div className="flex flex-wrap gap-3 p-4 bg-surface">
      <Button variant="primary">Enregistrer</Button>
      <Button variant="secondary">Annuler</Button>
      <Button variant="ghost">Modifier</Button>
      <Button variant="danger">Supprimer</Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex gap-3 p-4 bg-surface">
      <Button variant="primary" disabled>
        Enregistrer
      </Button>
      <Button variant="secondary" disabled>
        Annuler
      </Button>
    </div>
  );
}
