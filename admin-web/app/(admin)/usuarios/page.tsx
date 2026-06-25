"use client";
import { useEffect, useState } from "react";
import UserModal from "@/app/_components/usuarios/UserModal";
import { fetchPerfiles, type Perfil } from "@/app/_data/perfiles";
import { supabase } from "@/lib/supabase";

function PlanBadge({ plan }: { plan: string }) {
  const isPremium = plan === "premium";
  return (
    <span className={`text-xs px-3 py-1 rounded-full font-semibold inline-flex items-center gap-1 ${
      isPremium ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
    }`}>
      {isPremium ? "👑 Premium" : "🔒 Básico"}
    </span>
  );
}

function CrearUsuarioModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [fechaNac, setFechaNac] = useState("");
  const [sexo, setSexo] = useState("femenino");
  const [telefono, setTelefono] = useState("");
  const [password] = useState("Temporal123!");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!nombre.trim() || !correo.trim()) {
      setError("Nombre y correo son obligatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: correo.trim().toLowerCase(),
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
        await supabase.from("perfiles").update({
          nombre_completo: nombre.trim(),
          email: correo.trim().toLowerCase(),
          sexo,
          fecha_nacimiento: fechaNac || null,
          telefono: telefono.trim() || null,
        }).eq("id", signUpData.user.id);
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Nuevo usuario</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Nombre completo *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. María García López"
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Correo electrónico *</label>
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="usuario@ejemplo.com"
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Fecha de nacimiento</label>
              <input type="date" value={fechaNac} onChange={(e) => setFechaNac(e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Género</label>
              <select value={sexo} onChange={(e) => setSexo(e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary">
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej. 55 1234 5678"
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">
              <span className="font-semibold">Contraseña temporal:</span> {password}
            </p>
            <p className="text-xs text-amber-600 mt-1">El usuario deberá cambiarla al iniciar sesión por primera vez.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
            {saving ? "Creando..." : "✓ Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<Perfil | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadPerfiles = () => {
    fetchPerfiles()
      .then(setPerfiles)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPerfiles();
  }, []);

  const load = () => {
    setLoading(true);
    setError(null);
    loadPerfiles();
  };

  const filtered = perfiles.filter((u) =>
    (u.nombre_completo ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios registrados</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona y consulta la información de todos los usuarios.</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors">
          + Nuevo usuario
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 h-11 mb-5 max-w-sm shadow-sm">
        <span className="text-gray-400">🔍</span>
        <input
          placeholder="Buscar por nombre o correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm focus:outline-none text-gray-700"
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={load} className="font-semibold hover:underline">Reintentar</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Cargando usuarios...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {["Nombre", "Correo", "Teléfono", "Sexo", "Plan", "Registrado", "Acciones"].map((h) => (
                  <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => {
                const nombre = u.nombre_completo || "Usuario sin nombre";
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">{u.email || "—"}</td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">{u.telefono || "—"}</td>
                    <td className="px-4 py-3.5 text-gray-600 capitalize text-xs">{u.sexo || "—"}</td>
                    <td className="px-4 py-3.5"><PlanBadge plan={u.plan_membresia} /></td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("es-MX") : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setSelected(u)}
                        className="w-9 h-9 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 flex items-center justify-center transition-colors"
                        title="Ver detalle"
                      >
                        👁
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                    No se encontraron usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && <UserModal perfil={selected} onClose={() => setSelected(null)} />}
      {showCreate && <CrearUsuarioModal onClose={() => setShowCreate(false)} onCreated={() => { setLoading(true); loadPerfiles(); }} />}
    </div>
  );
}
