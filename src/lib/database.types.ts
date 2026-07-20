/**
 * Hand-written types mirroring supabase/migrations/0001_init.sql.
 * Once a real Supabase project is linked, regenerate with:
 *   npx supabase gen types typescript --linked > src/lib/database.types.ts
 * (this file is a reasonable stand-in until then).
 */

export type UserRole = "student" | "teacher" | "admin" | "super_admin";
export type AccountStatus = "active" | "suspended";
export type DifficultyLevel = "easy" | "medium" | "hard";
export type LessonProgressStatus = "locked" | "current" | "done";
export type ApprovalStatus = "pending" | "approved" | "modified" | "rejected";
export type MockExamStatus = "scheduled" | "open" | "closed";
export type RankingScope = "regional" | "national" | "weekly";

export type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  region: string | null;
  town: string | null;
  role: UserRole;
  track: string | null;
  level: string;
  faxcoins: number;
  rank_label: string;
  avatar_url: string | null;
  language: "fr" | "en";
  dark_mode: boolean;
  notif_prefs: Record<string, boolean>;
  status: AccountStatus;
  streak_count: number;
  last_active_on: string | null;
  created_at: string;
  updated_at: string;
}

export type SubjectRow = {
  id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  track: string;
  position: number;
  created_at: string;
}

export type ChapterRow = {
  id: string;
  subject_id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  position: number;
  created_at: string;
}

export type LessonRow = {
  id: string;
  chapter_id: string;
  author_id: string | null;
  slug: string;
  title_fr: string;
  title_en: string;
  objectives_fr: string[];
  objectives_en: string[];
  content_fr: string;
  content_en: string;
  summary_fr: string | null;
  summary_en: string | null;
  key_points_fr: string[];
  key_points_en: string[];
  duration_minutes: number;
  difficulty: DifficultyLevel;
  position: number;
  is_premium: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type LessonProgressRow = {
  id: string;
  user_id: string;
  lesson_id: string;
  status: LessonProgressStatus;
  progress_pct: number;
  is_favorite: boolean;
  last_viewed_at: string | null;
  completed_at: string | null;
}

export type QuizRow = {
  id: string;
  lesson_id: string | null;
  mock_exam_id: string | null;
  title_fr: string;
  title_en: string;
  difficulty: DifficultyLevel;
  passing_score: number;
  created_at: string;
}

export type QuestionRow = {
  id: string;
  quiz_id: string;
  text_fr: string;
  text_en: string;
  explanation_fr: string | null;
  explanation_en: string | null;
  difficulty: DifficultyLevel;
  position: number;
  ai_generated: boolean;
  created_at: string;
}

export type ChoiceRow = {
  id: string;
  question_id: string;
  text_fr: string;
  text_en: string;
  is_correct: boolean;
  position: number;
}

export type QuizAttemptRow = {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number | null;
  coins_earned: number;
  started_at: string;
  submitted_at: string | null;
}

export type StudentAnswerRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  choice_id: string | null;
  is_correct: boolean;
  answered_at: string;
}

export type MockExamRow = {
  id: string;
  title_fr: string;
  title_en: string;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  question_count: number;
  passing_score: number;
  instructions_fr: string[];
  instructions_en: string[];
  status: MockExamStatus;
  quiz_id: string | null;
  created_by: string | null;
  created_at: string;
}

export type MockExamResultRow = {
  id: string;
  mock_exam_id: string;
  user_id: string;
  attempt_id: string | null;
  score: number;
  national_rank: number | null;
  regional_rank: number | null;
  breakdown: Record<string, number>;
  created_at: string;
}

export type RankingRow = {
  id: string;
  scope: RankingScope;
  region: string | null;
  user_id: string;
  display_name: string;
  town: string | null;
  score: number;
  period_start: string;
  period_end: string;
  computed_at: string;
}

export type FaxcoinsTransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

export type ShopItemRow = {
  id: string;
  key: string;
  name_fr: string;
  name_en: string;
  price_coins: number;
  item_type: "past_paper" | "correction" | "premium_lesson" | "mock_correction" | "exclusive_content";
  reference_id: string | null;
  is_limited: boolean;
  stock_remaining: number | null;
  active: boolean;
  created_at: string;
}

export type ShopUnlockRow = {
  id: string;
  user_id: string;
  shop_item_id: string;
  unlocked_at: string;
}

export type BadgeRow = {
  id: string;
  key: string;
  name_fr: string;
  name_en: string;
  description_fr: string | null;
  description_en: string | null;
  icon: string;
  criteria: Record<string, unknown>;
}

export type UserBadgeRow = {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export type DailyTaskRow = {
  id: string;
  key: string;
  label_fr: string;
  label_en: string;
  reward_coins: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export type DailyTaskCompletionRow = {
  id: string;
  user_id: string;
  task_id: string;
  completed_on: string;
  reward_coins: number;
  created_at: string;
}

export type NotificationRow = {
  id: string;
  user_id: string;
  type: "daily_reminder" | "mock_reminder" | "reward" | "ranking_update" | "system";
  title_fr: string;
  title_en: string;
  body_fr: string;
  body_en: string;
  is_read: boolean;
  created_at: string;
}

export type AdminLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type ContentApprovalRow = {
  id: string;
  submitted_by: string;
  source_media_id: string | null;
  lesson_id: string | null;
  generated_payload: Record<string, unknown>;
  status: ApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type MediaLibraryRow = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  uploaded_by: string | null;
  lesson_id: string | null;
  created_at: string;
}

export type SettingsRow = {
  key: string;
  value: unknown;
  updated_at: string;
}

type TableDef<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow>;
      subjects: TableDef<SubjectRow>;
      chapters: TableDef<ChapterRow>;
      lessons: TableDef<LessonRow>;
      lesson_progress: TableDef<LessonProgressRow>;
      quizzes: TableDef<QuizRow>;
      questions: TableDef<QuestionRow>;
      choices: TableDef<ChoiceRow>;
      quiz_attempts: TableDef<QuizAttemptRow>;
      student_answers: TableDef<StudentAnswerRow>;
      mock_exams: TableDef<MockExamRow>;
      mock_exam_results: TableDef<MockExamResultRow>;
      rankings: TableDef<RankingRow>;
      faxcoins_transactions: TableDef<FaxcoinsTransactionRow>;
      shop_items: TableDef<ShopItemRow>;
      shop_unlocks: TableDef<ShopUnlockRow>;
      badges: TableDef<BadgeRow>;
      user_badges: TableDef<UserBadgeRow>;
      daily_tasks: TableDef<DailyTaskRow>;
      daily_task_completions: TableDef<DailyTaskCompletionRow>;
      notifications: TableDef<NotificationRow>;
      admin_logs: TableDef<AdminLogRow>;
      content_approval: TableDef<ContentApprovalRow>;
      media_library: TableDef<MediaLibraryRow>;
      settings: TableDef<SettingsRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
