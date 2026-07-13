import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const UpdatePassword: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Verificar que el usuario viene de un enlace de recuperación y tiene sesión activa
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        showToast('error', 'Sesión no válida', 'El enlace ha expirado o no es válido. Vuelve a solicitar el cambio de contraseña.');
        navigate('/login');
      }
    });
  }, [navigate, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      showToast('error', 'Contraseña débil', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      showToast('error', 'Error', 'Las contraseñas no coinciden.');
      return;
    }
    
    setLoading(true);
    try {
      const { authService } = await import('../services/auth');
      await authService.updatePassword(password);
      setSuccess(true);
      showToast('success', 'Contraseña Actualizada', 'Tu contraseña ha sido cambiada correctamente.');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Error', err.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-brand-black-bg flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-brand-black border border-brand-black-border rounded-2xl p-8 text-center shadow-premium">
          <div className="w-16 h-16 bg-brand-red-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-brand-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">¡Contraseña Actualizada!</h2>
          <p className="text-sm text-brand-gray-muted mb-6">
            Ya puedes acceder a tu cuenta con tu nueva contraseña.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-brand-red-600 hover:bg-brand-red-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            Ir al Panel Principal <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black-bg flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-brand-black border border-brand-black-border rounded-2xl shadow-premium overflow-hidden p-8 relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold tracking-tight text-brand-gray-light">Nueva Contraseña</h2>
          <p className="text-xs text-brand-gray-muted mt-1.5">Introduce tu nueva contraseña de acceso.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label" htmlFor="password">Nueva Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
              <input
                id="password"
                type="password"
                className="form-input pl-10"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="confirm">Repite la Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
              <input
                id="confirm"
                type="password"
                className="form-input pl-10"
                placeholder="Mínimo 6 caracteres"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full bg-brand-red-600 hover:bg-brand-red-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-6"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>Guardar Contraseña</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
