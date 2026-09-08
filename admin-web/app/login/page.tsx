"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PasswordInput from "./PasswordInput";
import { useSearchParams } from "next/navigation";
import { Mail, Utensils, Dumbbell, ClipboardList } from "lucide-react";

function SearchParamsHandler({ onError }: { onError: (msg: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("error") === "no_admin") {
      onError("No tienes permisos para acceder al panel de administración.");
    }
  }, [searchParams, onError]);
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (authError) {
      setLoading(false);
      setError(
        authError.message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : authError.message
      );
      return;
    }

    const userId = authData.user?.id;
    if (userId) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", userId)
        .single();
      if (!perfil || !["admin", "superadmin"].includes(perfil.rol)) {
        await supabase.auth.signOut();
        setLoading(false);
        setError("No tienes permisos para acceder al panel de administración.");
        return;
      }
    }

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsHandler onError={setError} />
      </Suspense>
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ── Panel izquierdo ── */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-sidebar">
        {/* Brillo de marca, sutil */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 20% -10%, rgba(61,220,151,0.16) 0%, transparent 55%),
              radial-gradient(ellipse at 100% 105%, rgba(18,61,48,0.9) 0%, transparent 60%)
            `,
          }}
        />

        {/* Nombre de marca */}
        <div className="relative z-10 p-8">
          <span className="text-5xl font-extrabold tracking-tight drop-shadow-[0_2px_16px_rgba(255,248,36,0.35)]">
            <span className="text-white">My</span><span className="text-highlight">FitTrack</span>
          </span>
        </div>

        {/* Heading central */}
        <div className="relative z-10 px-12">
          <h1 className="text-5xl font-extrabold text-white leading-tight tracking-tight">
            Tu bienestar<br />es tu mejor inversión
          </h1>
          <p className="text-white/60 text-base mt-4 max-w-sm">
            Gestiona pacientes, planes y progreso desde un solo panel.
          </p>
        </div>

        {/* Features bottom */}
        <div className="relative z-10 flex gap-10 px-12 pb-12">
          {[
            { Icon: Utensils, label: "Recetas\nsaludables" },
            { Icon: Dumbbell, label: "Rutinas\nefectivas" },
            { Icon: ClipboardList, label: "Planes\npersonalizados" },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-white/8 border border-white/15 flex items-center justify-center">
                <f.Icon size={22} className="text-brand-accent" strokeWidth={1.75} />
              </div>
              <span className="text-white/70 text-xs text-center whitespace-pre-line font-medium">
                {f.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel derecho: formulario ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-8 lg:px-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center flex flex-col items-center">
            <div className="mb-4 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- asset de marca local, no requiere el pipeline de next/image */}
              <img src="/branding/isotipo-myfittrack.png" alt="MyFitTrack" width={900} height={900} className="h-20 w-auto" />
              <span className="text-2xl font-extrabold text-text-primary tracking-wide">MyFitTrack</span>
            </div>
            <h2 className="text-3xl font-extrabold text-primary">¡Bienvenido de nuevo!</h2>
            <p className="text-secondary mt-2 text-sm">Inicia sesión para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex items-center gap-3 bg-surface-muted rounded-2xl px-4 h-14 border border-transparent focus-within:border-primary transition-colors">
              <Mail size={18} className="text-muted shrink-0" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 bg-transparent outline-none text-text-primary text-sm"
              />
            </div>

            {/* Password */}
            <PasswordInput value={password} onChange={setPassword} />

            {error && <p className="text-error text-sm text-center">{error}</p>}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="h-14 rounded-2xl bg-primary text-white font-bold text-base hover:bg-primary-dark transition-colors disabled:opacity-60 mt-1"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>

            <a href="/forgot-password" className="text-center text-primary text-sm font-semibold hover:underline">
              Olvide mi contraseña
            </a>
          </form>

        </div>
      </div>
    </div>
    </>
  );
}
