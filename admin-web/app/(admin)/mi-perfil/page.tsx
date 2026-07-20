"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { fetchPerfil, updatePerfil, type Perfil } from "@/app/_data/perfiles";

export default function MiPerfilPage() {
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");

  // Edit profile
  const [nombre, setNombre] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Change password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? "");
      setUserId(user.id);
      try {
        const p = await fetchPerfil(user.id);
        setPerfil(p);
        setNombre(p.nombre_completo ?? "");
      } catch {}
      setLoading(false);
    });
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingAvatar(true);
    setAvatarFeedback(null);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("perfiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", userId);
      if (updateError) throw updateError;

      setPerfil((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      setAvatarFeedback({ type: "success", text: "Foto actualizada." });
    } catch (err) {
      setAvatarFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo subir la foto." });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);
    setProfileFeedback(null);
    try {
      const updated = await updatePerfil(userId, { nombre_completo: nombre.trim() || null });
      setPerfil(updated);
      await supabase.auth.updateUser({ data: { full_name: nombre.trim() } });
      setProfileFeedback({ type: "success", text: "Perfil actualizado correctamente." });
    } catch (err) {
      setProfileFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo actualizar el perfil." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordFeedback(null);
    if (newPassword.length < 8) {
      setPasswordFeedback({ type: "error", text: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback({ type: "success", text: "Contraseña actualizada correctamente." });
    } catch (err) {
      setPasswordFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo cambiar la contraseña." });
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (perfil?.nombre_completo ?? "A")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-400 text-center py-20">Cargando perfil...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-500 text-sm mt-1">Administra tu información personal y seguridad.</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-5 mb-6">
          <div className="relative group">
            {perfil?.avatar_url ? (
              <Image
                src={perfil.avatar_url}
                alt="Avatar"
                width={80}
                height={80}
                className="w-20 h-20 rounded-full object-cover border-2 border-primary/30"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-2xl border-2 border-primary/30">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            >
              <span className="text-white text-sm font-semibold">{uploadingAvatar ? "..." : "📷"}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-xl">{perfil?.nombre_completo || "Administrador"}</h2>
            <p className="text-gray-500 text-sm">{email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-3 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-700">
                🛡 Administrador
              </span>
            </div>
          </div>
        </div>

        {avatarFeedback && (
          <p className={`text-xs font-medium mb-3 ${avatarFeedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {avatarFeedback.text}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 font-medium">Correo electrónico</p>
            <p className="text-gray-700 font-medium mt-1">{email}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 font-medium">Rol</p>
            <p className="text-gray-700 font-medium mt-1 capitalize">{perfil?.rol ?? "admin"}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 font-medium">Sexo</p>
            <p className="text-gray-700 font-medium mt-1 capitalize">{perfil?.sexo ?? "—"}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 font-medium">Registrado</p>
            <p className="text-gray-700 font-medium mt-1">
              {perfil?.created_at ? new Date(perfil.created_at).toLocaleDateString("es-MX") : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Edit name */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-1">Editar información</h3>
        <p className="text-sm text-gray-500 mb-4">Actualiza tu nombre visible en la plataforma.</p>

        <div className="mb-4">
          <label className="text-xs text-gray-500 font-medium block mb-1">Nombre completo</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          {profileFeedback && (
            <span className={`text-xs font-medium ${profileFeedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {profileFeedback.text}
            </span>
          )}
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            {savingProfile ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-gray-900 mb-1">Cambiar contraseña</h3>
        <p className="text-sm text-gray-500 mb-4">Ingresa tu nueva contraseña (mínimo 8 caracteres).</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {passwordFeedback && (
            <span className={`text-xs font-medium ${passwordFeedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {passwordFeedback.text}
            </span>
          )}
          <button
            onClick={handleChangePassword}
            disabled={savingPassword}
            className="px-4 h-10 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
          >
            {savingPassword ? "Cambiando..." : "🔒 Cambiar contraseña"}
          </button>
        </div>
      </div>
    </div>
  );
}
