import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LibraryCatalogPage from './pages/LibraryCatalogPage';
import MyBorrowingPage from './pages/MyBorrowingPage';
import AdminLibraryPage from './pages/AdminLibraryPage';
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