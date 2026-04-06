import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import SavedItemsPage from './pages/SavedItemsPage';
import SavedSearchesPage from './pages/SavedSearchesPage';
import AccountPage from './pages/AccountPage';
import SharedSearchPage from './pages/SharedSearchPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"         element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/saved-items"
            element={
              <ProtectedRoute>
                <SavedItemsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/saved-searches"
            element={
              <ProtectedRoute>
                <SavedSearchesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route path="/search/:token" element={<SharedSearchPage />} />
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
