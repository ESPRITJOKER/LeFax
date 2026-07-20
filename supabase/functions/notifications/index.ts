// notifications — Notifications (CDC 6.11 / section 10 "Notifications")
//
// Reading/marking-read one's own notifications is a plain RLS-scoped table
// operation the client already does directly (`notifications_own`). This
// function is the write path for *system-generated* notifications (daily
// reminders, mock-exam reminders, reward/ranking updates) that must be
// broadcast to many users at once — something no single user's RLS session
// should be able to do, hence service role + admin-only guard.
//
// Web Push (VAPID) delivery is CDC's in-app + push-web channel; the actual
// browser push send is a TODO pending VAPID key generation (out of scope for
// this scaffold pass — see README).

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  const admin = getServiceClient();

  try {
    const body = await req.json();

    if (body.action === "broadcast") {
      const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
      if (!caller || !["admin", "super_admin"].includes(caller.role)) return jsonResponse({ error: "forbidden" }, 403);

      const { type, title_fr, title_en, body_fr, body_en, user_ids } = body;
      if (!type || !title_fr || !title_en) return jsonResponse({ error: "invalid payload" }, 400);

      let targetIds: string[] = user_ids ?? [];
      if (!targetIds.length) {
        const { data: allStudents } = await admin.from("profiles").select("id").eq("role", "student");
        targetIds = (allStudents ?? []).map((p: { id: string }) => p.id);
      }

      const rows = targetIds.map((uid) => ({
        user_id: uid,
        type,
        title_fr,
        title_en,
        body_fr: body_fr ?? "",
        body_en: body_en ?? "",
      }));
      await admin.from("notifications").insert(rows);

      // TODO: also send Web Push (VAPID) payloads to subscribed devices once
      // push subscriptions are stored and VAPID keys are generated.

      return jsonResponse({ ok: true, sent: rows.length });
    }

    if (body.action === "mark_all_read") {
      await admin.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
