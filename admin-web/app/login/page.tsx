"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PasswordInput from "./PasswordInput";

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
      if (!perfil || perfil.rol !== "admin") {
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
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ── Panel izquierdo ── */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden">
        {/* Fondo oscuro con overlay verde */}
        <div className="absolute inset-0 bg-gray-900" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A6845]/80 via-[#2EBD8C]/40 to-transparent" />

        {/* Foto simulada con gradiente de gym */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 30% 60%, rgba(46,189,140,0.3) 0%, transparent 60%),
              linear-gradient(135deg, #111 0%, #1a2e1a 50%, #0d1f0d 100%)
            `,
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3 p-8">
          <Image src="/logo-icon.png" alt="MyFitTrack" width={40} height={40} className="rounded-xl" />
          <span className="text-white font-semibold text-lg tracking-wide">MyFitTrack</span>
        </div>

        {/* Heading central */}
        <div className="relative z-10 px-12">
          <h1 className="text-5xl font-extrabold text-white leading-tight">
            Tu bienestar<br />es tu mejor<br />
            <span className="text-primary">inversión</span>
          </h1>
        </div>

        {/* Features bottom */}
        <div className="relative z-10 flex gap-10 px-12 pb-12">
          {[
            { icon: "🥗", label: "Recetas\nsaludables" },
            { icon: "🏋️", label: "Rutinas\nefectivas" },
            { icon: "📋", label: "Planes\npersonalizados" },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-2xl">
                {f.icon}
              </div>
              <span className="text-white/80 text-xs text-center whitespace-pre-line font-medium">
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
            <Image src="/logo-horizontal.png" alt="MyFitTrack" width={180} height={76} className="mb-4" />
            <h2 className="text-3xl font-extrabold text-primary">¡Bienvenido de nuevo!</h2>
            <p className="text-gray-500 mt-2 text-sm">Inicia sesión para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 h-14 border border-transparent focus-within:border-primary transition-colors">
              <span className="text-gray-400 text-lg">✉</span>
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
              />
            </div>

            {/* Password */}
            <PasswordInput value={password} onChange={setPassword} />

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

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

          {/* Registro */}
          <div className="flex items-center justify-center gap-1 mt-4">
            <span className="text-gray-500 text-sm">¿No tienes cuenta?</span>
            <a href="/register" className="text-primary text-sm font-semibold hover:underline">
              Regístrate
            </a>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-primary text-sm font-semibold">Ingresar con</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Social */}
          <div className="flex flex-col gap-3">
            <button className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-colors font-semibold text-gray-700 text-sm">
              <span className="text-xl font-bold text-[#4285F4]">G</span>
              Continue with Google
            </button>
            <button className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-colors font-semibold text-gray-700 text-sm">
              <span className="text-xl">🍎</span>
              Continue with Apple
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
