import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from './context/SessionContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { RequestListPage } from './pages/Requests/RequestListPage';
import { RequestCreatePage } from './pages/Requests/RequestCreatePage';
import { RequestDetailPage } from './pages/Requests/RequestDetailPage';
import { PendingApprovalsPage } from './pages/Approvals/PendingApprovalsPage';
import { NotificationsPage } from './pages/Notifications/NotificationsPage';
import { TemplateListPage } from './pages/Admin/Templates/TemplateListPage';
import { TemplateBuilderPage } from './pages/Admin/Templates/TemplateBuilderPage';
import { UserManagementPage } from './pages/Admin/Users/UserManagementPage';
import { AuditLogPage } from './pages/Admin/Audit/AuditLogPage';
import { SystemSettingsPage } from './pages/Admin/Settings/SystemSettingsPage';
import { UserSettingsPage } from './pages/Settings/UserSettingsPage';
import { LoginPage } from './pages/Auth/LoginPage';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { Toaster } from 'react-hot-toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AppContent() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <LoginPage />;
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/requests" element={<RequestListPage />} />
            <Route path="/requests/new" element={<RequestCreatePage />} />
            <Route path="/requests/:id" element={<RequestDetailPage />} />
            <Route path="/requests/:id/edit" element={<RequestCreatePage />} />
            <Route path="/approvals" element={<PendingApprovalsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<UserSettingsPage />} />
            <Route path="/admin/templates" element={<TemplateListPage />} />
            <Route path="/admin/templates/new" element={<TemplateBuilderPage />} />
            <Route path="/admin/templates/:id/edit" element={<TemplateBuilderPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/audit" element={<AuditLogPage />} />
            <Route path="/admin/settings" element={<SystemSettingsPage />} />
          </Route>
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <BrowserRouter>
        <SessionProvider>
          <AppContent />
        </SessionProvider>
      </BrowserRouter>
      <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
