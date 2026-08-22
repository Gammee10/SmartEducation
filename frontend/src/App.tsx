import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LibraryCatalogPage from './pages/LibraryCatalogPage';
import MyBorrowingPage from './pages/MyBorrowingPage';
import AdminLibraryPage from './pages/AdminLibraryPage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import AssignmentDetailPage from './pages/AssignmentDetailPage';
import QuizDetailPage from './pages/QuizDetailPage';
import TimetablePage from './pages/TimetablePage';
import AttendancePage from './pages/AttendancePage';
import StudentProfilePage from './pages/StudentProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import EventsPage from './pages/EventsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:id" element={<CourseDetailPage />} />
        <Route path="courses/:id/assignments/:assignmentId" element={<AssignmentDetailPage />} />
        <Route path="courses/:id/quizzes/:quizId" element={<QuizDetailPage />} />
        <Route path="courses/:id/attendance" element={<AttendancePage />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="students/:id" element={<StudentProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route path="library" element={<LibraryCatalogPage />} />
        <Route
          path="library/my-borrowing"
          element={
            <ProtectedRoute roles={['STUDENT']}>
              <MyBorrowingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="library/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminLibraryPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}