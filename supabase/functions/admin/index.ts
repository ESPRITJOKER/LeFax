// admin — Administration (CDC 6.9 / section 10 "Administration: gestion
// étudiants/contenu/rôles, rapports")
//
// Anything that touches auth.users (suspend/reset password/invite) must go
// through the Supabase Admin API with the service role key, never from the
// client — hence an Edge Function. Every action is written to admin_logs
// (CDC 6.9 "journal d'audit").

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

async function requireAdmin(admin: ReturnType<typeof getServiceClient>, userId: string) {
  const { data } = await admin.from("profiles").select("role").eq("id", userId).single();
  return data && ["admin", "super_admin"].includes(data.role);
}

async function logAction(admin: ReturnType<typeof getServiceClient>, actorId: string, action: string, targetTable: string, targetId: string | null, metadata: Record<string, unknown> = {}) {
  await admin.from("admin_logs").insert({ actor_id: actorId, action, target_table: targetTable, target_id: targetId, metadata });
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  const admin = getServiceClient();
  if (!(await requireAdmin(admin, user.id))) return jsonResponse({ error: "forbidden" }, 403);

  try {
    const body = await req.json();

    if (body.action === "set_student_status") {
      const { user_id, status } = body;
      if (!user_id || !["active", "suspended"].includes(status)) return jsonResponse({ error: "invalid payload" }, 400);
      await admin.from("profiles").update({ status }).eq("id", user_id);
      // Suspending should also block the account at the auth layer.
      await admin.auth.admin.updateUserById(user_id, { ban_duration: status === "suspended" ? "876000h" : "none" });
      await logAction(admin, user.id, "set_student_status", "profiles", user_id, { status });
      return jsonResponse({ ok: true });
    }

    if (body.action === "reset_student_password") {
      const { user_id } = body;
      if (!user_id) return jsonResponse({ error: "user_id is required" }, 400);
      const tempPassword = crypto.randomUUID().slice(0, 12);
      await admin.auth.admin.updateUserById(user_id, { password: tempPassword });
      await logAction(admin, user.id, "reset_student_password", "profiles", user_id, {});
      // TODO: deliver tempPassword to the student out-of-band (SMS) once an
      // SMS provider is wired up; returning it here is scaffold-only.
      return jsonResponse({ ok: true, tempPassword });
    }

    if (body.action === "invite_admin") {
      const { first_name, last_name, phone, role } = body;
      if (!phone || !["teacher", "admin", "super_admin"].includes(role)) return jsonResponse({ error: "invalid payload" }, 400);

      const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
      if (role === "super_admin" && caller.role !== "super_admin") return jsonResponse({ error: "only super_admin can invite another super_admin" }, 403);

      const tempPassword = crypto.randomUUID().slice(0, 12);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        phone,
        password: tempPassword,
        phone_confirm: true,
        user_metadata: { first_name, last_name },
      });
      if (createError) return jsonResponse({ error: createError.message }, 400);

      await admin.from("profiles").update({ role }).eq("id", created.user.id);
      await logAction(admin, user.id, "invite_admin", "profiles", created.user.id, { role });
      // TODO: send the temp password to `phone` via the SMS provider once configured.
      return jsonResponse({ ok: true, userId: created.user.id, tempPassword });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
