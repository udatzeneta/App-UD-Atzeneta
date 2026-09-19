import React, { useState } from 'react';
import { Share2, Copy, Check, X, Loader2, Link2Off, MessageCircle } from 'lucide-react';
import { dataService } from '../../services/data';
import type { OpponentPresentation } from '../../types';

interface Props {
  analysisId: string;
  opponentName: string;
  presentation: OpponentPresentation;
}

// Genera (o recupera) el enlace público de una presentación y lo deja listo
// para pegar en WhatsApp. El enlace es vivo: lo que se comparte es el acceso,
// no una copia, así que editar la presentación actualiza lo que ve el que abra.
export const PresentationShareButton: React.FC<Props> = ({ analysisId, opponentName, presentation }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const openDialog = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const share = await dataService.getOrCreatePresentationShare(analysisId, presentation.id, {
        title: presentation.title,
        opponent: opponentName,
      });
      setToken(share.token);
      setUrl(`${window.location.origin}/p/${share.token}`);
    } catch (e: any) {
      setError(e?.message || 'No se ha podido crear el enlace.');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Tu navegador no ha dejado copiar. Selecciona el enlace y cópialo a mano.');
    }
  };

  const revoke = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await dataService.revokePresentationShare(token);
      setUrl(null);
      setToken(null);
    } catch (e: any) {
      setError(e?.message || 'No se ha podido revocar el enlace.');
    } finally {
      setLoading(false);
    }
  };

  const whatsappHref = url
    ? `https://wa.me/?text=${encodeURIComponent(`${presentation.title} — Análisis de ${opponentName}\n${url}`)}`
    : '#';

  return (
    <>
      <button
        onClick={openDialog}
        className="p-2 text-brand-gray-muted hover:text-emerald-400 bg-black border border-brand-black-border rounded-lg"
        title="Compartir enlace público"
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-brand-black-card border border-brand-black-border rounded-2xl shadow-premium"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-black-border">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white uppercase tracking-wide truncate">Compartir presentación</h3>
                <p className="text-[11px] text-brand-gray-muted truncate">{presentation.title}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 text-brand-gray-muted hover:text-white shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-brand-gray-muted py-4 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Preparando el enlace...
                </div>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg p-3">{error}</p>
              )}

              {!loading && url && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={url}
                      onFocus={e => e.currentTarget.select()}
                      className="form-input flex-1 font-mono text-xs"
                    />
                    <button
                      onClick={copy}
                      className="p-2.5 bg-black border border-brand-black-border rounded-lg text-brand-gray-muted hover:text-white shrink-0"
                      title="Copiar enlace"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2.5 text-sm font-bold transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
                  </a>

                  <div className="text-[11px] text-brand-gray-muted leading-relaxed bg-black border border-brand-black-border rounded-lg p-3">
                    Cualquiera con el enlace puede ver <strong className="text-brand-gray-light">solo esta presentación</strong>,
                    sin entrar en la app. Se actualiza sola: si editas las diapositivas, el enlace muestra la última versión.
                  </div>

                  <button
                    onClick={revoke}
                    className="flex items-center justify-center gap-2 text-xs text-brand-gray-muted hover:text-brand-red-500 transition-colors"
                  >
                    <Link2Off className="w-3.5 h-3.5" /> Revocar enlace (dejará de funcionar para todos)
                  </button>
                </>
              )}

              {!loading && !url && !error && (
                <p className="text-sm text-brand-gray-muted text-center py-4">
                  Enlace revocado. Cierra y vuelve a compartir para generar uno nuevo.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
