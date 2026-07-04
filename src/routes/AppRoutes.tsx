import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { Calendar } from '../pages/Calendar';
import { Matches } from '../pages/Matches';
import { MatchesStats } from '../pages/MatchesStats';
import { MatchReport } from '../pages/MatchReport';
import { Players } from '../pages/Players';
import { PlayerDetail } from '../pages/PlayerDetail';
import { Trainings } from '../pages/Trainings';
import { SessionEditor } from '../pages/SessionEditor';
import { Attendance } from '../pages/Attendance';
import { Fines } from '../pages/Fines';
import { Points } from '../pages/Points';
import { Scouting } from '../pages/Scouting';
import { OpponentAnalysisPage } from '../pages/OpponentAnalysis';
import { SettingsPage } from '../pages/Settings';
import { AccessDenied } from '../pages/AccessDenied';
import { NotFound } from '../pages/NotFound';
import { Register } from '../pages/Register';

// Componente Wrapper para Proteger Rutas según Autenticación y Permisos Dinámicos
interface ProtectedRouteProps {
  pageKey?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ pageKey }) => {
  const { isAuthenticated, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-black-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-black-border border-t-brand-red-600 animate-spin" />
          <span className="text-xs text-brand-gray-muted font-semibold tracking-wider uppercase">Cargando Portal...</span>
        </div>
      </div>
    );
  }

  // A) Si no está logueado, redirige a Login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // B) Si está logueado pero se especifica una sección y no tiene permisos de ver, redirige a 403
  if (pageKey && !hasPermission(pageKey, 'ver')) {
    return <Navigate to="/403" replace />;
  }

  // C) Permitido: renderiza el contenido envuelto
  return <Outlet />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Ruta de Login */}
      <Route path="/login" element={<Login />} />

      {/* Ruta de Registro Público */}
      <Route path="/register" element={<Register />} />

      {/* Rutas Privadas / Protegidas */}
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <DashboardLayout>
              <Outlet />
            </DashboardLayout>
          }
        >
          {/* Rutas por defecto y Dashboard (siempre requiere loguearse) */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route element={<ProtectedRoute pageKey="dashboard" />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="calendar" />}>
            <Route path="/calendar" element={<Calendar />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="matches" />}>
            <Route path="/matches" element={<Matches />} />
            <Route path="/matches/stats" element={<MatchesStats />} />
            <Route path="/matches/:matchId/report" element={<MatchReport />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="players" />}>
            <Route path="/players" element={<Players />} />
            <Route path="/players/:playerId" element={<PlayerDetail />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="trainings" />}>
            <Route path="/trainings" element={<Trainings />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="training_editor" />}>
            <Route path="/training-editor" element={<SessionEditor />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="attendance" />}>
            <Route path="/attendance" element={<Attendance />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="fines" />}>
            <Route path="/fines" element={<Fines />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="points" />}>
            <Route path="/points" element={<Points />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="scouting" />}>
            <Route path="/scouting" element={<Scouting />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="opponent_analysis" />}>
            <Route path="/opponent-analysis" element={<OpponentAnalysisPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="settings" />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Página 403 (Acceso Denegado) */}
          <Route path="/403" element={<AccessDenied />} />
        </Route>
      </Route>

      {/* Página 404 (No Encontrado) */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
