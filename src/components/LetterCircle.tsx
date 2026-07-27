export function LetterCircle({
  letter,
  selected,
  correct,
  wrong,
}: {
  letter: string;
  selected?: boolean;
  correct?: boolean;
  wrong?: boolean;
}) {
  let cls = "border-border bg-white text-muted";
  if (correct) cls = "bg-success-600 border-success-600 text-white";
  else if (wrong) cls = "bg-danger-600 border-danger-600 text-white";
  else if (selected) cls = "border-ink-700 bg-brand-600 text-white";

  return (
    <div
      className={`w-6 h-6 flex-none rounded-full border-[1.5px] flex items-center justify-center text-[11px] font-extrabold ${cls}`}
    >
      {letter}
    </div>
  );
}
