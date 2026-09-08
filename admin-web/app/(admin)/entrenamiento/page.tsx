"use client";
import { useEffect, useState } from "react";
import RutinaBuilderModal from "@/app/_components/rutinas/RutinaBuilderModal";
import { fetchPerfiles, type Perfil } from "@/app/_data/perfiles";
import { Search, Dumbbell, Crown, Lock } from "lucide-react";

function PlanBadge({ plan }: { plan: string }) {
  const isPremium = plan === "premium";
  return (
    <span className={`text-xs px-3 py-1 rounded-full font-semibold inline-flex items-center gap-1 ${
      isPremium ? "bg-brand-soft text-primary" : "bg-surface-muted text-secondary"
    }`}>
      {isPremium ? <Crown size={11} /> : <Lock size={11} />}
      {isPremium ? "Premium" : "Básico"}
    </span>
  );
}

export default function EntrenamientoPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<Perfil | null>(null);

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
    (u.nombre_completo ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Entrenamiento</h1>
          <p className="text-secondary text-sm mt-1">Selecciona un usuario para ver y armar su rutina semanal.</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-white border border-border rounded-xl px-4 h-11 mb-5 max-w-sm shadow-sm">
        <Search size={16} className="text-muted shrink-0" />
        <input
          placeholder="Buscar usuario por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm focus:outline-none text-text-primary"
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-error-soft border border-error/30 text-error text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={load} className="font-semibold hover:underline">Reintentar</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">Cargando usuarios...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider bg-background-secondary/50">
                {["Nombre", "Sexo", "Plan actual", "Registrado", "Acciones"].map((h) => (
                  <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-secondary">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {filtered.map((u) => {
                const nombre = u.nombre_completo || "Usuario sin nombre";
                return (
                  <tr key={u.id} className="hover:bg-background-secondary/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-text-primary">{nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-secondary capitalize">{u.sexo || "—"}</td>
                    <td className="px-4 py-3.5"><PlanBadge plan={u.plan_membresia} /></td>
                    <td className="px-4 py-3.5 text-secondary">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("es-MX") : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setSelected(u)}
                        className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 hover:text-primary text-secondary text-xs font-semibold transition-colors"
                        title="Ver y armar rutina"
                      >
                        <Dumbbell size={14} /> Ver rutina
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted text-sm">
                    No se encontraron usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {selected && (
        <RutinaBuilderModal
          patient={{ id: selected.id, name: selected.nombre_completo || "Usuario" }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
