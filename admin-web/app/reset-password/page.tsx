"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PasswordInput from "../login/PasswordInput";
import { CircleCheck, CircleAlert } from "lucide-react";

// Alineado con el único otro formulario de contraseña que existe hoy
// (login), y con el mismo mínimo ya usado en mobile-app/reset-password.tsx
// — nunca puede entrar en conflicto con el mínimo real de Supabase Auth (6).
const MIN_PASSWORD_LENGTH = 8;

type Status = "loading" | "ready" | "linkError" | "submitting" | "success";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // supabase-js procesa el fragment del link (#access_token=...&type=recovery)
  // al cargar el módulo (detectSessionInUrl, activo por default en browser) y
  // dispara PASSWORD_RECOVERY — si el link ya expiró/fue usado, nunca llega
  // ese evento ni queda una sesión válida, así que getSession() resuelve el
  // caso de error sin depender únicamente del evento.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus((s) => (s !== "loading" ? s : session ? "ready" : "linkError"));
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }
    setStatus("submitting");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError("No se pudo actualizar tu contraseña. Solicita un nuevo enlace e intenta de nuevo.");
      setStatus("ready");
      return;
    }
    // No dejamos al usuario autenticado con la sesión de recuperación —
    // cierra sesión y lo manda a login normal, mismo criterio que mobile-app.
    await supabase.auth.signOut();
    setStatus("success");
  };

  if (status === "loading") {
    return (
      <Centered>
        <p className="text-secondary text-sm">Verificando enlace…</p>
      </Centered>
    );
  }

  if (status === "linkError") {
    return (
      <Centered>
        <div className="w-14 h-14 rounded-full bg-error-soft flex items-center justify-center mb-1">
          <CircleAlert size={26} className="text-error" />
        </div>
        <h2 className="text-xl font-extrabold text-text-primary text-center">Enlace no disponible</h2>
        <p className="text-secondary text-sm text-center leading-relaxed">
          Este enlace ya expiró, ya fue usado, o no es válido. Solicita uno nuevo desde la pantalla de inicio de sesión.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="h-12 px-6 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark transition-colors mt-2"
        >
          Volver a iniciar sesión
        </button>
      </Centered>
    );
  }

  if (status === "success") {
    return (
      <Centered>
        <div className="w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center mb-1">
          <CircleCheck size={26} className="text-primary" />
        </div>
        <h2 className="text-xl font-extrabold text-text-primary text-center">¡Contraseña actualizada!</h2>
        <p className="text-secondary text-sm text-center">Ya puedes iniciar sesión con tu nueva contraseña.</p>
        <button
          onClick={() => router.push("/login")}
          className="h-12 px-6 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark transition-colors mt-2"
        >
          Ir a iniciar sesión
        </button>
      </Centered>
    );
  }

  // ready | submitting
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white px-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <div className="text-center mb-2">
          <h2 className="text-2xl font-extrabold text-primary">Crea tu nueva contraseña</h2>
          <p className="text-secondary text-sm mt-1">Debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.</p>
        </div>

        <PasswordInput value={password} onChange={setPassword} placeholder="Nueva contraseña" />
        <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirmar contraseña" />

        {formError && <p className="text-error text-sm text-center">{formError}</p>}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="h-14 rounded-2xl bg-primary text-white font-bold text-base hover:bg-primary-dark transition-colors disabled:opacity-60 mt-1"
        >
          {status === "submitting" ? "Guardando..." : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white px-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-3 text-center">{children}</div>
    </div>
  );
}
