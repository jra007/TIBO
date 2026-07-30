import { Navigate, Route, Routes } from 'react-router-dom';
import { PermissionsProvider } from './auth/PermissionsContext';
import { RequirePermissionRoute } from './auth/RequirePermissionRoute';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ViewsPage } from './pages/ViewsPage';
import { DashboardsPage } from './pages/DashboardsPage';
import { ViewBuilderPage } from './pages/view-builder/ViewBuilderPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { IngestionJournalPage } from './pages/admin/IngestionJournalPage';
import { RelationsReviewPage } from './pages/admin/RelationsReviewPage';
import { RetentionSettingsPage } from './pages/admin/RetentionSettingsPage';
import { GroupsPage } from './pages/admin/GroupsPage';
import { RbacPage } from './pages/admin/RbacPage';
import { AuthSettingsPage } from './pages/admin/AuthSettingsPage';
import { SmtpSettingsPage } from './pages/admin/SmtpSettingsPage';

// TODO: replace with permissions resolved from the authenticated session once auth is wired up.
const CURRENT_USER_PERMISSIONS = ['view:read', 'view:create', 'view:share', 'settings:access'] as const;

function App() {
  return (
    <PermissionsProvider permissions={[...CURRENT_USER_PERMISSIONS]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/views" replace />} />
          <Route path="/views" element={<ViewsPage />} />
          <Route path="/views/new" element={<ViewBuilderPage />} />
          <Route path="/dashboards" element={<DashboardsPage />} />
          <Route
            path="/admin"
            element={
              <RequirePermissionRoute permission="settings:access">
                <AdminLayout />
              </RequirePermissionRoute>
            }
          >
            <Route index element={<Navigate to="/admin/ingestion" replace />} />
            <Route path="ingestion" element={<IngestionJournalPage />} />
            <Route path="relations" element={<RelationsReviewPage />} />
            <Route
              path="retention"
              element={
                <RequirePermissionRoute permission="settings:retention:edit">
                  <RetentionSettingsPage />
                </RequirePermissionRoute>
              }
            />
            <Route path="groups" element={<GroupsPage />} />
            <Route
              path="rbac"
              element={
                <RequirePermissionRoute permission="settings:rbac:edit">
                  <RbacPage />
                </RequirePermissionRoute>
              }
            />
            <Route path="auth" element={<AuthSettingsPage />} />
            <Route path="smtp" element={<SmtpSettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </PermissionsProvider>
  );
}

export default App;
