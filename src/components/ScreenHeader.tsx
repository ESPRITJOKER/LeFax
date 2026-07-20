import { useNavigate } from "react-router-dom";
import { Icon } from "../lib/icons";

export function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 px-[22px] pt-4">
      <button
        onClick={onBack ?? (() => navigate(-1))}
        className="border-none bg-ink-100 w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-ink-800"
        aria-label="back"
      >
        <Icon name="chevleft" size={18} />
      </button>
      <div className="font-serif font-bold text-[19px] text-ink-900">{title}</div>
    </div>
  );
}
