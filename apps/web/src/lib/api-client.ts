import type { AuthUser, RefreshResponse } from "@lefax/shared";
import { useSessionStore } from "../stores/session.store";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

async function parseError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new ApiError(res.status, body.error ?? "UNKNOWN", body.message ?? res.statusText);
}

// Refresh tokens are single-use (rotated server-side on every call), so two
// concurrent callers — e.g. React StrictMode's double effect invocation on
// mount, or two request()s 401-retrying at once — must never fire two
// separate /auth/refresh requests: the second would present an already-
// rotated cookie and get UNAUTHORIZED, silently logging the user out. All
// concurrent callers share one in-flight request instead.
let inFlightRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as RefreshResponse;
      return data.accessToken;
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  skipAuthRetry?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken } = useSessionStore.getState();

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      // Fastify's JSON body parser rejects a request whose Content-Type
      // says application/json but whose body is empty (400 "Body cannot
      // be empty..."), so bodyless POSTs (card-seen, approve, deactivate,
      // logout, ...) must omit the header entirely, not send "{}" or an
      // empty string.
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options.skipAuthRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      useSessionStore.setState({ accessToken: newToken });
      return request<T>(path, { ...options, skipAuthRetry: true });
    }
    useSessionStore.getState().clear();
  }

  if (!res.ok) return parseError(res);
  return res.json() as Promise<T>;
}

export const api = {
  sendOtp: (phone: string) => request<{ cooldownSeconds: number }>("/auth/send-otp", { method: "POST", body: { phone } }),
  verifyOtp: (phone: string, code: string, firstName?: string) =>
    request<{ accessToken: string; user: AuthUser; isNewUser: boolean }>("/auth/verify-otp", {
      method: "POST",
      body: { phone, code, ...(firstName ? { firstName } : {}) },
    }),
  staffLogin: (email: string, password: string) =>
    request<{ accessToken: string; user: AuthUser }>("/auth/staff-login", { method: "POST", body: { email, password } }),
  logout: () => request<{ success: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: AuthUser }>("/auth/me"),
  refresh: refreshAccessToken,
  selectBranches: (branchSlugs: string[]) =>
    request<{ user: AuthUser }>("/students/branches", { method: "PUT", body: { branchSlugs } }),
  studentDashboard: () => request<StudentDashboardDto>("/students/dashboard"),
  validateSchoolCode: (code: string) =>
    request<{ valid: boolean; schoolName?: string; branchName?: string | null; reason?: string }>("/schools/validate-code", {
      method: "POST",
      body: { code },
    }),
  joinSchool: (code: string) =>
    request<{ joined: boolean; schoolName: string }>("/schools/join", { method: "POST", body: { code } }),

  // --- content -------------------------------------------------------------
  branches: () => request<{ branches: BranchDto[] }>("/content/branches"),
  subjects: (branchId: string) => request<{ subjects: SubjectDto[] }>(`/content/branches/${branchId}/subjects`),
  chapters: (subjectId: string) => request<{ chapters: ChapterDto[] }>(`/content/subjects/${subjectId}/chapters`),
  lessons: (chapterId: string) => request<{ lessons: LessonListDto[] }>(`/content/chapters/${chapterId}/lessons`),
  lesson: (lessonId: string) => request<{ lesson: LessonDetailDto }>(`/content/lessons/${lessonId}`),
  cardSeen: (lessonId: string) =>
    request<{ progress: unknown; coinsAwarded: number }>(`/content/lessons/${lessonId}/card-seen`, { method: "POST" }),

  // --- exercises -------------------------------------------------------------
  lessonQcms: (lessonId: string) =>
    request<{ unlockedDifficulties: string[]; qcms: QcmDto[] }>(`/exercises/lessons/${lessonId}/qcms`),
  attemptQcm: (qcmId: string, selectedOptionId: string) =>
    request<{ isCorrect: boolean; correctOptionId: string; explanation: string; coinsAwarded: number }>(
      `/exercises/qcms/${qcmId}/attempt`,
      { method: "POST", body: { selectedOptionId } }
    ),

  // --- exams -------------------------------------------------------------
  exams: () => request<{ exams: ExamDto[] }>("/exams"),
  exam: (examId: string) => request<{ exam: ExamDetailDto; isOpen: boolean; submission: unknown }>(`/exams/${examId}`),
  startExam: (examId: string) => request<{ submission: unknown }>(`/exams/${examId}/start`, { method: "POST" }),
  submitExam: (examId: string, answers: Record<string, string>) =>
    request<{ submission: unknown; rank: number; coinsAwarded: number }>(`/exams/${examId}/submit`, {
      method: "POST",
      body: { answers },
    }),
  examLeaderboard: (examId: string) => request<{ leaderboard: LeaderboardEntryDto[] }>(`/exams/${examId}/leaderboard`),
  examCorrections: (examId: string) => request<{ score: number; corrections: ExamCorrectionDto[] }>(`/exams/${examId}/corrections`),

  // --- coins -------------------------------------------------------------
  coinsBalance: () => request<{ balance: number }>("/coins/balance"),
  coinsHistory: () => request<{ history: CoinHistoryEntryDto[] }>("/coins/history"),
  unlockPaper: (paperId: string) =>
    request<{ unlocked?: boolean; alreadyUnlocked?: boolean; spent?: number }>("/coins/unlock-paper", {
      method: "POST",
      body: { paperId },
    }),

  // --- past papers -------------------------------------------------------------
  papers: () => request<{ papers: PaperDto[] }>("/papers"),
  paper: (paperId: string) => request<{ paper: PaperDetailDto; unlocked: boolean }>(`/papers/${paperId}`),

  // --- diagnostic -------------------------------------------------------------
  startDiagnostic: (branchId: string) =>
    request<{ session: { id: string }; questions: DiagnosticQuestionDto[] }>("/diagnostic/sessions", {
      method: "POST",
      body: { branchId },
    }),
  answerDiagnostic: (sessionId: string, questionId: string, selectedOptionId: string) =>
    request<{ isCorrect: boolean }>(`/diagnostic/sessions/${sessionId}/responses`, {
      method: "POST",
      body: { questionId, selectedOptionId },
    }),
  completeDiagnostic: (sessionId: string) =>
    request<{ profiles: MasteryProfileDto[] }>(`/diagnostic/sessions/${sessionId}/complete`, { method: "POST" }),
  mastery: (branchId: string) => request<{ profiles: MasteryProfileDto[] }>(`/diagnostic/branches/${branchId}/mastery`),

  // --- qa -------------------------------------------------------------
  qaQuestions: (lessonId?: string) => request<{ questions: QaQuestionDto[] }>(`/qa/questions${lessonId ? `?lessonId=${lessonId}` : ""}`),
  askQuestion: (branchId: string, title: string, body: string, lessonId?: string) =>
    request<{ question: QaQuestionDto }>("/qa/questions", { method: "POST", body: { branchId, title, body, lessonId } }),

  // --- admin -------------------------------------------------------------
  adminMetrics: () => request<AdminMetricsDto>("/admin/metrics"),
  adminReviews: (status = "in_review") => request<{ reviews: AdminReviewDto[] }>(`/admin/reviews?status=${status}`),
  approveReview: (reviewId: string) => request<{ success: true }>(`/admin/reviews/${reviewId}/approve`, { method: "POST" }),
  rejectReview: (reviewId: string, feedback: string) =>
    request<{ success: true }>(`/admin/reviews/${reviewId}/reject`, { method: "POST", body: { feedback } }),
  adminUsers: (params?: { role?: string; search?: string }) =>
    request<{ users: AdminUserDto[] }>(
      `/admin/users${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`
    ),
  deactivateUser: (userId: string) => request<{ success: true }>(`/admin/users/${userId}/deactivate`, { method: "POST" }),
  changeUserRole: (userId: string, role: string) =>
    request<{ success: true }>(`/admin/users/${userId}/role`, { method: "POST", body: { role } }),
  adminSchools: () => request<{ schools: AdminSchoolDto[] }>("/admin/schools"),
  createSchool: (body: {
    name: string;
    city?: string;
    branchId: string;
    seatQuota: number;
    contractExpiresAt: string;
    directorEmail?: string;
  }) => request<{ school: AdminSchoolDto }>("/admin/schools", { method: "POST", body }),
  regenerateSchoolCode: (schoolId: string) =>
    request<{ school: AdminSchoolDto }>(`/admin/schools/${schoolId}/regenerate-code`, { method: "POST" }),
  adminQcms: () => request<{ qcms: AdminQcmOptionDto[] }>("/admin/qcms"),
  adminExams: () => request<{ exams: AdminExamDto[] }>("/admin/exams"),
  createExam: (body: { title: string; branchId: string; opensAt: string; durationSeconds: number; qcmIds: string[] }) =>
    request<{ exam: AdminExamDto }>("/admin/exams", { method: "POST", body }),
  adminPayments: () => request<{ payments: AdminPaymentDto[] }>("/admin/payments"),

  // --- teacher -------------------------------------------------------------
  teacherLessonsList: () => request<{ lessons: TeacherLessonOptionDto[] }>("/teacher/lessons-list"),
  teacherContent: () => request<{ items: TeacherContentItemDto[] }>("/teacher/content"),
  createLessonCard: (body: {
    lessonId: string;
    cardType: string;
    textContent?: string;
    imageUrl?: string;
    imageAlt?: string;
    orderIndex?: number;
  }) => request<{ card: unknown }>("/teacher/lesson-cards", { method: "POST", body }),
  createQcm: (body: {
    lessonId: string;
    question: string;
    options: { id: string; text: string }[];
    correctOptionId: string;
    explanation: string;
    difficulty: string;
  }) => request<{ qcm: unknown }>("/teacher/qcms", { method: "POST", body }),
  createPastPaper: (body: {
    branchId: string;
    subjectId?: string;
    title: string;
    schoolName: string;
    year: number;
    paperUrl: string;
    correctionText?: string;
    correctionUrl?: string;
  }) => request<{ paper: unknown }>("/teacher/past-papers", { method: "POST", body }),
  submitForReview: (contentType: string, contentId: string) =>
    request<{ review: unknown }>(`/teacher/content/${contentType}/${contentId}/submit-review`, { method: "POST" }),
  teacherQaQuestions: (status: "unanswered" | "answered" = "unanswered") =>
    request<{ questions: QaQuestionDto[] }>(`/teacher/qa/questions?status=${status}`),
  answerQaQuestion: (questionId: string, body: string) =>
    request<{ answer: unknown }>(`/teacher/qa/questions/${questionId}/answer`, { method: "POST", body: { body } }),

  // --- ai tutor -------------------------------------------------------------
  createTutorSession: (branchId?: string) =>
    request<{ session: { id: string } }>("/ai/sessions", { method: "POST", body: { branchId } }),
  tutorSessions: () => request<{ sessions: { id: string; title: string | null; created_at: string }[] }>("/ai/sessions"),
  tutorMessages: (sessionId: string) =>
    request<{ messages: { id: string; role: string; content: string; confidence_score: number | null; tokens_used: number | null; created_at: string }[] }>(
      `/ai/sessions/${sessionId}/messages`
    ),
  sendTutorMessage: (sessionId: string, content: string) =>
    request<{ message: { id?: string; content: string; confidenceScore: number }; grounded: boolean }>(
      `/ai/sessions/${sessionId}/messages`,
      { method: "POST", body: { content } }
    ),
  escalateTutorSession: (sessionId: string, reason?: string) =>
    request<{ escalated: boolean }>(`/ai/sessions/${sessionId}/escalate`, { method: "POST", body: { reason } }),

  // --- content pipeline -----------------------------------------------------
  generateContentDraft: (body: { subjectId: string; chapterId?: string; draftType: string; topicHint?: string }) =>
    request<{ draft: ContentDraftDto }>("/content-pipeline/generate", { method: "POST", body }),
  contentDrafts: (status?: string, subjectId?: string) =>
    request<{ drafts: ContentDraftDto[] }>(
      `/content-pipeline/drafts${status ? `?status=${status}` : ""}${subjectId ? `&subjectId=${subjectId}` : ""}`
    ),
  contentDraftSources: (draftId: string) =>
    request<{ draft: ContentDraftDto; sources: RagChunkDto[] }>(`/content-pipeline/drafts/${draftId}/sources`),
  indexContent: (body: { sourceType: string; sourceId: string; content: string; metadata?: Record<string, unknown> }) =>
    request<{ indexed: number }>("/content-pipeline/index", { method: "POST", body }),

  // --- payments -------------------------------------------------------------
  initiatePayment: (planId: string) =>
    request<{ paymentUrl: string; checkoutUrl: string; token: string }>("/payments/initiate", {
      method: "POST",
      body: { planId },
    }),
  paymentStatus: (token: string) =>
    request<{ payment: { id: string; status: string; amount_xaf: number; confirmed_at: string | null; created_at: string } }>(
      `/payments/status/${token}`
    ),
  paymentHistory: () =>
    request<{ payments: { id: string; amount_xaf: number; status: string; confirmed_at: string | null; created_at: string }[] }>(
      "/payments/history"
    ),
};

// --- DTOs (loosely typed — the API is the real validation boundary) --------
export interface StudentDashboardDto {
  firstName: string | null;
  lessonsCompleted: number;
  lessonsCompletedToday: number;
  qcmAccuracy: number | null;
  streakDays: number;
  rank: number | null;
  totalStudents: number;
  nextLesson: {
    id: string;
    title: string;
    chapterName: string | null;
    estimatedMinutes: number | null;
    cardsSeen: number;
    cardsTotal: number;
  } | null;
  upcomingExam: {
    id: string;
    title: string;
    opens_at: string;
    closes_at: string;
    duration_seconds: number;
    status: string;
  } | null;
  recentRewards: { id: string; amount: number; reason: string; created_at: string }[];
}
export interface BranchDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  order_index: number;
}
export interface SubjectDto {
  id: string;
  name: string;
  order_index: number;
  chapterCount: number;
}
export interface ChapterDto {
  id: string;
  name: string;
  order_index: number;
}
export interface LessonListDto {
  id: string;
  title: string;
  estimated_minutes: number | null;
  order_index: number;
  progress: { cards_seen: number; cards_total: number; completed: boolean };
}
export interface LessonCardDto {
  id: string;
  card_type: string;
  text_content: string | null;
  image_url: string | null;
  image_alt: string | null;
  table_data: unknown;
  svg_content: string | null;
  order_index: number;
}
export interface LessonDetailDto {
  id: string;
  title: string;
  estimated_minutes: number | null;
  chapter_id: string;
  chapters?: { name: string; subjects?: { name: string } };
  cards: LessonCardDto[];
}
export interface QcmDto {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  difficulty: "easy" | "intermediate" | "hard";
}
export interface ExamDto {
  id: string;
  title: string;
  opens_at: string;
  closes_at: string;
  duration_seconds: number;
  status: string;
  branch_id?: string;
}
export interface ExamDetailDto extends ExamDto {
  questions: { id: string; question: string; options: { id: string; text: string }[] }[];
  questionCount: number;
}
export interface LeaderboardEntryDto {
  rank: number;
  studentId: string;
  firstName: string;
  score: number;
  isMe: boolean;
}
export interface ExamCorrectionDto {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  studentAnswerId: string | null;
}
export interface CoinHistoryEntryDto {
  id: string;
  amount: number;
  reason: string;
  label: string;
  reference_id: string | null;
  created_at: string;
}
export interface PaperDto {
  id: string;
  title: string;
  school_name: string;
  year: number;
  access_tier: "free" | "premium" | "unlockable";
  unlock_price_coins: number;
  unlocked: boolean;
}
export interface PaperDetailDto extends PaperDto {
  paper_url: string;
  correction_text: string | null;
  correction_url: string | null;
}
export interface DiagnosticQuestionDto {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  subject_id: string;
  order_index: number;
}
export interface MasteryProfileDto {
  subject_id: string;
  mastery_score: number;
  is_weak_zone: boolean;
  computed_at: string;
  subjects?: { name: string };
}
export interface QaQuestionDto {
  id: string;
  title: string;
  body: string;
  created_at: string;
  lesson_id: string | null;
  branch_id: string;
  qa_answers?: { id: string; body: string; published_at: string; profiles?: { first_name: string } }[];
}
export interface AdminMetricsDto {
  totalStudents: number;
  totalTeachers: number;
  pendingReviews: number;
  publishedLessons: number;
  publishedQcms: number;
  activeSubscriptions: number;
}
export interface AdminReviewDto {
  id: string;
  content_type: string;
  content_id: string;
  submitted_by: string;
  status: string;
  feedback: string | null;
  submitted_at: string;
  profiles?: { first_name: string | null; email: string | null };
}
export interface AdminUserDto {
  id: string;
  role: string;
  phone: string | null;
  email: string | null;
  first_name: string | null;
  is_active: boolean;
  created_at: string;
  branch_preferences: string[];
}
export interface AdminSchoolDto {
  id: string;
  name: string;
  city: string | null;
  access_code: string;
  seat_quota: number;
  seats_used: number;
  contract_expires_at: string;
  is_active: boolean;
  branches?: { name: string };
}
export interface AdminExamDto {
  id: string;
  title: string;
  branch_id: string;
  opens_at: string;
  closes_at: string;
  duration_seconds: number;
  status: string;
  questionCount: number;
  branches?: { name: string };
}
export interface AdminPaymentDto {
  id: string;
  student_id: string;
  cinetpay_transaction_id: string;
  amount_xaf: number;
  status: string;
  confirmed_at: string | null;
  created_at: string;
}
export interface AdminQcmOptionDto {
  id: string;
  question: string;
  difficulty: string;
  lessons?: { title: string };
}
export interface TeacherLessonOptionDto {
  id: string;
  title: string;
  chapters?: { name: string; subjects?: { name: string; branches?: { name: string } } };
}
export interface TeacherContentItemDto {
  id: string;
  type: "lesson_card" | "qcm" | "past_paper";
  status: "draft" | "in_review" | "approved" | "rejected";
  feedback: string | null;
  created_at: string;
  [key: string]: unknown;
}
export interface ContentDraftDto {
  id: string;
  draft_type: string;
  subject_id: string;
  chapter_id: string | null;
  title: string;
  body: string;
  source_chunks: string[];
  generation_prompt: string | null;
  status: string;
  created_at: string;
  subjects?: { name: string };
}
export interface RagChunkDto {
  id: string;
  content: string;
  source_type: string;
  source_id: string;
  metadata: Record<string, unknown>;
}
