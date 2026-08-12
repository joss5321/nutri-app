"use client";
import { useEffect, useState } from "react";
import UserModal from "@/app/_components/usuarios/UserModal";
import { fetchPerfiles, setIsActive, setEstatus, type Perfil } from "@/app/_data/perfiles";

// ── Badges ────────────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  const isPremium = plan === "premium";
  return (
    <span
      className={`text-xs px-3 py-1 rounded-full font-semibold inline-flex items-center gap-1 ${
        isPremium ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
      }`}
    >
      {isPremium ? "👑 Premium" : "🔒 Básico"}
    </span>
  );
}

function EstatusBadge({ perfil }: { perfil: Perfil }) {
  if (perfil.estatus === "pendiente") {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 bg-amber-100 text-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        Pendiente
      </span>
    );
  }
  if (perfil.estatus === "rechazado") {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 bg-red-100 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        Rechazado
      </span>
    );
  }
  // aprobado — muestra si está habilitado o deshabilitado
  return perfil.is_active ? (
    <span className="text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
      Aprobado
    </span>
  ) : (
    <span className="text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 bg-red-100 text-red-700">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
      Deshabilitado
    </span>
  );
}

// ── Toast de éxito ────────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white text-sm font-semibold px-5 py-3.5 rounded-2xl shadow-2xl animate-fade-in">
      <span className="text-emerald-400">✓</span>
      {message}
    </div>
  );
}

// ── Modal de confirmación ─────────────────────────────────────────────────────
interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "success";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmModal({
  title,
  message,
  confirmLabel,
  variant,
  loading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 h-10 rounded-xl text-white text-sm font-semibold disabled:opacity-50 ${
              variant === "danger"
                ? "bg-red-500 hover:bg-red-600"
                : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {loading ? "Guardando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Acciones por estatus ──────────────────────────────────────────────────────
type PendingAction =
  | { type: "aprobar"; perfil: Perfil }
  | { type: "rechazar"; perfil: Perfil }
  | { type: "toggle"; perfil: Perfil };

// ── Página principal ──────────────────────────────────────────────────────────
export default function UsuariosPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Perfil | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Filter tabs
  const [tabEstatus, setTabEstatus] = useState<"todos" | "pendiente" | "aprobado" | "rechazado">(
    "todos"
  );

  const loadPerfiles = () => {
    setError(null);
    fetchPerfiles()
      .then(setPerfiles)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPerfiles();
  }, []);

  const reload = () => {
    setLoading(true);
    loadPerfiles();
  };

  // ── Acciones ────────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    const { perfil } = pendingAction;
    try {
      if (pendingAction.type === "aprobar") {
        await setEstatus(perfil.id, "aprobado");
        setPerfiles((prev) =>
          prev.map((p) =>
            p.id === perfil.id ? { ...p, estatus: "aprobado", is_active: true } : p
          )
        );
        setToast(`${perfil.nombre_completo || "Usuario"} fue aprobado correctamente.`);
      } else if (pendingAction.type === "rechazar") {
        await setEstatus(perfil.id, "rechazado");
        setPerfiles((prev) =>
          prev.map((p) =>
            p.id === perfil.id ? { ...p, estatus: "rechazado", is_active: false } : p
          )
        );
        setToast(`Solicitud de ${perfil.nombre_completo || "usuario"} rechazada.`);
      } else if (pendingAction.type === "toggle") {
        const next = !perfil.is_active;
        await setIsActive(perfil.id, next);
        setPerfiles((prev) =>
          prev.map((p) => (p.id === perfil.id ? { ...p, is_active: next } : p))
        );
        setToast(
          next
            ? `${perfil.nombre_completo || "Usuario"} habilitado.`
            : `${perfil.nombre_completo || "Usuario"} deshabilitado.`
        );
      }
      setPendingAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Filtrado ─────────────────────────────────────────────────────────────────
  const counts = {
    todos: perfiles.length,
    pendiente: perfiles.filter((p) => p.estatus === "pendiente").length,
    aprobado: perfiles.filter((p) => p.estatus === "aprobado").length,
    rechazado: perfiles.filter((p) => p.estatus === "rechazado").length,
  };

  const filtered = perfiles.filter((u) => {
    const matchSearch =
      (u.nombre_completo ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchTab = tabEstatus === "todos" || u.estatus === tabEstatus;
    return matchSearch && matchTab;
  });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestiona las solicitudes y pacientes asignados a tu cuenta.
          </p>
        </div>
      </div>

      {/* Tabs de estatus */}
      <div className="flex items-center gap-1 mb-5">
        {(
          [
            { key: "todos",     label: "Todos" },
            { key: "pendiente", label: "Pendientes" },
            { key: "aprobado",  label: "Aprobados" },
            { key: "rechazado", label: "Rechazados" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTabEstatus(key)}
            className={`flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold transition-colors ${
              tabEstatus === key
                ? "bg-primary text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tabEstatus === key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {counts[key]}
            </span>
          </button>
        ))}
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
          <button onClick={reload} className="font-semibold hover:underline">
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Cargando pacientes...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {[
                  "Nombre",
                  "Correo",
                  "Teléfono",
                  "Sexo",
                  "Plan",
                  "Estado",
                  "Registrado",
                  "Acciones",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => {
                const nombre = u.nombre_completo || "Usuario sin nombre";
                const isPendiente = u.estatus === "pendiente";
                const isAprobado  = u.estatus === "aprobado";

                const rowBg = isPendiente
                  ? "bg-amber-50/30 hover:bg-amber-50/60"
                  : isAprobado && u.is_active
                  ? "bg-emerald-50/30 hover:bg-emerald-50/60"
                  : "bg-red-50/30 hover:bg-red-50/60";

                const avatarBg = isPendiente
                  ? "bg-amber-100 text-amber-600"
                  : isAprobado && u.is_active
                  ? "bg-primary/10 text-primary"
                  : "bg-red-100 text-red-500";

                return (
                  <tr key={u.id} className={`transition-colors ${rowBg}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarBg}`}
                        >
                          {nombre
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">{u.email || "—"}</td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">{u.telefono || "—"}</td>
                    <td className="px-4 py-3.5 text-gray-600 capitalize text-xs">
                      {u.sexo || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <PlanBadge plan={u.plan_membresia} />
                    </td>
                    <td className="px-4 py-3.5">
                      <EstatusBadge perfil={u} />
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("es-MX")
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {/* Ver detalle — siempre visible */}
                        <button
                          onClick={() => setSelected(u)}
                          className="w-8 h-8 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 flex items-center justify-center transition-colors"
                          title="Ver detalle"
                        >
                          👁
                        </button>

                        {/* Pendiente: Aprobar + Rechazar */}
                        {isPendiente && (
                          <>
                            <button
                              onClick={() => setPendingAction({ type: "aprobar", perfil: u })}
                              className="h-8 px-3 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                            >
                              ✓ Aprobar
                            </button>
                            <button
                              onClick={() => setPendingAction({ type: "rechazar", perfil: u })}
                              className="h-8 px-3 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 hover:border-red-300 transition-colors"
                            >
                              ✕ Rechazar
                            </button>
                          </>
                        )}

                        {/* Aprobado: Habilitar / Deshabilitar */}
                        {isAprobado && (
                          <button
                            onClick={() => setPendingAction({ type: "toggle", perfil: u })}
                            className={`h-8 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                              u.is_active
                                ? "border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                            }`}
                          >
                            {u.is_active ? "Deshabilitar" : "Habilitar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                    {search
                      ? "No se encontraron pacientes con ese criterio."
                      : tabEstatus === "pendiente"
                      ? "No hay solicitudes pendientes."
                      : "No hay pacientes en esta categoría."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalle */}
      {selected && <UserModal perfil={selected} onClose={() => setSelected(null)} />}

      {/* Modal de confirmación de acciones */}
      {pendingAction?.type === "aprobar" && (
        <ConfirmModal
          title="Aprobar paciente"
          message={`¿Confirmas que deseas aprobar a ${pendingAction.perfil.nombre_completo || "este paciente"}? Podrá iniciar sesión y recibir planes, rutinas y suplementos.`}
          confirmLabel="Sí, aprobar"
          variant="success"
          loading={actionLoading}
          onConfirm={handleConfirm}
          onCancel={() => !actionLoading && setPendingAction(null)}
        />
      )}
      {pendingAction?.type === "rechazar" && (
        <ConfirmModal
          title="Rechazar solicitud"
          message={`¿Confirmas que deseas rechazar la solicitud de ${pendingAction.perfil.nombre_completo || "este paciente"}? No podrá acceder a la aplicación.`}
          confirmLabel="Sí, rechazar"
          variant="danger"
          loading={actionLoading}
          onConfirm={handleConfirm}
          onCancel={() => !actionLoading && setPendingAction(null)}
        />
      )}
      {pendingAction?.type === "toggle" && (
        <ConfirmModal
          title={
            pendingAction.perfil.is_active ? "Deshabilitar paciente" : "Habilitar paciente"
          }
          message={
            pendingAction.perfil.is_active
              ? `¿Estás seguro de que deseas deshabilitar a ${pendingAction.perfil.nombre_completo || "este paciente"}? No podrá iniciar sesión mientras esté deshabilitado.`
              : `¿Estás seguro de que deseas habilitar nuevamente a ${pendingAction.perfil.nombre_completo || "este paciente"}? Podrá iniciar sesión y recibir asignaciones.`
          }
          confirmLabel={
            pendingAction.perfil.is_active ? "Sí, deshabilitar" : "Sí, habilitar"
          }
          variant={pendingAction.perfil.is_active ? "danger" : "success"}
          loading={actionLoading}
          onConfirm={handleConfirm}
          onCancel={() => !actionLoading && setPendingAction(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
