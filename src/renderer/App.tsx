import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuthStore } from './stores/authStore';
import { useUiStore } from './stores/uiStore';
import { LoginPage } from './components/auth/LoginPage';
import { SignupPage } from './components/auth/SignupPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { AppLayout } from './components/layout/AppLayout';
import { SettingsPage } from './components/settings/SettingsPage';
import { ProfilePage } from './components/profile/ProfilePage';
import ChatArea from './components/chat/ChatArea';
import { ErrorBoundary } from './components/layout/ErrorBoundary';

function useBootstrap() {
  const initialize = useAuthStore((s) => s.initialize);
  const applyTheme = useUiStore((s) => s.applyTheme);
  const setTheme = useUiStore((s) => s.setTheme);

  useEffect(() => {
    applyTheme();
    window.electron?.storage
      .get('app.theme')
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') setTheme(saved);
      })
      .catch(() => undefined);

    window.electron?.storage
      .get('app.muted')
      .then((muted) => {
        if (Array.isArray(muted)) useUiStore.setState({ muted: muted as string[] });
      })
      .catch(() => undefined);

    initialize();
  }, [initialize, applyTheme, setTheme]);
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const location = useLocation();

  if (!initialized) {
    return <div className="h-full w-full flex items-center justify-center text-content-secondary">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

export function App() {
  useBootstrap();

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<ChatArea />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
