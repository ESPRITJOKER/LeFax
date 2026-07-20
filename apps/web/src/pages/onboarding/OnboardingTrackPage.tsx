import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BRANCH_SLUGS, LAUNCH_BRANCH, type BranchSlug } from "@lefax/shared";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api } from "../../lib/api-client";
import { useSessionStore } from "../../stores/session.store";

const BRANCH_ICONS: Record<BranchSlug, string> = {
  medecine: "medical_services",
  ingenierie: "engineering",
  agronomie: "agriculture",
  management: "business_center",
  infirmerie: "local_hospital",
  enseignement: "history_edu",
};

// Same decorative hero image used in the original Stitch export.
const HERO_IMAGE_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA_9n_cNc5d3VAm_DaCjfSweTP_sD3MPGRU5O20n8dt34ahH9zohvZLbcm91kxmCAuTJ6tB6LJTJRmdMfks5cFu7ZNhkV1E74V8e1W8q4U3WfRQ5oF1t0TfclMPvyJhI5xWLoszze1NUHqEiEsjSbAMtnXiDch5Ia0ZO0f34bWbhu2f0uYJsD4Gtu1mkM6MhG3JLzbrHv2OaGEnbpsJxslQOOFEewcUIrchtmkEbYIrXWVHj-bVPGsUfoXeogl5uhNym7wqNvX0QNQ";

interface BranchCardProps {
  slug: BranchSlug;
  isActive: boolean;
  isSelected: boolean;
  onToggle: (slug: BranchSlug) => void;
  full?: boolean;
}

function BranchCard({ slug, isActive, isSelected, onToggle, full }: BranchCardProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onToggle(slug)}
      disabled={!isActive}
      className={`text-left rounded-xl p-md flex items-center gap-md transition-all active:scale-[0.98] ${full ? "" : "flex-col items-start"} ${
        isSelected
          ? "bg-surface-container-lowest border-2 border-primary shadow-sm"
          : "bg-surface-container-lowest border border-outline-variant"
      } ${!isActive ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-outline"}`}
    >
      <div
        className={`rounded-lg flex items-center justify-center shrink-0 ${full ? "w-12 h-12" : "w-10 h-10"} ${
          isSelected ? "bg-primary-container text-white" : "bg-surface-container text-on-surface-variant"
        }`}
      >
        <MaterialIcon name={BRANCH_ICONS[slug]} />
      </div>
      <div className={`flex-1 min-w-0 ${full ? "" : "mt-sm w-full"}`}>
        <div className={full ? "flex justify-between items-center gap-sm" : "flex flex-col items-start gap-xs"}>
          <h3 className="font-label-lg text-label-lg text-primary">{t(`branches.${slug}`)}</h3>
          {isActive ? (
            <span className="bg-achievement-gold text-on-secondary-fixed text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
              {t("onboarding.mostPopular")}
            </span>
          ) : (
            <span className="bg-surface-container text-on-surface-variant text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
              {t("onboarding.comingSoon")}
            </span>
          )}
        </div>
      </div>
      {full && isSelected && <MaterialIcon name="check_circle" className="text-primary shrink-0" />}
    </button>
  );
}

/**
 * Ported from stitch_lefax_course_exam_prep/onboarding_track_selection
 * (screen.png). The mockup shows 6 target *schools* as a single-select —
 * confirmed with the user to keep the real multi-select *branch* model
 * (WEB-E02: only Médecine active, min. 1 required) and apply the mockup's
 * visual language (welcome hero, bento card layout) on top of it.
 */
export function OnboardingTrackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const updateUser = useSessionStore((s) => s.updateUser);
  const [selected, setSelected] = useState<BranchSlug[]>([LAUNCH_BRANCH]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(slug: BranchSlug) {
    if (slug !== LAUNCH_BRANCH) return; // coming soon — not selectable yet
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function confirm() {
    setError(null);
    if (selected.length === 0) {
      setError(t("onboarding.minOneError"));
      return;
    }
    setLoading(true);
    try {
      const res = await api.selectBranches(selected);
      updateUser(res.user);
      navigate("/app");
    } finally {
      setLoading(false);
    }
  }

  const [medecine, ...rest] = BRANCH_SLUGS;
  const middleFour = rest.slice(0, 4);
  const last = rest[4];

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center">
      <main className="w-full max-w-[560px] px-margin-mobile pt-xl pb-32 flex flex-col">
        <header className="mb-lg text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-excellence-blue flex items-center justify-center text-white shadow-lg mb-md">
            <MaterialIcon name="school" filled className="text-[32px]" />
          </div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary mb-sm">
            {t("onboarding.welcomeTitle")}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t("onboarding.welcomeSubtitlePrefix")} <strong className="text-text-primary">Grandes Écoles</strong>{" "}
            {t("onboarding.welcomeSubtitleSuffix")}
          </p>
        </header>

        <div className="relative rounded-xl overflow-hidden aspect-video mb-xl shadow-sm border border-outline-variant">
          <img src={HERO_IMAGE_URL} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent flex items-end p-md">
            <span className="text-white font-label-lg text-label-lg flex items-center gap-2">
              <MaterialIcon name="workspace_premium" filled className="text-[18px]" />
              {t("onboarding.heroBadge")}
            </span>
          </div>
        </div>

        <div className="mb-md">
          <h2 className="font-headline-md text-headline-md text-primary">{t("onboarding.title")}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{t("onboarding.subtitle")}</p>
        </div>

        <div className="flex flex-col gap-md">
          <BranchCard slug={medecine} isActive isSelected={selected.includes(medecine)} onToggle={toggle} full />
          <div className="grid grid-cols-2 gap-md">
            {middleFour.map((slug) => (
              <BranchCard key={slug} slug={slug} isActive={false} isSelected={selected.includes(slug)} onToggle={toggle} />
            ))}
          </div>
          {last && (
            <BranchCard slug={last} isActive={false} isSelected={selected.includes(last)} onToggle={toggle} full />
          )}
        </div>
        {error && <p className="mt-md font-label-md text-label-md text-error-red">{error}</p>}
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-white/85 backdrop-blur border-t border-outline-variant px-margin-mobile py-md flex justify-center z-50">
        <button
          type="button"
          onClick={confirm}
          disabled={loading}
          className="w-full max-w-[400px] bg-primary text-on-primary h-14 rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? t("common.loading") : t("onboarding.confirm")}
          <MaterialIcon name="arrow_forward" />
        </button>
      </div>
    </div>
  );
}
