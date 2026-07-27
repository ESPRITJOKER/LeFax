// admin — Administration (CDC 6.9 / section 10 "Administration: gestion
// étudiants/contenu/rôles, rapports")
//
// Anything that touches auth.users (suspend/reset password/invite) must go
// through the Supabase Admin API with the service role key, never from the
// client — hence an Edge Function. Every action is written to admin_logs
// (CDC 6.9 "journal d'audit").

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

async function getRole(admin: ReturnType<typeof getServiceClient>, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role ?? null;
}

// Authorization for actions that mutate another account (suspend, reset).
// A regular `admin` may only manage students/teachers; acting on an `admin` or
// `super_admin` requires `super_admin`. Acting on your own account is refused
// so an admin can't accidentally lock themselves out.
async function assertCanManage(
  admin: ReturnType<typeof getServiceClient>,
  callerRole: string,
  callerId: string,
  targetId: string
): Promise<Response | null> {
  if (targetId === callerId) return jsonResponse({ error: "cannot perform this action on your own account" }, 403);
  const targetRole = await getRole(admin, targetId);
  if (!targetRole) return jsonResponse({ error: "target not found" }, 404);
  if (["admin", "super_admin"].includes(targetRole) && callerRole !== "super_admin") {
    return jsonResponse({ error: "only a super_admin can manage admin accounts" }, 403);
  }
  return null;
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
  const callerRole = await getRole(admin, user.id);
  if (!callerRole || !["admin", "super_admin"].includes(callerRole)) return jsonResponse({ error: "forbidden" }, 403);

  try {
    const body = await req.json();

    if (body.action === "set_student_status") {
      const { user_id, status } = body;
      if (!user_id || !["active", "suspended"].includes(status)) return jsonResponse({ error: "invalid payload" }, 400);
      const denied = await assertCanManage(admin, callerRole, user.id, user_id);
      if (denied) return denied;
      await admin.from("profiles").update({ status }).eq("id", user_id);
      // Suspending should also block the account at the auth layer.
      await admin.auth.admin.updateUserById(user_id, { ban_duration: status === "suspended" ? "876000h" : "none" });
      await logAction(admin, user.id, "set_student_status", "profiles", user_id, { status });
      return jsonResponse({ ok: true });
    }

    if (body.action === "reset_student_password") {
      const { user_id } = body;
      if (!user_id) return jsonResponse({ error: "user_id is required" }, 400);
      const denied = await assertCanManage(admin, callerRole, user.id, user_id);
      if (denied) return denied;
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

      if (role === "super_admin" && callerRole !== "super_admin") return jsonResponse({ error: "only super_admin can invite another super_admin" }, 403);

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
