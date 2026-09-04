"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Mail, User, Lock, MailCheck, Utensils, Dumbbell, ClipboardList } from "lucide-react";

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
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    setLoading(false);
    if (error) {
      setErrors((er) => ({
        ...er,
        email: error.message === "User already registered" ? "Este correo ya está registrado" : error.message,
      }));
      return;
    }
    setSuccess(true);
  };

  return (
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

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3 p-8">
          <div className="w-10 h-10 rounded-xl bg-white shrink-0 flex items-center justify-center p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, next/image requiere dangerouslyAllowSVG */}
            <img src="/branding/isotipo-myfittrack.svg" alt="MyFitTrack" width={612} height={792} className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-semibold text-lg tracking-wide">MyFitTrack</span>
        </div>

        {/* Heading central */}
        <div className="relative z-10 px-12">
          <h1 className="text-5xl font-extrabold text-white leading-tight tracking-tight">
            Únete y<br />transforma vidas
          </h1>
          <p className="text-white/60 text-base mt-4 max-w-sm">
            Crea tu cuenta para administrar pacientes, planes y progreso.
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
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-8 lg:px-16 overflow-y-auto py-10">
        <div className="w-full max-w-sm">
          {success ? (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MailCheck size={28} className="text-primary" />
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
              <div className="mb-8 text-center flex flex-col items-center">
                <div className="mb-4 flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, next/image requiere dangerouslyAllowSVG */}
                  <img src="/branding/isotipo-myfittrack.svg" alt="MyFitTrack" width={612} height={792} className="h-14 w-auto" />
                  <span className="text-xl font-extrabold text-gray-900 tracking-wide">MyFitTrack</span>
                </div>
                <h2 className="text-3xl font-extrabold text-primary">Crear cuenta</h2>
                <p className="text-gray-500 mt-2 text-sm">Regístrate para administrar la plataforma</p>
              </div>

              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                {/* Nombre */}
                <div>
                  <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 h-14 border border-transparent focus-within:border-primary transition-colors">
                    <User size={18} className="text-gray-400 shrink-0" />
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
                    <Mail size={18} className="text-gray-400 shrink-0" />
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
                    <Lock size={18} className="text-gray-400 shrink-0" />
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="Contraseña"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: "" })); }}
                      className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
                    />
                    <button type="button" onClick={() => setShowPass((v) => !v)} className="text-gray-400 hover:text-gray-600">
                      {showPass ? (
                          <EyeOff size={18} className="text-gray-400 hover:text-gray-600 cursor-pointer" />) : 
                          (<Eye size={18} className="text-gray-400 hover:text-gray-600 cursor-pointer" />)
                      }
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1 ml-4">{errors.password}</p>}
                </div>

                {/* Confirm password */}
                <div>
                  <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 h-14 border border-transparent focus-within:border-primary transition-colors">
                    <Lock size={18} className="text-gray-400 shrink-0" />
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Confirmar contraseña"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setErrors((er) => ({ ...er, confirmPassword: "" })); }}
                      className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="text-gray-400 hover:text-gray-600">
                      {showConfirm ? (
                          <EyeOff size={18} className="text-gray-400 hover:text-gray-600 cursor-pointer" />) : 
                          (<Eye size={18} className="text-gray-400 hover:text-gray-600 cursor-pointer" />)
                      }
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
