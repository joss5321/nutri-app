"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { fetchAdmins, updatePerfil, type Perfil } from "@/app/_data/perfiles";
import ConfirmModal from "@/app/_components/ConfirmModal";

export default function AdministradoresPage() {
  const [admins, setAdmins] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit modal
  const [editing, setEditing] = useState<Perfil | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFeedback, setEditFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Avatar upload in edit modal
  const editFileRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadAdmins = () => {
    fetchAdmins()
      .then(setAdmins)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los administradores."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    loadAdmins();
  }, []);

  const handleCreate = async () => {
    if (!nombre.trim() || !email.trim() || password.length < 8) {
      setFeedback({ type: "error", text: "Completa todos los campos. La contraseña debe tener al menos 8 caracteres." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: nombre.trim() } },
      });
      if (signUpError) throw signUpError;

      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      if (signUpData.user) {
        const { error: rolError } = await supabase
          .from("perfiles")
          .update({ rol: "admin" })
          .eq("id", signUpData.user.id);
        if (rolError) throw rolError;
      }

      setNombre("");
      setEmail("");
      setPassword("");
      setShowForm(false);
      setFeedback({ type: "success", text: `Administrador "${nombre.trim()}" creado correctamente.` });
      setLoading(true);
      loadAdmins();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo crear el administrador." });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (admin: Perfil) => {
    setEditing(admin);
    setEditNombre(admin.nombre_completo ?? "");
    setEditNewPassword("");
    setEditFeedback(null);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploadingAvatar(true);
    setEditFeedback(null);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${editing.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("perfiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", editing.id);
      if (updateError) throw updateError;

      setEditing({ ...editing, avatar_url: avatarUrl });
      setEditFeedback({ type: "success", text: "Foto actualizada." });
    } catch (err) {
      setEditFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo subir la foto." });
    } finally {
      setUploadingAvatar(false);
      if (editFileRef.current) editFileRef.current.value = "";
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    setEditFeedback(null);
    try {
      if (editNewPassword && editNewPassword.length < 8) {
        setEditFeedback({ type: "error", text: "La contraseña debe tener al menos 8 caracteres." });
        setSavingEdit(false);
        return;
      }

      await updatePerfil(editing.id, { nombre_completo: editNombre.trim() || null });

      if (editNewPassword) {
        // Only the user themselves can change their password via updateUser.
        // For other admins, we note this limitation.
        if (editing.id === currentUserId) {
          const { error: passError } = await supabase.auth.updateUser({ password: editNewPassword });
          if (passError) throw passError;
        } else {
          setEditFeedback({ type: "error", text: "Solo puedes cambiar tu propia contraseña. Usa 'Mi Perfil' o pide al admin que la cambie desde su cuenta." });
          setSavingEdit(false);
          return;
        }
      }

      setEditFeedback({ type: "success", text: "Cambios guardados." });
      setLoading(true);
      setEditing(null);
      loadAdmins();
    } catch (err) {
      setEditFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo actualizar." });
    } finally {
      setSavingEdit(false);
    }
  };

  const [confirmRemove, setConfirmRemove] = useState<Perfil | null>(null);

  const handleRemoveAdmin = async (admin: Perfil) => {
    setConfirmRemove(null);
    setFeedback(null);
    try {
      const { error } = await supabase
        .from("perfiles")
        .update({ rol: "usuario" })
        .eq("id", admin.id);
      if (error) throw error;
      setFeedback({ type: "success", text: `Se quitó el acceso de administrador a "${admin.nombre_completo || "Sin nombre"}".` });
      setLoading(true);
      loadAdmins();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo quitar el acceso." });
    }
  };

  const editInitials = (editing?.nombre_completo ?? "A")
    .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administradores</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona las cuentas con acceso al panel de administración.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setFeedback(null); }}
          className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          {showForm ? "✕ Cancelar" : "🛡️ Nuevo administrador"}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mb-4 text-sm rounded-xl px-4 py-3 ${
          feedback.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-1">Crear nuevo administrador</h3>
          <p className="text-sm text-gray-500 mb-4">Esta cuenta podrá acceder al panel de administración.</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Nombre completo</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Dr. Carlos Vega"
                className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@ejemplo.com"
                className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Contraseña (mín. 8 caracteres)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleCreate} disabled={saving}
              className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
              {saving ? "Creando..." : "✓ Crear administrador"}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={() => { setLoading(true); setError(null); loadAdmins(); }} className="font-semibold hover:underline">Reintentar</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Cargando administradores...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {["Nombre", "Registrado", "Acciones"].map((h) => (
                  <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {admins.map((a) => {
                const adminNombre = a.nombre_completo || "Sin nombre";
                const isSelf = a.id === currentUserId;
                return (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {a.avatar_url ? (
                          <Image src={a.avatar_url} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold shrink-0">
                            {adminNombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-900">{adminNombre}</span>
                          {isSelf && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">Tú</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString("es-MX") : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(a)}
                          className="w-9 h-9 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 flex items-center justify-center transition-colors" title="Editar">
                          ✏️
                        </button>
                        {!isSelf && (
                          <button onClick={() => a.id === currentUserId ? setFeedback({ type: "error", text: "No puedes eliminarte a ti mismo como administrador." }) : setConfirmRemove(a)}
                            className="w-9 h-9 rounded-xl border border-red-200 hover:border-red-400 hover:bg-red-50 flex items-center justify-center transition-colors" title="Quitar acceso">
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-gray-400 text-sm">
                    No hay administradores registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg">Editar administrador</h2>
              <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-5">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative group cursor-pointer" onClick={() => editFileRef.current?.click()}>
                  {editing.avatar_url ? (
                    <Image src={editing.avatar_url} alt="" width={80} height={80} className="w-20 h-20 rounded-full object-cover border-2 border-primary/30" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-2xl border-2 border-purple-200">
                      {editInitials}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <span className="text-white text-sm font-semibold">{uploadingAvatar ? "..." : "📷"}</span>
                  </div>
                </div>
                <input ref={editFileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                <p className="text-xs text-gray-400">Haz clic para cambiar la foto</p>
              </div>

              {/* Nombre */}
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Nombre completo</label>
                <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
              </div>

              {/* Contraseña */}
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">
                  Nueva contraseña <span className="text-gray-400">(dejar vacío para no cambiar)</span>
                </label>
                <input type="password" value={editNewPassword} onChange={(e) => setEditNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                {editing.id !== currentUserId && (
                  <p className="text-xs text-amber-600 mt-1">Solo puedes cambiar tu propia contraseña.</p>
                )}
              </div>

              {editFeedback && (
                <p className={`text-xs font-medium ${editFeedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
                  {editFeedback.text}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setEditing(null)} className="px-4 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={savingEdit}
                className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
                {savingEdit ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmRemove && (
        <ConfirmModal
          title="Quitar acceso de administrador"
          message={`¿Estás seguro de que deseas quitar el acceso de administrador a "${confirmRemove.nombre_completo || "Sin nombre"}"? Ya no podrá acceder al panel.`}
          confirmLabel="Quitar acceso"
          variant="warning"
          onConfirm={() => handleRemoveAdmin(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
