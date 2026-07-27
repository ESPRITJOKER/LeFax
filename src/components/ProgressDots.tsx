export function ProgressDots({
  total,
  current,
  completed,
}: {
  total: number;
  current: number;
  completed: number[];
}) {
  return (
    <div className="flex gap-[5px] px-4">
      {Array.from({ length: total }, (_, i) => {
        let bg = "bg-border";
        if (completed.includes(i)) bg = "bg-success-600";
        else if (i === current) bg = "bg-accent";
        return <span key={i} className={`w-[7px] h-[7px] rounded-full ${bg}`} />;
      })}
    </div>
  );
}
