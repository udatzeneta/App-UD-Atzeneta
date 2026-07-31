import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isMockMode } from '../lib/supabase';
import {
  LayoutDashboard, Calendar, Trophy, Dumbbell, ShieldAlert, Shield,
  Award, Search, BarChart3, Settings, Menu, X, LogOut, ChevronRight,
  ClipboardCheck, Users, ClipboardList, TrendingUp, Activity, MoreHorizontal
} from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, roleSlug, logout, hasPermission, switchContext } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Bloquear el scroll del body cuando el menú desplegable móvil está abierto
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  // Cerrar el menú móvil automáticamente al cambiar de ruta
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const isPlayerRole = roleSlug === 'player';

  // Definición de las secciones de navegación
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', pageKey: 'dashboard', icon: LayoutDashboard },
    { name: 'Calendario', path: '/calendar', pageKey: 'calendar', icon: Calendar },
    { name: 'Partidos', path: '/matches', pageKey: 'matches', icon: Trophy },
    { name: 'Equipo', path: '/team', pageKey: 'team', icon: Shield },
    { name: isPlayerRole ? 'Perfil Jugador' : 'Jugadores', path: '/players', pageKey: 'players', icon: Users },
    { name: 'Mejora Individual', path: '/mejora-individual', pageKey: 'individual_improvement', icon: TrendingUp },
    { name: 'Entrenamientos', path: '/trainings', pageKey: 'trainings', icon: Dumbbell },
    { name: 'Preparación Física', path: '/pf', pageKey: 'pf', icon: Activity },
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

  // Principales ítems para la barra inferior fija en móvil (máximo 4 + botón "Más")
  const primaryBottomNavKeys = ['dashboard', 'calendar', 'matches', 'trainings'];
  const primaryBottomItems = visibleNavItems.filter(item => primaryBottomNavKeys.includes(item.pageKey)).slice(0, 4);

  // Si el ítem activo en la ruta actual no está entre los primeros 4, comprobar si está activo
  const isMoreActive = visibleNavItems.some(
    item => location.pathname === item.path && !primaryBottomItems.some(p => p.path === item.path)
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  // Mapear rol a etiqueta amigable
  const getRoleLabel = () => {
    switch (roleSlug) {
      case 'admin': return 'Administrador';
      case 'trainer': return `Entrenador${user?.team_category === 'Juvenil' ? ' (Juvenil)' : ' (Míster)'}`;
      case 'player': return `Jugador${user?.team_category === 'Juvenil' ? ' (Juvenil)' : ''}`;
      case 'board': return 'Directivo';
      default: return 'Usuario';
    }
  };

  return (
    <div className="min-h-screen bg-brand-black-bg flex flex-col lg:flex-row pb-20 lg:pb-0">
      {/* =====================================================================
          SIDEBAR ESCRITORIO
          ===================================================================== */}
      <aside className="hidden lg:flex flex-col w-64 bg-brand-black border-r border-brand-black-border shrink-0 print:hidden">
        
        {/* Identidad del club */}
        <div className="h-16 px-6 border-b border-brand-black-border flex items-center gap-3">
          <img 
            src="/club-logo.png" 
            alt="Escudo UD Atzeneta" 
            className="w-9 h-9 object-contain"
          />
          <div>
            <h1 className="text-sm font-bold tracking-wider text-brand-gray-light leading-none">UD ATZENETA</h1>
            <span className="text-[10px] text-brand-red-600 font-semibold tracking-wider">
              ERP DEPORTIVO {user?.team_category === 'Juvenil' ? '· JUVENIL' : ''}
            </span>
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
          CONTENEDOR CENTRAL / ÁREA DE CONTENIDO
          ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 print:bg-white print:h-screen">
        
        {/* Cabecera Móvil e Interfaz superior */}
        <header className="h-14 lg:h-16 border-b border-brand-black-border bg-brand-black/95 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 z-20 sticky top-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/club-logo.png"
              alt="Escudo UD Atzeneta"
              className="w-8 h-8 object-contain shrink-0"
            />
            <div>
              <span className="text-sm font-bold tracking-wide text-brand-gray-light block leading-none">UD ATZENETA</span>
              <span className="text-[9px] text-brand-red-600 font-semibold tracking-wider block lg:hidden">
                {user?.team_category ? `${user.team_category.toUpperCase()}` : 'ERP DEPORTIVO'}
              </span>
            </div>

            {/* Visualización Temporada Actual en Desktop */}
            <span className="hidden sm:inline-block text-xs bg-brand-black-border border border-brand-black-border/50 text-brand-gray-muted px-2.5 py-1 rounded-full font-medium ml-2">
              Temporada: 2026/2027
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Context Switcher (Multi-rol) */}
            {user?.availableContexts && user.availableContexts.length > 1 && (
              <div className="flex items-center bg-brand-black border border-brand-black-border rounded-lg px-2 sm:px-2.5 py-1 transition-colors hover:border-brand-gray-dark max-w-[130px] sm:max-w-none overflow-hidden">
                <Users className="hidden sm:block w-3 h-3 text-brand-gray-muted mr-2 shrink-0" />
                <select
                  value={`${user.role_id}-${user.team_category}`}
                  onChange={(e) => {
                    const [rId, tCat] = e.target.value.split('-');
                    switchContext(Number(rId), tCat);
                  }}
                  className="bg-transparent text-[10px] sm:text-[11px] text-brand-gray-light font-semibold focus:ring-0 border-none p-0 cursor-pointer uppercase tracking-wide truncate w-full"
                >
                  {user.availableContexts.map((ctx, i) => {
                    let roleName = 'Jugador';
                    if (ctx.role_id === 1) roleName = 'Admin';
                    if (ctx.role_id === 2) roleName = 'Entrenador';
                    if (ctx.role_id === 4) roleName = 'Directivo';
                    return (
                      <option key={`${ctx.role_id}-${ctx.team_category}-${i}`} value={`${ctx.role_id}-${ctx.team_category}`} className="bg-brand-black-card text-brand-gray-light uppercase">
                        {roleName} {ctx.team_category ? `· ${ctx.team_category}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Estado de conexión */}
            <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-medium border ${
              isMockMode
                ? 'bg-amber-950/20 text-amber-500 border-amber-900/40'
                : 'bg-emerald-950/20 text-emerald-500 border-emerald-900/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isMockMode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span className="hidden sm:inline">{isMockMode ? 'Modo Demo' : 'Conectado'}</span>
            </span>
          </div>
        </header>

        {/* Contenido Dinámico */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto print:p-0 print:overflow-visible">
          <div className="max-w-7xl mx-auto w-full animate-fade-in print:max-w-none print:w-auto">
            {children}
          </div>
        </main>
      </div>

      {/* =====================================================================
          MENÚ MÓVIL BOTTOM BAR & MODAL SHEET (DESPLEGABLE MODERNO)
          ===================================================================== */}

      {/* MODAL SHEET SUPERIOR CON TODO EL MENÚ */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden print:hidden">
          {/* Fondo traslúcido y difuminado */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-fade-in" 
            onClick={closeMobileMenu} 
          />

          {/* Panel Desplegable (Sheet desde abajo) */}
          <div className="relative w-full max-h-[85vh] bg-brand-black/98 border-t border-brand-black-border rounded-t-3xl shadow-2xl z-10 flex flex-col overflow-hidden animate-slide-up pb-[calc(5rem+env(safe-area-inset-bottom))]">
            
            {/* Tirador / Header del Sheet */}
            <div className="pt-3 pb-2 px-6 flex flex-col items-center border-b border-brand-black-border/60 shrink-0">
              <div className="w-12 h-1 bg-brand-gray-dark/60 rounded-full mb-3" />
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-brand-red-600/10 border border-brand-red-600/20 text-brand-red-600">
                    <Menu className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-brand-gray-light leading-none">Menú Principal</h3>
                    <span className="text-[10px] text-brand-gray-muted">Todas las secciones y opciones</span>
                  </div>
                </div>
                <button
                  onClick={closeMobileMenu}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-black-card text-brand-gray-muted hover:text-brand-gray-light border border-brand-black-border"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Rejilla/Lista de accesos de menú */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 no-scrollbar">
              <div className="grid grid-cols-2 gap-2">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 p-3 rounded-2xl border text-xs transition-all active:scale-[0.97] ${
                        isActive
                          ? 'bg-brand-red-600 text-white border-brand-red-500 font-semibold shadow-glow-red'
                          : 'bg-brand-black-card/60 text-brand-gray-light border-brand-black-border hover:bg-brand-black-hover hover:border-brand-gray-dark'
                      }`}
                    >
                      <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-brand-black border border-brand-black-border text-brand-red-600'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="truncate leading-tight">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Perfil & Logout al final del Sheet */}
            <div className="p-4 border-t border-brand-black-border bg-brand-black-card/40 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                    alt={user?.full_name}
                    className="w-9 h-9 rounded-full border border-brand-black-border object-cover"
                  />
                  <div className="overflow-hidden">
                    <h4 className="text-xs font-semibold text-brand-gray-light truncate">{user?.full_name}</h4>
                    <span className="text-[10px] text-brand-gray-muted block truncate">
                      {getRoleLabel()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-brand-red-500 bg-brand-red-600/10 hover:bg-brand-red-600/20 rounded-xl border border-brand-red-600/30 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Salir
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* BARRA INFERIOR FIJA (BOTTOM NAV BAR) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-brand-black/95 backdrop-blur-xl border-t border-brand-black-border px-3 py-2 print:hidden pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_20px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {primaryBottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-150 active:scale-95 ${
                  isActive ? 'text-brand-red-500 font-bold' : 'text-brand-gray-muted hover:text-brand-gray-light'
                }`}
              >
                <div className={`relative p-1.5 rounded-xl transition-colors ${isActive ? 'bg-brand-red-600/15' : ''}`}>
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-brand-red-600 rounded-full shadow-glow-red" />
                  )}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[64px]">{item.name}</span>
              </Link>
            );
          })}

          {/* Botón para desplegar Menú Completo */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-150 active:scale-95 ${
              isMobileMenuOpen || isMoreActive ? 'text-brand-red-500 font-bold' : 'text-brand-gray-muted hover:text-brand-gray-light'
            }`}
          >
            <div className={`relative p-1.5 rounded-xl transition-colors ${isMobileMenuOpen || isMoreActive ? 'bg-brand-red-600/15' : ''}`}>
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 scale-110" />
              ) : (
                <MoreHorizontal className="w-5 h-5" />
              )}
              {(isMobileMenuOpen || isMoreActive) && (
                <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-brand-red-600 rounded-full shadow-glow-red" />
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Menú</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

