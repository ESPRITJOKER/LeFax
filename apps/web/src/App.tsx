import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { PrivateRoute } from "./routes/PrivateRoute";
import { StaffAppShell } from "./shells/StaffAppShell";
import { StudentAppShell } from "./shells/StudentAppShell";
import { useSessionStore } from "./stores/session.store";
import { api } from "./lib/api-client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotFoundPage } from "./pages/NotFoundPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { OnboardingTrackPage } from "./pages/onboarding/OnboardingTrackPage";
import { StudentDashboardPage } from "./pages/student/DashboardPage";
import { CourseLibraryPage } from "./pages/student/CourseLibraryPage";
import { LessonViewerPage } from "./pages/student/LessonViewerPage";
import { QcmPracticePage } from "./pages/student/QcmPracticePage";
import { ExamsListPage } from "./pages/student/ExamsListPage";
import { ExamTakePage } from "./pages/student/ExamTakePage";
import { ExamLeaderboardPage } from "./pages/student/ExamLeaderboardPage";
import { ExamCorrectionsPage } from "./pages/student/ExamCorrectionsPage";
import { WalletPage } from "./pages/student/WalletPage";
import { PastPapersPage } from "./pages/student/PastPapersPage";
import { ProfilePage } from "./pages/student/ProfilePage";
import { DiagnosticFlowPage } from "./pages/student/DiagnosticFlowPage";
import { TutorPage } from "./pages/student/TutorPage";
import { MasteryProfilePage } from "./pages/student/MasteryProfilePage";
import { TeacherDashboardPage } from "./pages/teacher/DashboardPage";
import { LessonEditorPage } from "./pages/teacher/LessonEditorPage";
import { QcmGeneratorPage } from "./pages/teacher/QcmGeneratorPage";
import { PastPapersEditorPage } from "./pages/teacher/PastPapersEditorPage";
import { QaInboxPage } from "./pages/teacher/QaInboxPage";
import { PerformancePage } from "./pages/teacher/PerformancePage";
import { AdminDashboardPage } from "./pages/admin/DashboardPage";
import { ReviewQueuePage } from "./pages/admin/ReviewQueuePage";
import { UsersPage } from "./pages/admin/UsersPage";
import { SchoolsPage } from "./pages/admin/SchoolsPage";
import { ExamsPage as AdminExamsPage } from "./pages/admin/ExamsPage";
import { AnalyticsPage } from "./pages/admin/AnalyticsPage";
import { PaymentsPage } from "./pages/admin/PaymentsPage";
import { STAFF_NAV_ADMIN, STAFF_NAV_TEACHER } from "./shells/staffNavItems";

export function App() {
  const setHydrated = useSessionStore((s) => s.setHydrated);
  const setSession = useSessionStore((s) => s.setSession);

  useEffect(() => {
    // Access token lives only in memory, so a hard refresh loses it — try to
    // silently re-derive one from the httpOnly refresh cookie (NFR-05), then
    // fetch the real profile so PrivateRoute doesn't see user:null and bounce
    // an otherwise-valid session back to /login.
    let cancelled = false;
    (async () => {
      const accessToken = await api.refresh();
      if (!cancelled && accessToken) {
        useSessionStore.setState({ accessToken });
        try {
          const { user } = await api.me();
          if (!cancelled) setSession(accessToken, user);
        } catch {
          if (!cancelled) useSessionStore.getState().clear();
        }
      }
      if (!cancelled) setHydrated();
    })();
    return () => {
      cancelled = true;
    };
  }, [setHydrated, setSession]);

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/onboarding/track" element={<OnboardingTrackPage />} />

        {/* Full-screen student routes — deliberately outside StudentAppShell
            (own header, no bottom nav), matching the Stitch "focused reading"
            treatment for the card reader and exam-taking flow. */}
        <Route
          path="/app/lessons/:lessonId"
          element={
            <PrivateRoute roles={["student"]}>
              <LessonViewerPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/app/exams/:examId/take"
          element={
            <PrivateRoute roles={["student"]}>
              <ExamTakePage />
            </PrivateRoute>
          }
        />

        <Route
          path="/app"
          element={
            <PrivateRoute roles={["student"]}>
              <StudentAppShell />
            </PrivateRoute>
          }
        >
          <Route index element={<StudentDashboardPage />} />
          <Route path="lessons" element={<CourseLibraryPage />} />
          <Route path="lessons/:lessonId/practice" element={<QcmPracticePage />} />
          <Route path="exams" element={<ExamsListPage />} />
          <Route path="exams/:examId/leaderboard" element={<ExamLeaderboardPage />} />
          <Route path="exams/:examId/corrections" element={<ExamCorrectionsPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="papers" element={<PastPapersPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="diagnostic" element={<DiagnosticFlowPage />} />
          <Route path="tutor" element={<TutorPage />} />
          <Route path="mastery" element={<MasteryProfilePage />} />
        </Route>

        <Route
          path="/teacher"
          element={
            <PrivateRoute roles={["teacher"]}>
              <StaffAppShell navItems={STAFF_NAV_TEACHER} roleLabel="Enseignant" />
            </PrivateRoute>
          }
        >
          <Route index element={<TeacherDashboardPage />} />
          <Route path="lessons" element={<LessonEditorPage />} />
          <Route path="qcms" element={<QcmGeneratorPage />} />
          <Route path="past-papers" element={<PastPapersEditorPage />} />
          <Route path="feedback" element={<QaInboxPage />} />
          <Route path="performance" element={<PerformancePage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <PrivateRoute roles={["admin"]}>
              <StaffAppShell navItems={STAFF_NAV_ADMIN} roleLabel="Administrateur" />
            </PrivateRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="review-queue" element={<ReviewQueuePage />} />
          <Route path="exams" element={<AdminExamsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="schools" element={<SchoolsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
