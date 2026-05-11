import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "./components/ui/toaster";

// Pages
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import FundingPage from "./pages/FundingPage";
import AIInsightsPage from "./pages/AIInsightsPage";
import TargetsPage from "./pages/TargetsPage";
import CommissionsPage from "./pages/CommissionsPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import OpenPoolPage from "./pages/OpenPoolPage";
import StudentRequestsPage from "./pages/StudentRequestsPage";
import PayoutsPage from "./pages/PayoutsPage";
import StudentLogsPage from "./pages/StudentLogsPage";
import PipelinePage from "./pages/PipelinePage";
import TicketsPage from "./pages/TicketsPage";
import MT5AccountsPage from "./pages/MT5AccountsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import GamificationSettingsPage from "./pages/GamificationSettingsPage";
import PersonnelPage from "./pages/PersonnelPage";
import CounselorsPage from "./pages/CounselorsPage";
import RetentionPage from "./pages/RetentionPage";
import ReportsPage from "./pages/ReportsPage";
import RoleManagementPage from "./pages/RoleManagementPage";

// Layout
import Layout from "./components/layout/Layout";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, user, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Public Route (redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/students"
        element={
          <ProtectedRoute
            allowedRoles={[
              "super_admin",
              "admin",
              "broker_admin",
              "academic_head",
              "junior_mentor",
              "senior_mentor",
              "subjunior_mentor",
              "assistance",
              "draw_admin",
            ]}
          >
            <StudentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/funding"
        element={
          <ProtectedRoute
            allowedRoles={[
              "super_admin",
              "broker_admin",
              "academic_head",
              "junior_mentor",
              "senior_mentor",
              "assistance",
              "draw_admin",
              "finance_admin",
            ]}
          >
            <FundingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ai-insights"
        element={
          <ProtectedRoute
            allowedRoles={["super_admin", "broker_admin", "academic_head"]}
          >
            <AIInsightsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student-logs"
        element={
          <ProtectedRoute
            allowedRoles={[
              "super_admin",
              "admin",
              "broker_admin",
              "academic_head",
              "junior_mentor",
              "senior_mentor",
              "assistance",
              "draw_admin",
            ]}
          >
            <StudentLogsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pipeline"
        element={
          <ProtectedRoute
            allowedRoles={[
              "super_admin",
              "admin",
              "broker_admin",
              "academic_head",
              "junior_mentor",
              "senior_mentor",
              "draw_admin",
            ]}
          >
            <PipelinePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/targets"
        element={
          <ProtectedRoute
            allowedRoles={[
              "super_admin",
              "broker_admin",
              "academic_head",
              "junior_mentor",
              "senior_mentor",
              "draw_admin",
            ]}
          >
            <TargetsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/commissions"
        element={
          <ProtectedRoute
            allowedRoles={[
              "super_admin",
              "broker_admin",
              "academic_head",
              "finance_admin",
              "junior_mentor",
              "senior_mentor",
              "draw_admin",
            ]}
          >
            <CommissionsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/payouts"
        element={
          <ProtectedRoute
            allowedRoles={[
              "super_admin",
              "finance_admin",
              "broker_admin",
              "junior_mentor",
              "senior_mentor",
            ]}
          >
            <PayoutsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/leaderboard"
        element={
          <ProtectedRoute>
            <LeaderboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/tickets"
        element={
          <ProtectedRoute>
            <TicketsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/open-pool"
        element={
          <ProtectedRoute
            allowedRoles={[
              "super_admin",
              "admin",
              "broker_admin",
              "academic_head",
              "junior_mentor",
              "senior_mentor",
              "subjunior_mentor",
              "draw_admin",
            ]}
          >
            <OpenPoolPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student-requests"
        element={
          <ProtectedRoute
            allowedRoles={[
              "super_admin",
              "broker_admin",
              "academic_head",
              "junior_mentor",
              "senior_mentor",
              "draw_admin",
            ]}
          >
            <StudentRequestsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/mt5-accounts"
        element={
          <ProtectedRoute
            allowedRoles={[
              "super_admin",
              "admin",
              "broker_admin",
              "academic_head",
            ]}
          >
            <MT5AccountsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute
            allowedRoles={["super_admin", "admin", "broker_admin"]}
          >
            <AuditLogsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/gamification-settings"
        element={
          <ProtectedRoute
            allowedRoles={["super_admin", "academic_head"]}
          >
            <GamificationSettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/personnel"
        element={
          <ProtectedRoute
            allowedRoles={["super_admin", "admin", "broker_admin", "academic_head"]}
          >
            <PersonnelPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/counselors"
        element={
          <ProtectedRoute
            allowedRoles={["super_admin", "admin", "broker_admin", "academic_head"]}
          >
            <CounselorsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/retention"
        element={
          <ProtectedRoute
            allowedRoles={["super_admin", "admin", "broker_admin", "draw_admin", "academic_head"]}
          >
            <RetentionPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute
            allowedRoles={["super_admin", "admin", "broker_admin", "academic_head", "finance_admin"]}
          >
            <ReportsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/role-management"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <RoleManagementPage />
          </ProtectedRoute>
        }
      />

      {/* Default Redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <WebSocketProvider>
              <AppRoutes />
              <Toaster />
            </WebSocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </div>
  );
}

export default App;
