import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { ApiRequestLogsPage } from './pages/ApiRequestLogsPage';
import { HistoryPage } from './pages/HistoryPage';
import { InstanceDashboardPage } from './pages/InstanceDashboardPage';
import { InstancesPage } from './pages/InstancesPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TokensPage } from './pages/TokensPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/docs" element={<ApiDocsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<InstancesPage />} />
            <Route path="tokens" element={<TokensPage />} />
          </Route>
          <Route
            path="/instances/:instanceId"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<InstanceDashboardPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="logs" element={<ApiRequestLogsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
