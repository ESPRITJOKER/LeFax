import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { BackendBanner } from "./components/BackendBanner";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Spinner } from "./components/ui";

/**
 * Routing + code splitting.
 *
 * Correction N6, remark 5: *"le chargement d'une page prend 1 à 2 secondes.
 * Séparer les plateformes (enseignant et users) serait-il une bonne idée pour
 * alléger ?"*
 *
 * The answer is no — and this file is why. Everything was imported eagerly, so
 * the whole app shipped as ONE 1,035 kB chunk: a student on a phone downloaded
 * the admin back-office and the teacher panel before seeing their dashboard.
 * That is a bundling fault, not an architecture fault. Teacher, admin and
 * student already share auth, the Supabase client, i18n, the design tokens, the
 * lesson editor and the markup renderer; splitting the project in two would
 * duplicate all of that to fix something `React.lazy` fixes here, in one file,
 * with no duplication and no second deployment to keep in sync.
 *
 * So: the student's first screens stay in the entry chunk, and every admin
 * route, every teacher route and the heavy runners (quiz, past paper, mock
 * exams, the lesson reader with its KaTeX dependency) load on demand.
 */

// Eager — the student's entry path. Splitting these would only trade bytes for
// a spinner on the very first screen.
import Landing from "./pages/student/Landing";
import Register from "./pages/student/Register";
import Login from "./pages/student/Login";
import Track from "./pages/student/Track";
import Dashboard from "./pages/student/Dashboard";
import SubjectChapters from "./pages/student/SubjectChapters";
import ChapterLessons from "./pages/student/ChapterLessons";
import ChapterStories from "./pages/student/ChapterStories";
import Profile from "./pages/student/Profile";

// Lazy — student screens behind a deliberate action. LessonDetail is here
// rather than eager because it is the only early screen that pulls KaTeX
// (through the card deck's markup renderer): keeping it lazy keeps the 78 kB
// gzip maths chunk out of the dashboard's download.
const LessonDetail = lazy(() => import("./pages/student/LessonDetail"));
const ChapterPractice = lazy(() => import("./pages/student/ChapterPractice"));
const LessonReader = lazy(() => import("./pages/student/LessonReader"));
const Quiz = lazy(() => import("./pages/student/Quiz"));
const PaperQuiz = lazy(() => import("./pages/student/PaperQuiz"));
const QuizResult = lazy(() => import("./pages/student/QuizResult"));
const QuizCorrection = lazy(() => import("./pages/student/QuizCorrection"));
const MockExamHome = lazy(() => import("./pages/student/MockExamHome"));
const MockExamResult = lazy(() => import("./pages/student/MockExamResult"));
const Shop = lazy(() => import("./pages/student/Shop"));
const Tasks = lazy(() => import("./pages/student/Tasks"));
const Leaderboard = lazy(() => import("./pages/student/Leaderboard"));
const Performance = lazy(() => import("./pages/student/Performance"));
const Notifications = lazy(() => import("./pages/student/Notifications"));
const Search = lazy(() => import("./pages/student/Search"));

// Lazy — the whole admin back-office. A student never downloads a byte of it.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/Overview"));
const AdminStudents = lazy(() => import("./pages/admin/Students"));
const AdminContent = lazy(() => import("./pages/admin/Content"));
const AdminLessonEditor = lazy(() => import("./pages/admin/LessonEditor"));
const AdminAiReview = lazy(() => import("./pages/admin/AiReview"));
const AdminMockExams = lazy(() => import("./pages/admin/MockExams"));
const AdminAdmins = lazy(() => import("./pages/admin/Admins"));
const AdminTeachers = lazy(() => import("./pages/admin/Teachers"));
const AdminLogs = lazy(() => import("./pages/admin/Logs"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));

// Lazy — the whole teacher panel, likewise.
const TeacherLayout = lazy(() => import("./pages/teacher/TeacherLayout"));
const TeacherDashboard = lazy(() => import("./pages/teacher/TeacherDashboard"));
const TeacherContent = lazy(() => import("./pages/teacher/TeacherContent"));
const TeacherSubjects = lazy(() => import("./pages/teacher/TeacherSubjects"));
const TeacherLessonEditor = lazy(() => import("./pages/teacher/TeacherLessonEditor"));
const TeacherQuestionBank = lazy(() => import("./pages/teacher/TeacherQuestionBank"));
const TeacherNotifications = lazy(() => import("./pages/teacher/TeacherNotifications"));
const TeacherAccount = lazy(() => import("./pages/teacher/TeacherAccount"));
const TeacherAiAssist = lazy(() => import("./pages/teacher/TeacherAiAssist"));
const TeacherPerformance = lazy(() => import("./pages/teacher/TeacherPerformance"));

export default function App() {
  return (
    <>
      <BackendBanner />
      {/* One boundary around the whole table: a lazy route resolves in a few
          ms from cache, and a nested spinner per route would flash more than
          it informs. */}
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/start" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/track"
            element={
              <ProtectedRoute roles={["student"]}>
                <Track />
              </ProtectedRoute>
            }
          />

          {/* Student app */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={["student"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subjects/:subjectId"
            element={
              <ProtectedRoute roles={["student"]}>
                <SubjectChapters />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lessons/:chapterId"
            element={
              <ProtectedRoute roles={["student"]}>
                <ChapterLessons />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chapter/:chapterId/stories"
            element={
              <ProtectedRoute roles={["student"]}>
                <ChapterStories />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chapter/:chapterId/practice/:level"
            element={
              <ProtectedRoute roles={["student"]}>
                <ChapterPractice />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lesson/:lessonId"
            element={
              <ProtectedRoute roles={["student"]}>
                <LessonDetail />
              </ProtectedRoute>
            }
          />
          {/* "Cours complet" — the lesson's long-form body (Correction N6). */}
          <Route
            path="/lesson/:lessonId/cours"
            element={
              <ProtectedRoute roles={["student"]}>
                <LessonReader />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz/:quizId"
            element={
              <ProtectedRoute roles={["student"]}>
                <Quiz />
              </ProtectedRoute>
            }
          />
          <Route
            path="/paper/:quizId"
            element={
              <ProtectedRoute roles={["student"]}>
                <PaperQuiz />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz/:quizId/result"
            element={
              <ProtectedRoute roles={["student"]}>
                <QuizResult />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz/:quizId/correction"
            element={
              <ProtectedRoute roles={["student"]}>
                <QuizCorrection />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mock-exam"
            element={
              <ProtectedRoute roles={["student"]}>
                <MockExamHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mock-exam/:mockExamId/result"
            element={
              <ProtectedRoute roles={["student"]}>
                <MockExamResult />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shop"
            element={
              <ProtectedRoute roles={["student"]}>
                <Shop />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute roles={["student"]}>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <Leaderboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance"
            element={
              <ProtectedRoute roles={["student"]}>
                <Performance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            }
          />

          {/* Admin back-office (CDC 6.9) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin", "super_admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<AdminOverview />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="content/lesson/:lessonId" element={<AdminLessonEditor />} />
            <Route path="ai-review" element={<AdminAiReview />} />
            <Route path="mock-exams" element={<AdminMockExams />} />
            <Route path="teachers" element={<AdminTeachers />} />
            <Route path="admins" element={<AdminAdmins />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Teacher panel (CDC 6.10) */}
          <Route
            path="/teacher"
            element={
              <ProtectedRoute roles={["teacher", "admin", "super_admin"]}>
                <TeacherLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="subjects" element={<TeacherSubjects />} />
            <Route path="content" element={<TeacherContent />} />
            <Route path="content/lesson/:lessonId" element={<TeacherLessonEditor />} />
            <Route path="ai-assist" element={<TeacherAiAssist />} />
            <Route path="question-bank" element={<TeacherQuestionBank />} />
            <Route path="performance" element={<TeacherPerformance />} />
            <Route path="notifications" element={<TeacherNotifications />} />
            <Route path="account" element={<TeacherAccount />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
