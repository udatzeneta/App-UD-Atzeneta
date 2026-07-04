import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isMockMode } from '../lib/supabase';
import { GlobalSearch } from '../components/GlobalSearch';
import {
  LayoutDashboard, Calendar, Trophy, Dumbbell, ShieldAlert,
  Award, Search, BarChart3, Settings, Menu, X, LogOut, ChevronRight,
  ClipboardCheck, Users, ClipboardList
} from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, roleSlug, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Definición de las secciones de navegación
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', pageKey: 'dashboard', icon: LayoutDashboard },
    { name: 'Calendario', path: '/calendar', pageKey: 'calendar', icon: Calendar },
    { name: 'Partidos', path: '/matches', pageKey: 'matches', icon: Trophy },
    { name: 'Jugadores', path: '/players', pageKey: 'players', icon: Users },
    { name: 'Entrenamientos', path: '/trainings', pageKey: 'trainings', icon: Dumbbell },
    { name: 'Editor Sesión', path: '/training-editor', pageKey: 'training_editor', icon: ClipboardList },
    { name: 'Asistencia', path: '/attendance', pageKey: 'attendance', icon: ClipboardCheck },
    { name: 'Multas', path: '/fines', pageKey: 'fines', icon: ShieldAlert },
    { name: 'Puntos', path: '/points', pageKey: 'points', icon: Award },
    { name: 'Scouting', path: '/scouting', pageKey: 'scouting', icon: Search },
    { name: 'Análisis Rival', path: '/opponent-analysis', pageKey: 'opponent_analysis', icon: BarChart3 },
    { name: 'Ajustes y Permisos', path: '/settings', pageKey: 'settings', icon: Settings },
  ];

  // Filtrar ítems de navegación según permisos de visualización ('ver')
  const visibleNavItems = navItems.filter(item => hasPermission(item.pageKey, 'ver'));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  // Mapear rol a etiqueta amigable
  const getRoleLabel = () => {
    switch (roleSlug) {
      case 'admin': return 'Administrador';
      case 'trainer': return 'Entrenador (Míster)';
      case 'player': return 'Jugador';
      case 'board': return 'Directivo';
      default: return 'Usuario';
    }
  };

  return (
    <div className="min-h-screen bg-brand-black-bg flex">
      {/* =====================================================================
          SIDEBAR ESCRITORIO
          ===================================================================== */}
      <aside className="hidden lg:flex flex-col w-64 bg-brand-black border-r border-brand-black-border shrink-0">
        
        {/* Identidad del club */}
        <div className="h-16 px-6 border-b border-brand-black-border flex items-center gap-3">
          <img 
            src="/club-logo.png" 
            alt="Escudo UD Atzeneta" 
            className="w-9 h-9 object-contain"
          />
          <div>
            <h1 className="text-sm font-bold tracking-wider text-brand-gray-light leading-none">UD ATZENETA</h1>
            <span className="text-[10px] text-brand-red-600 font-semibold tracking-wider">ERP DEPORTIVO</span>
          </div>
        </div>

        {/* Lista de enlaces */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto no-scrollbar">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive 
                    ? 'bg-brand-red-600 text-white font-medium shadow-glow-red' 
                    : 'text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5" />}
              </Link>
            );
          })}
        </nav>

        {/* Bloque inferior de Usuario */}
        <div className="p-4 border-t border-brand-black-border bg-brand-black-card/30">
          <div className="flex items-center gap-3 mb-4">
            <img 
              src={user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'} 
              alt={user?.full_name} 
              className="w-10 h-10 rounded-full border border-brand-black-border object-cover"
            />
            <div className="overflow-hidden">
              <h4 className="text-xs font-semibold text-brand-gray-light truncate">{user?.full_name}</h4>
              <span className="text-[10px] bg-brand-black-border text-brand-gray-muted px-1.5 py-0.5 rounded font-medium inline-block mt-0.5">
                {getRoleLabel()}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium text-brand-gray-muted hover:text-brand-red-600 hover:bg-brand-red-600/10 py-2 rounded-lg transition-colors border border-dashed border-brand-black-border hover:border-brand-red-600/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* =====================================================================
          SIDEBAR MÓVIL (DRAWER COLLAPSIBLE)
          ===================================================================== */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMobileMenu} />
          
          <aside className="relative flex flex-col w-72 max-w-[80vw] bg-brand-black border-r border-brand-black-border h-full shadow-premium animate-fade-in z-10">
            <div className="h-16 px-6 border-b border-brand-black-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-red-600 flex items-center justify-center font-bold text-white shadow-glow-red">
                  UA
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-wider text-brand-gray-light leading-none">UD ATZENETA</h1>
                  <span className="text-[10px] text-brand-red-600 font-semibold tracking-wider">ERP DEPORTIVO</span>
                </div>
              </div>
              <button onClick={closeMobileMenu} className="text-brand-gray-muted hover:text-brand-gray-light">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={closeMobileMenu}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-lg text-sm transition-all duration-150 ${
                      isActive 
                        ? 'bg-brand-red-600 text-white font-medium shadow-glow-red' 
                        : 'text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5" />}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-brand-black-border bg-brand-black-card/30">
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src={user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'} 
                  alt={user?.full_name} 
                  className="w-10 h-10 rounded-full border border-brand-black-border object-cover"
                />
                <div>
                  <h4 className="text-xs font-semibold text-brand-gray-light">{user?.full_name}</h4>
                  <span className="text-[10px] bg-brand-black-border text-brand-gray-muted px-1.5 py-0.5 rounded font-medium inline-block mt-0.5">
                    {getRoleLabel()}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 text-xs font-medium text-brand-gray-muted hover:text-brand-red-600 hover:bg-brand-red-600/10 py-3 rounded-lg transition-colors border border-brand-black-border"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar Sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* =====================================================================
          CONTENEDOR CENTRAL / ÁREA DE CONTENIDO
          ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Cabecera Móvil e Interfaz superior */}
        <header className="h-16 border-b border-brand-black-border bg-brand-black flex items-center justify-between px-4 sm:px-6 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <img 
                src="/club-logo.png" 
                alt="Escudo UD Atzeneta" 
                className="w-8 h-8 object-contain"
              />
              <span className="text-xs font-bold tracking-wider text-brand-gray-light">UD ATZENETA</span>
            </div>
            
            {/* Visualización Temporada Actual en Desktop */}
            <span className="hidden sm:inline-block text-xs bg-brand-black-border border border-brand-black-border/50 text-brand-gray-muted px-2.5 py-1 rounded-full font-medium">
              Temporada: 2025/2026
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Búsqueda Global */}
            <GlobalSearch />

            {/* Estado de conexión */}
            <span className={`hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full font-medium border ${
              isMockMode
                ? 'bg-amber-950/20 text-amber-500 border-amber-900/40'
                : 'bg-emerald-950/20 text-emerald-500 border-emerald-900/40'
            }`}>
              {isMockMode ? 'Modo Demo' : 'Conectado'}
            </span>
          </div>
        </header>

        {/* Contenido Dinámico */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
