"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) next.name = "Ingresa tu nombre completo";
    if (!email.trim()) next.email = "Requerido";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Correo inválido";
    if (!password || password.length < 8) next.password = "Mínimo 8 caracteres";
    if (confirmPassword !== password) next.confirmPassword = "Las contraseñas no coinciden";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    // TODO: conectar con Supabase auth (signUp)
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSuccess(true);
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
          <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary flex items-center justify-center">
            <span className="text-primary font-bold text-lg">M</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-wide">MyFitTrack</span>
        </div>

        {/* Heading central */}
        <div className="relative z-10 px-12">
          <h1 className="text-5xl font-extrabold text-white leading-tight">
            Únete y<br />transforma<br />
            <span className="text-primary">vidas</span>
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
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-8 lg:px-16 overflow-y-auto py-10">
        <div className="w-full max-w-sm">
          {success ? (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                ✉️
              </div>
              <h2 className="text-2xl font-extrabold text-primary">¡Cuenta creada!</h2>
              <p className="text-gray-500 text-sm">
                Revisa tu correo <span className="font-semibold text-gray-700">{email}</span> para
                confirmar tu cuenta antes de iniciar sesión.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-base hover:bg-primary-dark transition-colors mt-2"
              >
                Ir a iniciar sesión
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-extrabold text-primary">Crear cuenta</h2>
                <p className="text-gray-500 mt-2 text-sm">Regístrate para administrar la plataforma</p>
              </div>

              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                {/* Nombre */}
                <div>
                  <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 h-14 border border-transparent focus-within:border-primary transition-colors">
                    <span className="text-gray-400 text-lg">👤</span>
                    <input
                      type="text"
                      placeholder="Nombre completo"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setErrors((er) => ({ ...er, name: "" })); }}
                      className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
                    />
                  </div>
                  {errors.name && <p className="text-red-500 text-xs mt-1 ml-4">{errors.name}</p>}
                </div>

                {/* Email */}
                <div>
                  <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 h-14 border border-transparent focus-within:border-primary transition-colors">
                    <span className="text-gray-400 text-lg">✉</span>
                    <input
                      type="email"
                      placeholder="Correo electrónico"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: "" })); }}
                      className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
                    />
                  </div>
                  {errors.email && <p className="text-red-500 text-xs mt-1 ml-4">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 h-14 border border-transparent focus-within:border-primary transition-colors">
                    <span className="text-gray-400 text-lg">🔒</span>
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="Contraseña"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: "" })); }}
                      className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
                    />
                    <button type="button" onClick={() => setShowPass((v) => !v)} className="text-gray-400 hover:text-gray-600">
                      {showPass ? "🙈" : "👁"}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1 ml-4">{errors.password}</p>}
                </div>

                {/* Confirm password */}
                <div>
                  <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 h-14 border border-transparent focus-within:border-primary transition-colors">
                    <span className="text-gray-400 text-lg">🔒</span>
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Confirmar contraseña"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setErrors((er) => ({ ...er, confirmPassword: "" })); }}
                      className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="text-gray-400 hover:text-gray-600">
                      {showConfirm ? "🙈" : "👁"}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-500 text-xs mt-1 ml-4">{errors.confirmPassword}</p>}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="h-14 rounded-2xl bg-primary text-white font-bold text-base hover:bg-primary-dark transition-colors disabled:opacity-60 mt-1"
                >
                  {loading ? "Creando cuenta..." : "Crear cuenta"}
                </button>
              </form>

              {/* Footer */}
              <div className="flex items-center justify-center gap-1 mt-6">
                <span className="text-gray-500 text-sm">¿Ya tienes cuenta?</span>
                <a href="/login" className="text-primary text-sm font-semibold hover:underline">
                  Inicia sesión
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
