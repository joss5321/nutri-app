"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchAdmins, updatePerfil, type AdminListItem } from "@/app/_data/perfiles";
import ConfirmModal from "@/app/_components/ConfirmModal";
import { X, ShieldCheck, Check, Pencil, Trash2, Camera } from "lucide-react";

export default function AdministradoresPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
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
  const [editing, setEditing] = useState<AdminListItem | null>(null);
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

  // Guard real de acceso: esta página es superadmin-only. El layout
  // general de /admin solo exige rol admin/superadmin (aplica a todas las
  // rutas), así que un admin normal que escriba /administradores
  // directamente en la URL pasa ese primer check — este segundo check,
  // específico de la página, es el que realmente lo bloquea antes de
  // cargar cualquier dato.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .single();
      if (perfil?.rol !== "superadmin") {
        router.replace("/dashboard");
        return;
      }
      setCurrentUserId(user.id);
      setAuthorized(true);
      setCheckingAuth(false);
      loadAdmins();
    });
  }, [router]);

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

  const openEdit = (admin: AdminListItem) => {
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

  const [confirmRemove, setConfirmRemove] = useState<AdminListItem | null>(null);

  const handleRemoveAdmin = async (admin: AdminListItem) => {
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

  if (checkingAuth || !authorized) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted py-10 text-center">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Administradores</h1>
          <p className="text-secondary text-sm mt-1">Gestiona las cuentas con acceso al panel de administración.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setFeedback(null); }}
          className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          {showForm ? <X size={16} /> : <ShieldCheck size={16} />}
          {showForm ? "Cancelar" : "Nuevo administrador"}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mb-4 text-sm rounded-xl px-4 py-3 ${
          feedback.type === "success" ? "bg-success-soft border border-success/30 text-success" : "bg-error-soft border border-error/30 text-error"
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 mb-6">
          <h3 className="font-bold text-text-primary mb-1">Crear nuevo administrador</h3>
          <p className="text-sm text-secondary mb-4">Esta cuenta podrá acceder al panel de administración.</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-secondary font-medium block mb-1">Nombre completo</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Dr. Carlos Vega"
                className="w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-secondary font-medium block mb-1">Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@ejemplo.com"
                className="w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-secondary font-medium block mb-1">Contraseña (mín. 8 caracteres)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleCreate} disabled={saving}
              className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
              {!saving && <Check size={15} />}
              {saving ? "Creando..." : "Crear administrador"}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center justify-between bg-error-soft border border-error/30 text-error text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={() => { setLoading(true); setError(null); loadAdmins(); }} className="font-semibold hover:underline">Reintentar</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted py-10 text-center">Cargando administradores...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider bg-background-secondary/50">
                {["Nombre", "Registrado", "Acciones"].map((h) => (
                  <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-secondary">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {admins.map((a) => {
                const adminNombre = a.nombre_completo || "Sin nombre";
                const isSelf = a.id === currentUserId;
                return (
                  <tr key={a.id} className="hover:bg-background-secondary/50 transition-colors">
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
                          <span className="font-medium text-text-primary">{adminNombre}</span>
                          {isSelf && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-brand-soft text-primary font-semibold">Tú</span>
                          )}
                          {a.rol === "superadmin" && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">SuperAdmin</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-secondary">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString("es-MX") : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(a)}
                          className="w-9 h-9 rounded-xl border border-border hover:border-primary hover:bg-primary/5 flex items-center justify-center transition-colors text-secondary hover:text-primary" title="Editar">
                          <Pencil size={15} />
                        </button>
                        {!isSelf && a.rol !== "superadmin" && (
                          <button onClick={() => setConfirmRemove(a)}
                            className="w-9 h-9 rounded-xl border border-error/30 hover:border-error/60 hover:bg-error-soft flex items-center justify-center transition-colors text-error" title="Quitar acceso">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted text-sm">
                    No hay administradores registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-divider">
              <h2 className="font-bold text-text-primary text-lg">Editar administrador</h2>
              <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-full hover:bg-surface-muted flex items-center justify-center text-muted"><X size={18} /></button>
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
                    <span className="text-white text-sm font-semibold">{uploadingAvatar ? "..." : <Camera size={16} />}</span>
                  </div>
                </div>
                <input ref={editFileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                <p className="text-xs text-muted">Haz clic para cambiar la foto</p>
              </div>

              {/* Nombre */}
              <div>
                <label className="text-xs text-secondary font-medium block mb-1">Nombre completo</label>
                <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
              </div>

              {/* Contraseña */}
              <div>
                <label className="text-xs text-secondary font-medium block mb-1">
                  Nueva contraseña <span className="text-muted">(dejar vacío para no cambiar)</span>
                </label>
                <input type="password" value={editNewPassword} onChange={(e) => setEditNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                {editing.id !== currentUserId && (
                  <p className="text-xs text-warning mt-1">Solo puedes cambiar tu propia contraseña.</p>
                )}
              </div>

              {editFeedback && (
                <p className={`text-xs font-medium ${editFeedback.type === "success" ? "text-success" : "text-error"}`}>
                  {editFeedback.text}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-divider">
              <button onClick={() => setEditing(null)} className="px-4 h-10 rounded-xl border border-border text-secondary text-sm hover:bg-background-secondary">
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
