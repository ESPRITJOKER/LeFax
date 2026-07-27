import { Select } from "lefax-course";

export function Default() {
  return (
    <div className="p-4 w-[240px] bg-surface">
      <Select className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-ink-900" defaultValue="centre">
        <option value="" disabled>
          Sélectionner
        </option>
        <option value="centre">Centre</option>
        <option value="littoral">Littoral</option>
        <option value="ouest">Ouest</option>
      </Select>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="p-4 w-[240px] bg-surface">
      <Select
        className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-ink-900 opacity-40"
        disabled
        defaultValue="centre"
      >
        <option value="centre">Centre</option>
      </Select>
    </div>
  );
}
