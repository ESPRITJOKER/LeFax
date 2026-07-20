import { Navigate, Route, Routes } from "react-router-dom";
import { BackendBanner } from "./components/BackendBanner";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Landing from "./pages/student/Landing";
import Register from "./pages/student/Register";
import Login from "./pages/student/Login";
import Track from "./pages/student/Track";
import Dashboard from "./pages/student/Dashboard";
import SubjectChapters from "./pages/student/SubjectChapters";
import ChapterLessons from "./pages/student/ChapterLessons";
import LessonDetail from "./pages/student/LessonDetail";
import Quiz from "./pages/student/Quiz";
import QuizResult from "./pages/student/QuizResult";
import QuizCorrection from "./pages/student/QuizCorrection";
import MockExamHome from "./pages/student/MockExamHome";
import MockExamResult from "./pages/student/MockExamResult";
import Shop from "./pages/student/Shop";
import Tasks from "./pages/student/Tasks";
import Leaderboard from "./pages/student/Leaderboard";
import Profile from "./pages/student/Profile";
import Notifications from "./pages/student/Notifications";
import Search from "./pages/student/Search";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/Overview";
import AdminStudents from "./pages/admin/Students";
import AdminContent from "./pages/admin/Content";
import AdminAiReview from "./pages/admin/AiReview";
import AdminMockExams from "./pages/admin/MockExams";
import AdminAdmins from "./pages/admin/Admins";
import AdminLogs from "./pages/admin/Logs";
import AdminSettings from "./pages/admin/Settings";

import TeacherLayout from "./pages/teacher/TeacherLayout";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherContent from "./pages/teacher/TeacherContent";
import TeacherAiAssist from "./pages/teacher/TeacherAiAssist";
import TeacherPerformance from "./pages/teacher/TeacherPerformance";

export default function App() {
  return (
    <>
      <BackendBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
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
          path="/lesson/:lessonId"
          element={
            <ProtectedRoute roles={["student"]}>
              <LessonDetail />
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
          <Route path="ai-review" element={<AdminAiReview />} />
          <Route path="mock-exams" element={<AdminMockExams />} />
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
          <Route path="content" element={<TeacherContent />} />
          <Route path="ai-assist" element={<TeacherAiAssist />} />
          <Route path="performance" element={<TeacherPerformance />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
