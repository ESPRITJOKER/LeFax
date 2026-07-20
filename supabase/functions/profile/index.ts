// profile — Profil utilisateur (CDC 6.12 / section 10 "profil")
//
// Editing one's own region/town/language/dark-mode/notification prefs is a
// plain RLS-scoped update the client does directly (`profiles_update_own`
// — see src/pages/student/Profile.tsx). This function covers the two
// account actions that must not be client-side: password changes that also
// need an audit trail, and full account deletion (right-to-erasure), both
// of which touch `auth.users` via the Admin API.

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

    if (body.action === "change_password") {
      const { new_password } = body;
      if (!new_password || new_password.length < 8) return jsonResponse({ error: "password too short" }, 400);
      const { error } = await admin.auth.admin.updateUserById(user.id, { password: new_password });
      if (error) return jsonResponse({ error: error.message }, 400);
      await admin.from("admin_logs").insert({ actor_id: user.id, action: "self_change_password", target_table: "profiles", target_id: user.id, metadata: {} });
      return jsonResponse({ ok: true });
    }

    if (body.action === "delete_account") {
      await admin.from("admin_logs").insert({ actor_id: user.id, action: "self_delete_account", target_table: "profiles", target_id: user.id, metadata: {} });
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
