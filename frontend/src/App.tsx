import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { OfflineProvider } from './context/OfflineContext';
import { Layout } from './components/Layout';
import { PublicShell } from './components/PublicShell';
import { AuthenticatedGate } from './components/AuthenticatedGate';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PERMISSIONS } from './lib/permissions';
import { HomePage } from './pages/HomePage';
import { ServicesPage } from './pages/ServicesPage';
import { ContactPage } from './pages/ContactPage';
import { QuotePage } from './pages/QuotePage';
import { DemoPage } from './pages/DemoPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { QuotesPage } from './pages/QuotesPage';
import { QuoteDetailPage } from './pages/QuoteDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { SiteContentPage } from './pages/SiteContentPage';
import { SiteMenuPage } from './pages/SiteMenuPage';
import { ProjectPage } from './pages/ProjectPage';
import { FieldPage } from './pages/FieldPage';
import { ScanPiecePage } from './pages/ScanPiecePage';
import { LabelsAdminPage } from './pages/LabelsAdminPage';
import { LabelPrintPage } from './pages/LabelPrintPage';
import { ProjectLabelsRedirect } from './pages/ProjectLabelsRedirect';
import { ProjectsListPage } from './components/ProjectPortal';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
        <OfflineProvider>
          <Layout>
            <Routes>
              <Route
                path="/admin/labels/print/:projectId"
                element={
                  <ProtectedRoute
                    permissions={[PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE]}
                  >
                    <LabelPrintPage />
                  </ProtectedRoute>
                }
              />

              <Route element={<PublicShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/quote" element={<QuotePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/demo" element={<DemoPage />} />
                <Route path="/scan/:token" element={<ScanPiecePage />} />
              </Route>

              <Route
                path="/admin/labels/print/:projectId"
                element={
                  <ProtectedRoute
                    permissions={[PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE]}
                  >
                    <LabelPrintPage />
                  </ProtectedRoute>
                }
              />

              <Route element={<AuthenticatedGate />}>
                <Route path="/projects" element={<ProjectsListPage />} />
                <Route path="/project/:id" element={<ProjectPage />} />
                <Route
                  path="/field"
                  element={
                    <ProtectedRoute permissions={[PERMISSIONS.FIELD_USE]}>
                      <FieldPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute
                      permissions={[PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE]}
                    >
                      <UsersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/site-menu"
                  element={
                    <ProtectedRoute permissions={[PERMISSIONS.SITE_MENU_EDIT]}>
                      <SiteMenuPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/site-content"
                  element={
                    <ProtectedRoute permissions={[PERMISSIONS.SITE_CONTENT_EDIT]}>
                      <SiteContentPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute
                      permissions={[PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.ROLES_MANAGE]}
                    >
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/quotes"
                  element={
                    <ProtectedRoute permissions={[PERMISSIONS.QUOTES_VIEW]}>
                      <QuotesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/quotes/:quoteId"
                  element={
                    <ProtectedRoute permissions={[PERMISSIONS.QUOTES_VIEW]}>
                      <QuoteDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute permissions={[PERMISSIONS.DASHBOARD_VIEW]}>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/labels"
                  element={
                    <ProtectedRoute
                      permissions={[PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE]}
                    >
                      <LabelsAdminPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/project/:id/labels"
                  element={
                    <ProtectedRoute
                      permissions={[PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE]}
                    >
                      <ProjectLabelsRedirect />
                    </ProtectedRoute>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </OfflineProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
