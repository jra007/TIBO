import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { RequirePermissionRoute } from './auth/RequirePermissionRoute';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { AccountPage } from './pages/AccountPage';
import { ViewsPage } from './pages/ViewsPage';
import { ViewDetailPage } from './pages/ViewDetailPage';
import { DashboardDetailPage } from './pages/DashboardDetailPage';
import { DashboardsPage } from './pages/DashboardsPage';
import { ViewBuilderPage } from './pages/view-builder/ViewBuilderPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AppearanceSettingsPage } from './pages/admin/AppearanceSettingsPage';
import { DataResetPage } from './pages/admin/DataResetPage';
import { ReportSettingsPage } from './pages/admin/ReportSettingsPage';
import { IngestionJournalPage } from './pages/admin/IngestionJournalPage';
import { RelationsReviewPage } from './pages/admin/RelationsReviewPage';
import { RetentionSettingsPage } from './pages/admin/RetentionSettingsPage';
import { GroupsPage } from './pages/admin/GroupsPage';
import { RbacPage } from './pages/admin/RbacPage';
import { AuthSettingsPage } from './pages/admin/AuthSettingsPage';
import { SmtpSettingsPage } from './pages/admin/SmtpSettingsPage';
import { AppearanceProvider } from './theme/AppearanceContext';

function App() {
  return (
    <AppearanceProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/views" replace />} />
            <Route path="/views" element={<ViewsPage />} />
            <Route path="/views/new" element={<ViewBuilderPage />} />
            <Route path="/views/:id" element={<ViewDetailPage />} />
            <Route path="/views/:id/edit" element={<ViewBuilderPage />} />
            <Route path="/dashboards" element={<DashboardsPage />} />
            <Route path="/dashboards/:id" element={<DashboardDetailPage />} />
            <Route path="/account" element={<AccountPage />} />
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
              <Route
                path="appearance"
                element={
                  <RequirePermissionRoute permission="settings:appearance:edit">
                    <AppearanceSettingsPage />
                  </RequirePermissionRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <RequirePermissionRoute permission="settings:report:edit">
                    <ReportSettingsPage />
                  </RequirePermissionRoute>
                }
              />
              <Route
                path="reset"
                element={
                  <RequirePermissionRoute permission="settings:reset:execute">
                    <DataResetPage />
                  </RequirePermissionRoute>
                }
              />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </AppearanceProvider>
  );
}

export default App;
