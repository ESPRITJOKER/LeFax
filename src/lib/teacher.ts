import { useCallback, useEffect, useState } from "react";
import { invokeFn, isSupabaseConfigured } from "./supabaseClient";
import type { ReviewStatus, SubjectRow, TeacherSubjectRow } from "./database.types";

/**
 * Client-side access layer for the teacher panel.
 *
 * Every teacher screen is scoped by the subjects a super_admin assigned, and
 * that list comes from the server (`teacher` Edge Function, `my_subjects`) —
 * never from anything the browser could tamper with. The database enforces the
 * same rule independently (0018), so this is about showing the right thing, not
 * about being the security boundary.
 *
 * `error` is deliberately distinct from "empty": a failed request and a teacher
 * with no assignment yet are different situations and must read differently
 * (that conflation was one of the audited defects).
 */

export interface AssignedSubject extends SubjectRow {
  chapterCount: number;
  myLessons: number;
  myDrafts: number;
  mySubmitted: number;
  myApproved: number;
  myRejected: number;
  myPublished: number;
  assignment: Pick<TeacherSubjectRow, "subject_id" | "created_at" | "assigned_by" | "status"> | null;
}

export interface TeacherSummary {
  subjects: number;
  lessons: { total: number; draft: number; submitted: number; approved: number; rejected: number; published: number };
  quizzes: number;
  questions: number;
  approvals: { pending: number; approved: number; rejected: number };
  recent: { id: string; titleFr: string; titleEn: string; reviewStatus: ReviewStatus; published: boolean; updatedAt: string }[];
}

export interface QuizPerformance {
  quizId: string;
  lessonId: string;
  lessonTitleFr: string;
  lessonTitleEn: string;
  titleFr: string;
  titleEn: string;
  attempts: number;
  avgScore: number;
  bestScore: number;
  worstScore: number;
}

/** Thin wrapper turning an Edge Function call into {data|error}, never throwing. */
export async function callTeacher<T>(body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: "backend" };
  try {
    const { data, error } = await invokeFn<T & { error?: string }>("teacher", body);
    if (error) throw error;
    if (data && typeof data === "object" && "error" in data && data.error) throw new Error(String(data.error));
    return { data: (data as T) ?? null, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function useTeacherCall<T>(body: Record<string, unknown>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(body);
  const reload = useCallback(async () => {
    setLoading(true);
    const res = await callTeacher<T>(JSON.parse(key));
    setData(res.data);
    setError(res.error);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function useMySubjects() {
  const { data, loading, error, reload } = useTeacherCall<{ subjects: AssignedSubject[] }>({ action: "my_subjects" });
  return { subjects: data?.subjects ?? [], loading, error, reload };
}

export function useTeacherSummary() {
  const { data, loading, error, reload } = useTeacherCall<TeacherSummary>({ action: "dashboard_summary" });
  return { summary: data, loading, error, reload };
}

export function useTeacherPerformance() {
  const { data, loading, error, reload } = useTeacherCall<{ quizzes: QuizPerformance[]; subjects: number }>({ action: "performance_summary" });
  return { quizzes: data?.quizzes ?? [], subjects: data?.subjects ?? 0, loading, error, reload };
}

/** Ask for review. The server validates ownership, assignment and completeness. */
export async function submitLessonForReview(lessonId: string) {
  return callTeacher<{ ok: boolean; review_status: ReviewStatus }>({ action: "submit_lesson", lesson_id: lessonId });
}

/**
 * Can the teacher still edit this lesson? Mirrors `lesson_is_teacher_editable`
 * in 0018 — the UI must not offer what the database will refuse.
 */
export function isTeacherEditable(lesson: { published: boolean; review_status: ReviewStatus }): boolean {
  return !lesson.published && (lesson.review_status === "draft" || lesson.review_status === "rejected");
}
