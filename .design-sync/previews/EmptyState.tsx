import { EmptyState } from "lefax-course";

export function Default() {
  return (
    <div className="w-[280px] bg-surface">
      <EmptyState label="Aucune notification pour le moment" />
    </div>
  );
}
