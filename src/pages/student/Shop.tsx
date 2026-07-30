import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { TopBar } from "../../components/TopBar";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured, invokeFn } from "../../lib/supabaseClient";
import type { ShopItemRow } from "../../lib/database.types";

const ITEM_STYLE: Record<ShopItemRow["item_type"], { emoji: string; bg: string; fr: string; en: string }> = {
  past_paper: { emoji: "📘", bg: "#e8f4ff", fr: "Anciennes épreuves", en: "Past exam papers" },
  correction: { emoji: "🎯", bg: "#fff4e0", fr: "Corrigés détaillés", en: "Detailed corrections" },
  premium_lesson: { emoji: "📖", bg: "#f3e8ff", fr: "Leçon premium", en: "Premium lesson" },
  mock_correction: { emoji: "🖼️", bg: "#fdeaf0", fr: "Correction de concours blanc", en: "Mock exam correction" },
  exclusive_content: { emoji: "🚀", bg: "#dcf5e3", fr: "Contenu exclusif", en: "Exclusive content" },
};

export default function Shop() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const [items, setItems] = useState<ShopItemRow[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function load() {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data: itemRows } = await supabase.from("shop_items").select("*").eq("active", true);
    setItems(itemRows ?? []);
    if (profile) {
      const { data: unlockRows } = await supabase.from("shop_unlocks").select("shop_item_id").eq("user_id", profile.id);
      setUnlockedIds(new Set((unlockRows ?? []).map((u) => u.shop_item_id)));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function unlock(item: ShopItemRow) {
    setPendingId(item.id);
    try {
      const { error } = await invokeFn("faxcoins", { action: "unlock", shop_item_id: item.id });
      if (error) throw error;
      await refreshProfile();
      await load();
    } catch {
      // Backend not reachable yet — balance stays authoritative server-side.
    }
    setPendingId(null);
  }

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col">
        <TopBar variant="back" coins={profile?.faxcoins ?? 0} onBack={() => navigate("/dashboard")} />

        <div className="flex-1 min-h-0 overflow-auto px-5 pt-4 pb-[90px]">
          <h2 className="font-serif font-bold text-[18px] text-ink-900 mb-1">{lang === "fr" ? "Boutique FaxCoins" : "FaxCoins shop"}</h2>
          <p className="text-[12.5px] text-[#647084] mb-[18px]">
            {lang === "fr" ? "Dépense tes FaxCoins pour débloquer du contenu premium" : "Spend your FaxCoins to unlock premium content"}
          </p>

          {loading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("shop_empty") : t("backend_banner")} />
          ) : (
            items.map((it) => {
              const unlocked = unlockedIds.has(it.id);
              const canAfford = (profile?.faxcoins ?? 0) >= it.price_coins;
              const st = ITEM_STYLE[it.item_type] ?? { emoji: "📦", bg: "#e8f4ff" };
              const disabled = unlocked || !canAfford || pendingId === it.id;
              return (
                <div key={it.id} className="flex items-center gap-3.5 bg-card rounded-[12px] px-4 py-3.5 shadow-[0_2px_8px_rgba(20,30,60,0.05)] mb-2.5">
                  <div className="w-11 h-11 rounded-[10px] flex items-center justify-center text-[20px] flex-shrink-0" style={{ background: st.bg }}>
                    {st.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="font-serif font-semibold text-[13.5px] text-ink-900">{lang === "fr" ? it.name_fr : it.name_en}</div>
                    <div className="text-[11.5px] text-muted mt-0.5">{lang === "fr" ? st.fr : st.en}</div>
                  </div>
                  <button
                    disabled={disabled}
                    onClick={() => unlock(it)}
                    className="rounded-[8px] px-3 py-2 font-serif font-bold text-[12px] whitespace-nowrap"
                    style={{
                      background: unlocked ? "#eef1f5" : "#f5b400",
                      color: unlocked ? "#94a3b8" : "#1e2a3a",
                    }}
                  >
                    {unlocked
                      ? lang === "fr" ? "Débloqué" : "Unlocked"
                      : canAfford
                        ? `${it.price_coins} f`
                        : lang === "fr" ? "Solde bas" : "Low balance"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <BottomTabs />
      </div>
    </PhoneFrame>
  );
}
