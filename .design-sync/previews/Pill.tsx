import { Pill } from "lefax-course";

export function Group() {
  return (
    <div className="flex gap-2 p-4 bg-surface">
      <Pill active>Régional</Pill>
      <Pill>National</Pill>
      <Pill>Hebdo</Pill>
    </div>
  );
}
