import { useEffect, useState } from "react";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { Icon, type IconName } from "../../lib/icons";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { ShopItemRow } from "../../lib/database.types";

const ITEM_ICON: Record<ShopItemRow["item_type"], IconName> = {
  past_paper: "clipboard",
  correction: "flask",
  premium_lesson: "book",
  mock_correction: "target",
  exclusive_content: "medal",
};

export default function Shop() {
  const { t, lang } = useI18n();
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
      const { error } = await supabase.functions.invoke("faxcoins", { body: { action: "unlock", shop_item_id: item.id } });
      if (error) throw error;
      await refreshProfile();
      await load();
    } catch {
      // Backend not reachable yet — no-op, balance stays authoritative server-side.
    }
    setPendingId(null);
  }

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-[22px] pt-4">
          <div className="font-serif font-bold text-xl text-ink-950">{t("shop_title")}</div>
          <div className="flex items-center gap-1.5 bg-ochre-50 px-3 py-1.5 rounded-pill">
            <Icon name="coin" size={14} className="text-ochre-700" />
            <span className="text-[13px] font-bold text-ochre-700">{profile?.faxcoins ?? 0}</span>
          </div>
        </div>

        <div className="px-[22px] pt-4.5 pt-[18px] pb-6 grid grid-cols-2 gap-3">
          {loading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("shop_empty") : t("backend_banner")} />
          ) : (
            items.map((it) => {
              const unlocked = unlockedIds.has(it.id);
              const canAfford = (profile?.faxcoins ?? 0) >= it.price_coins;
              return (
                <div key={it.id} className="p-3.5 rounded-2xl border border-border flex flex-col gap-2">
                  <div className="w-full aspect-[4/3] rounded-[10px] bg-ink-50 flex items-center justify-center text-ink-700">
                    <Icon name={ITEM_ICON[it.item_type]} size={24} />
                  </div>
                  <div className="text-xs font-bold text-ink-900 leading-snug">{lang === "fr" ? it.name_fr : it.name_en}</div>
                  <div className="text-[11.5px] font-bold text-ochre-700 flex items-center gap-1">
                    <Icon name="coin" size={11} />
                    {it.price_coins}
                  </div>
                  <button
                    disabled={unlocked || !canAfford || pendingId === it.id}
                    onClick={() => unlock(it)}
                    className={`py-2 rounded-[9px] border-none text-[11.5px] font-bold ${
                      unlocked ? "bg-success-100 text-success-600" : canAfford ? "bg-ink-700 text-white" : "bg-ink-100 text-muted"
                    }`}
                  >
                    {unlocked
                      ? lang === "fr"
                        ? "Débloqué"
                        : "Unlocked"
                      : canAfford
                      ? lang === "fr"
                        ? "Débloquer"
                        : "Unlock"
                      : lang === "fr"
                      ? "Solde insuffisant"
                      : "Insufficient balance"}
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
