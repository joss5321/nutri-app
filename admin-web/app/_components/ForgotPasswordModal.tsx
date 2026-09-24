"use client";
import { useState } from "react";
import { Mail, X, CircleCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Supabase Auth nunca revela si un correo existe o no en el sistema
// (resetPasswordForEmail responde igual en ambos casos) — el copy de
// éxito respeta eso a propósito: nunca confirma "sí existe esa cuenta".
export default function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Ingresa tu correo electrónico.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` }
    );
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="p-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center">
              <CircleCheck size={26} className="text-primary" />
            </div>
            <h3 className="font-bold text-text-primary text-lg">Revisa tu correo</h3>
            <p className="text-sm text-secondary leading-relaxed">
              Si <strong>{email.trim()}</strong> está registrado, te enviamos un enlace para restablecer tu contraseña.
            </p>
            <button
              onClick={onClose}
              className="mt-2 h-11 px-6 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-dark transition-colors"
            >
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-text-primary text-lg">¿Olvidaste tu contraseña?</h3>
                <p className="text-sm text-secondary mt-1">
                  Ingresa tu correo y te enviaremos un enlace para restablecerla.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-muted hover:text-secondary shrink-0"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center gap-3 bg-surface-muted rounded-2xl px-4 h-14 border border-transparent focus-within:border-primary transition-colors">
              <Mail size={18} className="text-muted shrink-0" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
                className="flex-1 bg-transparent outline-none text-text-primary text-sm"
              />
            </div>

            {error && <p className="text-error text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="h-12 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar enlace de recuperación"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
