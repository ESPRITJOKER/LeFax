import { selectBranchesRequestSchema } from "@lefax/shared";
import type { FastifyInstance } from "fastify";
import { AuthService } from "../auth/auth.service.js";

type ProgressRow = { lesson_id: string; completed: boolean; completed_at: string | null; cards_seen: number; cards_total: number };
type LessonRow = { id: string; title: string; chapter_id: string; estimated_minutes: number | null; order_index: number };
type ChapterRow = { id: string; name: string; subject_id: string; order_index: number };

export default async function studentsRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify, fastify.supabase);

  fastify.put(
    "/students/branches",
    { onRequest: [fastify.authenticate, fastify.requireRole("student")] },
    async (request, reply) => {
      const body = selectBranchesRequestSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: "INVALID_BODY", message: body.error.issues[0]?.message });
      }
      const user = await authService.completeOnboarding(request.user.sub, body.data.branchSlugs);
      return reply.send({ user });
    }
  );

  /**
   * WEB-E03 — everything the dashboard needs in one call. No fake numbers:
   * ranking/streak/next-lesson are real aggregate queries, and simply come
   * back null/zero for a student with no activity yet, rather than the
   * flavor-text stats shown in the Stitch mockup.
   *
   * This does ~10 Supabase round-trips; NFR-01 caps page loads at 2s, so
   * every stage that doesn't depend on a prior stage's result runs via
   * Promise.all instead of sequential awaits (measured ~5s sequential vs
   * ~1.5-2s parallelized against the EU-west-1 project this was built
   * against).
   */
  fastify.get(
    "/students/dashboard",
    { onRequest: [fastify.authenticate, fastify.requireRole("student")] },
    async (request, reply) => {
      const studentId = request.user.sub;
      const supabase = fastify.supabase;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, branch_preferences")
        .eq("id", studentId)
        .single();
      const branchSlugs: string[] = profile?.branch_preferences ?? [];

      const [{ data: branches }, { data: progress }, { data: attempts }, { data: recentRewards }] = await Promise.all([
        branchSlugs.length
          ? supabase.from("branches").select("id, slug, name").in("slug", branchSlugs)
          : Promise.resolve({ data: [] as { id: string; slug: string; name: string }[] }),
        supabase.from("student_progress").select("lesson_id, completed, completed_at, cards_seen, cards_total").eq("student_id", studentId),
        supabase.from("qcm_attempts").select("is_correct, attempted_at").eq("student_id", studentId),
        supabase.from("coin_ledger").select("id, amount, reason, created_at").eq("student_id", studentId).order("created_at", { ascending: false }).limit(3),
      ]);

      const branchIds = (branches ?? []).map((b) => b.id);
      const progressRows = (progress as ProgressRow[] | null) ?? [];
      const lessonsCompleted = progressRows.filter((p) => p.completed).length;
      const todayStr = new Date().toISOString().slice(0, 10);
      const lessonsCompletedToday = progressRows.filter((p) => p.completed && p.completed_at?.startsWith(todayStr)).length;

      const attemptRows = attempts ?? [];
      const qcmAccuracy = attemptRows.length
        ? Math.round((attemptRows.filter((a) => a.is_correct).length / attemptRows.length) * 100)
        : null;

      // Streak: consecutive days (walking back from today) with a lesson
      // completion or a QCM attempt.
      const activityDates = new Set<string>([
        ...progressRows.filter((p) => p.completed_at).map((p) => p.completed_at!.slice(0, 10)),
        ...attemptRows.map((a) => a.attempted_at.slice(0, 10)),
      ]);
      let streakDays = 0;
      const cursor = new Date();
      while (activityDates.has(cursor.toISOString().slice(0, 10))) {
        streakDays += 1;
        cursor.setDate(cursor.getDate() - 1);
      }

      async function computeRanking(): Promise<{ rank: number | null; totalStudents: number }> {
        if (!branchSlugs.length) return { rank: null, totalStudents: 0 };
        const { data: peers } = await supabase.from("profiles").select("id").eq("role", "student").overlaps("branch_preferences", branchSlugs);
        const peerIds = (peers ?? []).map((p) => p.id);
        if (!peerIds.length) return { rank: null, totalStudents: 0 };

        const [{ data: allProgress }, { data: allCorrect }] = await Promise.all([
          supabase.from("student_progress").select("student_id").in("student_id", peerIds).eq("completed", true),
          supabase.from("qcm_attempts").select("student_id").in("student_id", peerIds).eq("is_correct", true),
        ]);
        const scoreMap = new Map<string, number>(peerIds.map((id) => [id, 0]));
        for (const row of allProgress ?? []) scoreMap.set(row.student_id, (scoreMap.get(row.student_id) ?? 0) + 1);
        for (const row of allCorrect ?? []) scoreMap.set(row.student_id, (scoreMap.get(row.student_id) ?? 0) + 1);

        const myScore = scoreMap.get(studentId) ?? 0;
        if (myScore === 0) return { rank: null, totalStudents: peerIds.length };
        const sorted = [...scoreMap.values()].sort((a, b) => b - a);
        return { rank: sorted.findIndex((s) => s === myScore) + 1, totalStudents: peerIds.length };
      }

      // Next recommended lesson: first published lesson in the student's
      // branch(es), in hierarchy order, not yet completed. subjects ->
      // chapters -> lessons is an inherently sequential chain (each level
      // needs the prior level's ids), but it runs concurrently with
      // computeRanking() and the exams query below.
      async function computeNextLesson() {
        if (!branchIds.length) return null;
        const { data: subjects } = await supabase.from("subjects").select("id").in("branch_id", branchIds);
        const subjectIds = (subjects ?? []).map((s) => s.id);
        const { data: chapters } = subjectIds.length
          ? await supabase.from("chapters").select("id, name, subject_id, order_index").in("subject_id", subjectIds).order("order_index")
          : { data: [] };
        const chapterRows = (chapters as ChapterRow[] | null) ?? [];
        const chapterIds = chapterRows.map((c) => c.id);
        const { data: lessons } = chapterIds.length
          ? await supabase
              .from("lessons")
              .select("id, title, chapter_id, estimated_minutes, order_index")
              .in("chapter_id", chapterIds)
              .eq("is_published", true)
              .order("order_index")
          : { data: [] };
        const lessonRows = (lessons as LessonRow[] | null) ?? [];
        const completedIds = new Set(progressRows.filter((p) => p.completed).map((p) => p.lesson_id));
        const nextRow = lessonRows.find((l) => !completedIds.has(l.id));
        if (!nextRow) return null;
        const chapter = chapterRows.find((c) => c.id === nextRow.chapter_id);
        const prog = progressRows.find((p) => p.lesson_id === nextRow.id);
        return {
          id: nextRow.id,
          title: nextRow.title,
          chapterName: chapter?.name ?? null,
          estimatedMinutes: nextRow.estimated_minutes,
          cardsSeen: prog?.cards_seen ?? 0,
          cardsTotal: prog?.cards_total ?? 0,
        };
      }

      async function fetchUpcomingExam() {
        if (!branchIds.length) return null;
        const { data } = await supabase
          .from("mock_exams")
          .select("id, title, opens_at, closes_at, duration_seconds, status")
          .in("branch_id", branchIds)
          .in("status", ["scheduled", "open"])
          .order("opens_at", { ascending: true })
          .limit(1);
        return data?.[0] ?? null;
      }

      const [{ rank, totalStudents }, nextLesson, upcomingExam] = await Promise.all([
        computeRanking(),
        computeNextLesson(),
        fetchUpcomingExam(),
      ]);

      return reply.send({
        firstName: profile?.first_name ?? null,
        lessonsCompleted,
        lessonsCompletedToday,
        qcmAccuracy,
        streakDays,
        rank,
        totalStudents,
        nextLesson,
        upcomingExam,
        recentRewards: recentRewards ?? [],
      });
    }
  );
}
