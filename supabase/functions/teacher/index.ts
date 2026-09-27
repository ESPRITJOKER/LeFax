// teacher — Enseignant (CDC 6.10 / section 10 "Enseignant: dépôt contenu,
// suivi performance")
//
// Everything a teacher does that must not be decided by the browser lives here.
// Plain content edits stay direct, RLS-scoped table writes from the Teacher
// panel (0018 scopes them to the teacher's assigned subjects and to drafts they
// own); this function owns the operations where the server is the authority:
//
//   my_subjects         — the caller's active subject grants, with counts.
//   dashboard_summary   — the whole dashboard in one aggregate round-trip.
//   submit_lesson       — the draft -> submitted transition, validated, logged,
//                         and announced to the reviewers. A teacher can never
//                         publish (FR-10): this only asks for review.
//   performance_summary — attempts/average per quiz over the caller's content.
//
// Every action re-reads the caller's role and grants from the database with the
// service client, never trusting anything the client sent.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

type Admin = ReturnType<typeof getServiceClient>;

const STAFF = ["teacher", "admin", "super_admin"];

async function getRole(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("role, status").eq("id", userId).maybeSingle();
  if (!data || data.status !== "active") return null;
  return data.role ?? null;
}

/** Subject ids the caller may author in. Admins get every subject. */
async function assignedSubjectIds(admin: Admin, userId: string, role: string): Promise<string[]> {
  if (role === "admin" || role === "super_admin") {
    const { data } = await admin.from("subjects").select("id");
    return (data ?? []).map((s: { id: string }) => s.id);
  }
  const { data } = await admin
    .from("teacher_subjects")
    .select("subject_id")
    .eq("teacher_id", userId)
    .eq("status", "active");
  return (data ?? []).map((r: { subject_id: string }) => r.subject_id);
}

/** Lesson ids authored by the caller inside their assigned subjects. */
async function ownLessons(admin: Admin, userId: string, subjectIds: string[]) {
  if (!subjectIds.length) return [];
  const { data: chapters } = await admin.from("chapters").select("id, subject_id").in("subject_id", subjectIds);
  const chapterIds = (chapters ?? []).map((c: { id: string }) => c.id);
  if (!chapterIds.length) return [];
  const { data } = await admin
    .from("lessons")
    .select("id, chapter_id, title_fr, title_en, published, review_status, updated_at")
    .eq("author_id", userId)
    .in("chapter_id", chapterIds);
  return data ?? [];
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  const admin = getServiceClient();
  const role = await getRole(admin, user.id);
  if (!role || !STAFF.includes(role)) return jsonResponse({ error: "forbidden" }, 403);

  try {
    const body = await req.json();
    const action = body?.action;

    // -----------------------------------------------------------------------
    // my_subjects — the teacher's workspace list
    // -----------------------------------------------------------------------
    if (action === "my_subjects") {
      const subjectIds = await assignedSubjectIds(admin, user.id, role);
      if (!subjectIds.length) return jsonResponse({ subjects: [] });

      const { data: subjects } = await admin.from("subjects").select("*").in("id", subjectIds).order("position");
      const { data: grants } = await admin
        .from("teacher_subjects")
        .select("subject_id, created_at, assigned_by, status")
        .eq("teacher_id", user.id)
        .eq("status", "active");
      const { data: chapters } = await admin.from("chapters").select("id, subject_id").in("subject_id", subjectIds);
      const chapterIds = (chapters ?? []).map((c: { id: string }) => c.id);
      const { data: lessons } = chapterIds.length
        ? await admin.from("lessons").select("id, chapter_id, author_id, published, review_status").in("chapter_id", chapterIds)
        : { data: [] };

      const chapterSubject = new Map((chapters ?? []).map((c: { id: string; subject_id: string }) => [c.id, c.subject_id]));
      const grantBySubject = new Map((grants ?? []).map((g: { subject_id: string }) => [g.subject_id, g]));

      const out = (subjects ?? []).map((s: { id: string }) => {
        const mine = (lessons ?? []).filter(
          (l: { chapter_id: string; author_id: string | null }) => chapterSubject.get(l.chapter_id) === s.id && l.author_id === user.id
        );
        return {
          ...s,
          chapterCount: (chapters ?? []).filter((c: { subject_id: string }) => c.subject_id === s.id).length,
          myLessons: mine.length,
          myDrafts: mine.filter((l: { review_status: string }) => l.review_status === "draft").length,
          mySubmitted: mine.filter((l: { review_status: string }) => ["submitted", "under_review"].includes(l.review_status)).length,
          myApproved: mine.filter((l: { review_status: string }) => l.review_status === "approved").length,
          myRejected: mine.filter((l: { review_status: string }) => l.review_status === "rejected").length,
          myPublished: mine.filter((l: { published: boolean }) => l.published).length,
          assignment: grantBySubject.get(s.id) ?? null,
        };
      });
      return jsonResponse({ subjects: out });
    }

    // -----------------------------------------------------------------------
    // dashboard_summary — one round-trip for the whole Dashboard tab
    // -----------------------------------------------------------------------
    if (action === "dashboard_summary") {
      const subjectIds = await assignedSubjectIds(admin, user.id, role);
      const lessons = await ownLessons(admin, user.id, subjectIds);
      const lessonIds = lessons.map((l: { id: string }) => l.id);

      const { data: quizzes } = lessonIds.length
        ? await admin.from("quizzes").select("id, lesson_id").in("lesson_id", lessonIds)
        : { data: [] };
      const quizIds = (quizzes ?? []).map((q: { id: string }) => q.id);
      const { count: questionCount } = quizIds.length
        ? await admin.from("questions").select("*", { count: "exact", head: true }).in("quiz_id", quizIds)
        : { count: 0 };

      const { data: approvals } = await admin
        .from("content_approval")
        .select("id, status, kind, created_at")
        .eq("submitted_by", user.id);

      const byStatus = (s: string) => lessons.filter((l: { review_status: string }) => l.review_status === s).length;

      return jsonResponse({
        subjects: subjectIds.length,
        lessons: {
          total: lessons.length,
          draft: byStatus("draft"),
          submitted: byStatus("submitted") + byStatus("under_review"),
          approved: byStatus("approved"),
          rejected: byStatus("rejected"),
          published: lessons.filter((l: { published: boolean }) => l.published).length,
        },
        quizzes: (quizzes ?? []).length,
        questions: questionCount ?? 0,
        approvals: {
          pending: (approvals ?? []).filter((a: { status: string }) => a.status === "pending").length,
          approved: (approvals ?? []).filter((a: { status: string }) => a.status === "approved").length,
          rejected: (approvals ?? []).filter((a: { status: string }) => a.status === "rejected").length,
        },
        recent: lessons
          .slice()
          .sort((a: { updated_at: string }, b: { updated_at: string }) => (a.updated_at < b.updated_at ? 1 : -1))
          .slice(0, 6)
          .map((l: { id: string; title_fr: string; title_en: string; review_status: string; published: boolean; updated_at: string }) => ({
            id: l.id,
            titleFr: l.title_fr,
            titleEn: l.title_en,
            reviewStatus: l.review_status,
            published: l.published,
            updatedAt: l.updated_at,
          })),
      });
    }

    // -----------------------------------------------------------------------
    // submit_lesson — draft -> submitted (the only transition a teacher drives)
    // -----------------------------------------------------------------------
    if (action === "submit_lesson") {
      const { lesson_id } = body;
      if (!lesson_id) return jsonResponse({ error: "lesson_id is required" }, 400);

      const { data: lesson } = await admin
        .from("lessons")
        .select("id, author_id, chapter_id, title_fr, title_en, content_fr, published, review_status")
        .eq("id", lesson_id)
        .maybeSingle();
      if (!lesson) return jsonResponse({ error: "lesson not found" }, 404);

      const { data: chapter } = await admin.from("chapters").select("subject_id").eq("id", lesson.chapter_id).maybeSingle();
      const subjectIds = await assignedSubjectIds(admin, user.id, role);
      const isOwner = lesson.author_id === user.id;
      const teachesIt = !!chapter && subjectIds.includes(chapter.subject_id);

      if (!(isOwner && teachesIt) && !["admin", "super_admin"].includes(role)) {
        return jsonResponse({ error: "forbidden: not your lesson, or not one of your subjects" }, 403);
      }
      if (!["draft", "rejected"].includes(lesson.review_status)) {
        return jsonResponse({ error: `lesson is ${lesson.review_status}, nothing to submit` }, 409);
      }
      // Don't let an empty shell enter the reviewers' queue.
      if (!lesson.title_fr?.trim() || !lesson.content_fr?.trim()) {
        return jsonResponse({ error: "incomplete: a French title and body are required before submitting" }, 422);
      }

      const now = new Date().toISOString();
      await admin
        .from("lessons")
        .update({ review_status: "submitted", submitted_at: now, review_feedback: null })
        .eq("id", lesson_id);

      // One approval-queue row per submission, so reviewers see lessons and
      // AI questions in the same place (kind discriminates).
      await admin.from("content_approval").insert({
        submitted_by: user.id,
        lesson_id,
        subject_id: chapter?.subject_id ?? null,
        kind: "lesson",
        status: "pending",
        generated_payload: { title_fr: lesson.title_fr, title_en: lesson.title_en },
      });

      await admin.from("admin_logs").insert({
        actor_id: user.id,
        action: "lesson_submitted_for_review",
        target_table: "lessons",
        target_id: lesson_id,
        metadata: { subject_id: chapter?.subject_id ?? null },
      });

      // Tell the reviewers there is something waiting.
      const { data: reviewers } = await admin.from("profiles").select("id").in("role", ["admin", "super_admin"]);
      if (reviewers?.length) {
        await admin.from("notifications").insert(
          reviewers.map((r: { id: string }) => ({
            user_id: r.id,
            type: "content_submitted",
            title_fr: "Contenu à relire",
            title_en: "Content awaiting review",
            body_fr: `Leçon soumise : ${lesson.title_fr}`,
            body_en: `Lesson submitted: ${lesson.title_en || lesson.title_fr}`,
          }))
        );
      }

      return jsonResponse({ ok: true, review_status: "submitted", submitted_at: now });
    }

    // -----------------------------------------------------------------------
    // performance_summary — attempts + average per quiz on the caller's content
    // -----------------------------------------------------------------------
    if (action === "performance_summary") {
      const subjectIds = await assignedSubjectIds(admin, user.id, role);
      const lessons = await ownLessons(admin, user.id, subjectIds);
      const lessonIds = lessons.map((l: { id: string }) => l.id);
      if (!lessonIds.length) return jsonResponse({ quizzes: [], subjects: subjectIds.length });

      const { data: quizzes } = await admin.from("quizzes").select("*").in("lesson_id", lessonIds);
      const quizIds = (quizzes ?? []).map((q: { id: string }) => q.id);
      const { data: attempts } = quizIds.length
        ? await admin.from("quiz_attempts").select("quiz_id, score").in("quiz_id", quizIds).not("score", "is", null)
        : { data: [] };

      const lessonById = new Map(lessons.map((l: { id: string; title_fr: string; title_en: string }) => [l.id, l]));

      const summary = (quizzes ?? []).map((q: { id: string; title_fr: string; title_en: string; lesson_id: string }) => {
        const scores = (attempts ?? [])
          .filter((a: { quiz_id: string }) => a.quiz_id === q.id)
          .map((a: { score: number }) => a.score);
        const lesson = lessonById.get(q.lesson_id) as { title_fr: string; title_en: string } | undefined;
        return {
          quizId: q.id,
          lessonId: q.lesson_id,
          lessonTitleFr: lesson?.title_fr ?? "",
          lessonTitleEn: lesson?.title_en ?? "",
          titleFr: q.title_fr,
          titleEn: q.title_en,
          attempts: scores.length,
          avgScore: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0,
          bestScore: scores.length ? Math.max(...scores) : 0,
          worstScore: scores.length ? Math.min(...scores) : 0,
        };
      });

      return jsonResponse({ quizzes: summary, subjects: subjectIds.length });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
