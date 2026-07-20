// faxcoins — FaxCoins (CDC 6.5 / section 10 "FaxCoins: solde, historique, déblocage")
//
// Ledger math (spend/earn, balance updates, rarity stock decrement) is fully
// implemented here since it needs no external secrets and, per CDC 8.1, must
// never be computed client-side.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const body = await req.json();
    const admin = getServiceClient();

    if (body.action === "balance") {
      const { data } = await admin.from("profiles").select("faxcoins").eq("id", user.id).single();
      return jsonResponse({ faxcoins: data?.faxcoins ?? 0 });
    }

    if (body.action === "history") {
      const { data } = await admin
        .from("faxcoins_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return jsonResponse({ transactions: data ?? [] });
    }

    if (body.action === "unlock") {
      const { shop_item_id } = body;
      if (!shop_item_id) return jsonResponse({ error: "shop_item_id is required" }, 400);

      const { data: item } = await admin.from("shop_items").select("*").eq("id", shop_item_id).eq("active", true).maybeSingle();
      if (!item) return jsonResponse({ error: "item not found" }, 404);

      const { data: existingUnlock } = await admin
        .from("shop_unlocks")
        .select("id")
        .eq("user_id", user.id)
        .eq("shop_item_id", shop_item_id)
        .maybeSingle();
      if (existingUnlock) return jsonResponse({ error: "already unlocked" }, 409);

      if (item.is_limited && (item.stock_remaining ?? 0) <= 0) return jsonResponse({ error: "out of stock" }, 409);

      const { data: profile } = await admin.from("profiles").select("faxcoins").eq("id", user.id).single();
      const balance = profile?.faxcoins ?? 0;
      if (balance < item.price_coins) return jsonResponse({ error: "insufficient balance" }, 402);

      const newBalance = balance - item.price_coins;
      await admin.from("profiles").update({ faxcoins: newBalance }).eq("id", user.id);
      await admin.from("faxcoins_transactions").insert({
        user_id: user.id,
        amount: -item.price_coins,
        reason: "shop_unlock",
        reference_id: shop_item_id,
        balance_after: newBalance,
      });
      await admin.from("shop_unlocks").insert({ user_id: user.id, shop_item_id });
      if (item.is_limited) {
        await admin.from("shop_items").update({ stock_remaining: Math.max(0, (item.stock_remaining ?? 1) - 1) }).eq("id", shop_item_id);
      }

      return jsonResponse({ ok: true, newBalance });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
