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

async function notify(
  admin: ReturnType<typeof getServiceClient>,
  userId: string,
  type: string,
  titleFr: string,
  titleEn: string,
  bodyFr = "",
  bodyEn = ""
) {
  await admin.from("notifications").insert({ user_id: userId, type, title_fr: titleFr, title_en: titleEn, body_fr: bodyFr, body_en: bodyEn });
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

    // -----------------------------------------------------------------------
    // Teacher management (0018). Reading the roster is open to any admin;
    // changing who teaches what is super_admin only — the same boundary the
    // teacher_subjects RLS policy enforces at the database.
    // -----------------------------------------------------------------------
    if (body.action === "list_teachers") {
      const { data: teachers } = await admin
        .from("profiles")
        .select("id, first_name, last_name, phone, role, status, created_at, last_active_on")
        .in("role", ["teacher", "admin", "super_admin"])
        .order("created_at", { ascending: false });

      const ids = (teachers ?? []).map((p: { id: string }) => p.id);
      const { data: grants } = ids.length
        ? await admin.from("teacher_subjects").select("*").in("teacher_id", ids)
        : { data: [] };
      const { data: subjects } = await admin.from("subjects").select("id, slug, name_fr, name_en, position").order("position");
      const { data: lessons } = ids.length
        ? await admin.from("lessons").select("id, author_id, review_status, published").in("author_id", ids)
        : { data: [] };
      const { data: approvals } = ids.length
        ? await admin.from("content_approval").select("id, submitted_by, status").in("submitted_by", ids)
        : { data: [] };

      const rows = (teachers ?? []).map((p: { id: string }) => {
        const mine = (lessons ?? []).filter((l: { author_id: string | null }) => l.author_id === p.id);
        const subs = (approvals ?? []).filter((a: { submitted_by: string | null }) => a.submitted_by === p.id);
        return {
          ...p,
          assignments: (grants ?? []).filter((g: { teacher_id: string }) => g.teacher_id === p.id),
          content: {
            lessons: mine.length,
            drafts: mine.filter((l: { review_status: string }) => l.review_status === "draft").length,
            submitted: mine.filter((l: { review_status: string }) => ["submitted", "under_review"].includes(l.review_status)).length,
            approved: mine.filter((l: { review_status: string }) => l.review_status === "approved").length,
            published: mine.filter((l: { published: boolean }) => l.published).length,
          },
          approvals: {
            pending: subs.filter((a: { status: string }) => a.status === "pending").length,
            total: subs.length,
          },
        };
      });

      return jsonResponse({ teachers: rows, subjects: subjects ?? [] });
    }

    if (body.action === "assign_subject" || body.action === "revoke_subject") {
      if (callerRole !== "super_admin") return jsonResponse({ error: "only a super_admin can change subject assignments" }, 403);
      const { teacher_id, subject_id } = body;
      if (!teacher_id || !subject_id) return jsonResponse({ error: "teacher_id and subject_id are required" }, 400);

      const targetRole = await getRole(admin, teacher_id);
      if (!targetRole) return jsonResponse({ error: "target not found" }, 404);
      if (!["teacher", "admin", "super_admin"].includes(targetRole)) {
        return jsonResponse({ error: "target is not a teacher — grant the teacher role first" }, 409);
      }
      const { data: subject } = await admin.from("subjects").select("id, name_fr, name_en").eq("id", subject_id).maybeSingle();
      if (!subject) return jsonResponse({ error: "subject not found" }, 404);

      const revoking = body.action === "revoke_subject";
      // unique(teacher_id, subject_id): re-granting flips the existing row back
      // to active rather than piling up history rows.
      const { error: upsertError } = await admin.from("teacher_subjects").upsert(
        {
          teacher_id,
          subject_id,
          assigned_by: user.id,
          status: revoking ? "revoked" : "active",
          revoked_at: revoking ? new Date().toISOString() : null,
        },
        { onConflict: "teacher_id,subject_id" }
      );
      if (upsertError) return jsonResponse({ error: upsertError.message }, 400);

      // The teacher_subjects_audit trigger writes admin_logs for this change.
      await notify(
        admin,
        teacher_id,
        "subject_assigned",
        revoking ? "Matière retirée" : "Nouvelle matière assignée",
        revoking ? "Subject removed" : "New subject assigned",
        revoking ? `Vous n'enseignez plus : ${subject.name_fr}` : `Vous pouvez désormais créer du contenu en ${subject.name_fr}`,
        revoking ? `You no longer teach: ${subject.name_en}` : `You can now author content in ${subject.name_en}`
      );

      return jsonResponse({ ok: true, status: revoking ? "revoked" : "active" });
    }

    if (body.action === "set_role") {
      if (callerRole !== "super_admin") return jsonResponse({ error: "only a super_admin can change roles" }, 403);
      const { user_id, role } = body;
      if (!user_id || !["student", "teacher", "admin", "super_admin"].includes(role)) return jsonResponse({ error: "invalid payload" }, 400);
      if (user_id === user.id) return jsonResponse({ error: "cannot change your own role" }, 403);

      const { error } = await admin.from("profiles").update({ role }).eq("id", user_id);
      if (error) return jsonResponse({ error: error.message }, 400);
      await logAction(admin, user.id, "set_role", "profiles", user_id, { role });
      return jsonResponse({ ok: true });
    }

    // -----------------------------------------------------------------------
    // Lesson review + publication. This is the ONLY path that sets
    // lessons.published, and it is admin-only — teachers are blocked by both
    // the lessons RLS policies and the guard_lesson_teacher_fields trigger
    // (0018). FR-10: "Teacher can never self-publish".
    // -----------------------------------------------------------------------
    if (body.action === "review_lesson") {
      const { lesson_id, decision, feedback, publish } = body;
      if (!lesson_id || !["under_review", "approve", "reject"].includes(decision)) {
        return jsonResponse({ error: "decision must be one of: under_review, approve, reject" }, 400);
      }

      const { data: lesson } = await admin
        .from("lessons")
        .select("id, author_id, title_fr, title_en, review_status, published")
        .eq("id", lesson_id)
        .maybeSingle();
      if (!lesson) return jsonResponse({ error: "lesson not found" }, 404);

      const now = new Date().toISOString();
      const nextStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "under_review";
      // Publishing is opt-in even on approval, so an admin can approve a batch
      // and release it later.
      const nextPublished = decision === "approve" ? publish === true : decision === "reject" ? false : lesson.published;

      const { error } = await admin
        .from("lessons")
        .update({
          review_status: nextStatus,
          published: nextPublished,
          review_feedback: typeof feedback === "string" && feedback.trim() ? feedback.trim() : null,
          reviewed_by: user.id,
          reviewed_at: now,
        })
        .eq("id", lesson_id);
      if (error) return jsonResponse({ error: error.message }, 400);

      // Close the matching queue entries so the same lesson doesn't sit in the
      // reviewers' list twice.
      await admin
        .from("content_approval")
        .update({
          status: decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "pending",
          reviewed_by: user.id,
          reviewed_at: now,
          feedback: typeof feedback === "string" ? feedback : null,
        })
        .eq("lesson_id", lesson_id)
        .eq("kind", "lesson")
        .eq("status", "pending");

      await logAction(admin, user.id, `lesson_${decision}`, "lessons", lesson_id, { published: nextPublished, feedback: feedback ?? null });

      if (lesson.author_id && lesson.author_id !== user.id) {
        if (decision === "approve") {
          await notify(
            admin,
            lesson.author_id,
            "content_approved",
            "Contenu approuvé",
            "Content approved",
            `${lesson.title_fr} a été approuvé${nextPublished ? " et publié" : ""}.`,
            `${lesson.title_en || lesson.title_fr} was approved${nextPublished ? " and published" : ""}.`
          );
        } else if (decision === "reject") {
          await notify(
            admin,
            lesson.author_id,
            "content_rejected",
            "Corrections demandées",
            "Corrections requested",
            feedback ? String(feedback) : `${lesson.title_fr} doit être corrigé.`,
            feedback ? String(feedback) : `${lesson.title_en || lesson.title_fr} needs corrections.`
          );
        }
      }

      return jsonResponse({ ok: true, review_status: nextStatus, published: nextPublished });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
