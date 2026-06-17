import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isMockMode } from '../lib/supabase';
import { MOCK_USER_IDS } from '../services/mockData';
import { Lock, Mail, Users, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, loginAsMockUser } = useAuth();
  const { showToast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showToast('error', 'Error de Validación', 'Por favor introduce un correo electrónico.');
      return;
    }
    
    setLoading(true);
    try {
      await login(email, password);
      showToast('success', 'Sesión Iniciada', 'Bienvenido de nuevo al portal de la UD Atzeneta.');
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Error al Iniciar Sesión', err.message || 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (roleName: string, userId: string) => {
    setLoading(true);
    try {
      await loginAsMockUser(userId);
      showToast('success', `Acceso Demo: ${roleName}`, 'Has accedido con el rol de pruebas.');
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Error en acceso rápido', 'No se pudo iniciar la sesión demo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black-bg flex flex-col justify-center items-center p-4 relative overflow-hidden">
      
      {/* Luces de fondo decorativas (Efecto Linear) */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-brand-red-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-brand-black border border-brand-black-border rounded-2xl shadow-premium overflow-hidden p-8 relative z-10">
        
        {/* Cabecera Logo */}
        <div className="text-center mb-8">
          <img 
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS2NVtAOUKrtEAB5gtZDuu-p1cv0D0YcJofLqMfvnPeeA&s=10" 
            alt="Escudo UD Atzeneta" 
            className="w-14 h-14 mx-auto object-contain rounded-2xl mb-4 shadow-glow-red"
          />
          <h2 className="text-xl font-bold tracking-tight text-brand-gray-light">UD ATZENETA</h2>
          <p className="text-xs text-brand-gray-muted mt-1.5">Portal de Gestión Interna y ERP Deportivo</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label" htmlFor="email">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
              <input
                id="email"
                type="email"
                className="form-input pl-10"
                placeholder="mister@atzeneta.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="password">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
              <input
                id="password"
                type="password"
                className="form-input pl-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full mt-6 py-2.5 font-semibold"
            disabled={loading}
          >
            {loading ? 'Accediendo...' : 'Iniciar Sesión'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Panel de Acceso Rápido (Exclusivo de Modo Demo / Dev) */}
        {(isMockMode || import.meta.env.DEV) && (
          <div className="mt-8 pt-6 border-t border-brand-black-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-red-600" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted">Acceso Rápido (Pruebas)</h4>
              </div>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="text-[10px] text-brand-red-600 hover:text-brand-red-500 underline"
              >
                Limpiar datos
              </button>
            </div>
            <p className="text-[11px] text-brand-gray-dark mb-4 leading-normal">
              {isMockMode 
                ? 'La app corre en Modo Demo sin base de datos. Haz clic en cualquiera de los roles abajo:'
                : 'La app está conectada a Supabase. Puedes iniciar sesión rápido con los perfiles simulados locales:'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleQuickLogin('Administrador', MOCK_USER_IDS.udatzenetaAdmin)}
                className="btn-secondary py-2 text-xs font-medium bg-brand-black-card text-brand-gray-light hover:bg-brand-black-hover col-span-2 border border-brand-red-600/30"
                disabled={loading}
              >
                Admin (udatzenetact@gmail.com)
              </button>
              <button
                onClick={() => handleQuickLogin('Entrenador', MOCK_USER_IDS.trainer)}
                className="btn-secondary py-2 text-xs font-medium bg-brand-black-card text-brand-gray-light hover:bg-brand-black-hover"
                disabled={loading}
              >
                Míster (Entrenador)
              </button>
              <button
                onClick={() => handleQuickLogin('Jugador', MOCK_USER_IDS.player)}
                className="btn-secondary py-2 text-xs font-medium bg-brand-black-card text-brand-gray-light hover:bg-brand-black-hover"
                disabled={loading}
              >
                Paco (Jugador)
              </button>
              <button
                onClick={() => handleQuickLogin('Directivo', MOCK_USER_IDS.board)}
                className="btn-secondary py-2 text-xs font-medium bg-brand-black-card text-brand-gray-light hover:bg-brand-black-hover col-span-2"
                disabled={loading}
              >
                Directiva
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
