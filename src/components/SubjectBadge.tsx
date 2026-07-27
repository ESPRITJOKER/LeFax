import { Icon, subjectIcon, subjectColors } from "../lib/icons";

interface SubjectBadgeProps {
  slug: string;
  size?: "sm" | "md" | "lg";
  showName?: string | null;
  className?: string;
}

const sizeMap = {
  sm: { box: "w-7 h-7 rounded-[9px]", icon: 14 },
  md: { box: "w-10 h-10 rounded-[11px]", icon: 20 },
  lg: { box: "w-[72px] h-[72px] rounded-[20px]", icon: 34 },
};

export function SubjectBadge({ slug, size = "md", showName = null, className = "" }: SubjectBadgeProps) {
  const colors = subjectColors(slug);
  const icon = subjectIcon(slug);
  const s = sizeMap[size];

  return (
    <div className={`flex ${size === "lg" ? "flex-row items-center gap-4" : "flex-col items-center gap-1.5"} ${className}`}>
      <div className={`${s.box} bg-gradient-to-br ${colors.gradient} flex items-center justify-center flex-none`}>
        <Icon name={icon} size={s.icon} className="text-white" />
      </div>
      {showName && (
        <div className={`${size === "lg" ? "text-[19px] font-bold text-text leading-tight" : "text-[11px] font-bold text-text text-center leading-tight"}`}>
          {showName}
        </div>
      )}
    </div>
  );
}
