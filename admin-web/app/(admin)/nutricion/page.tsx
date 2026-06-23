"use client";
import { useEffect, useState } from "react";
import { fetchPerfiles, type Perfil } from "@/app/_data/perfiles";
import NutricionEquivalentesForm from "@/app/_components/usuarios/NutricionEquivalentesForm";
import RecetasAsignadasForm from "@/app/_components/usuarios/RecetasAsignadasForm";
import SuplementosAsignadosForm from "@/app/_components/usuarios/SuplementosAsignadosForm";

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

export default function NutricionPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
          <h1 className="text-2xl font-bold text-gray-900">Nutrición</h1>
          <p className="text-gray-500 text-sm mt-1">Selecciona un usuario para asignar su plan de equivalentes y recetas.</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 h-11 mb-5 max-w-sm shadow-sm">
        <span className="text-gray-400">🔍</span>
        <input
          placeholder="Buscar usuario por nombre..."
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
                {["Nombre", "Sexo", "Plan actual", "Registrado", "Acciones"].map((h) => (
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
                    <td className="px-4 py-3.5 text-gray-600 capitalize">{u.sexo || "—"}</td>
                    <td className="px-4 py-3.5"><PlanBadge plan={u.plan_membresia} /></td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("es-MX") : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setSelected(u)}
                        className="flex items-center gap-2 h-9 px-3 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 hover:text-primary text-gray-600 text-xs font-semibold transition-colors"
                        title="Asignar nutrición"
                      >
                        🥗 Asignar
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                    No se encontraron usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de nutrición */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg">
                  {(selected.nombre_completo || "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-xl">Nutrición de {selected.nombre_completo || "Usuario"}</h2>
                  <p className="text-gray-500 text-sm">Equivalentes, recetas y suplementación</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-8">
              <NutricionEquivalentesForm key={selected.id} userId={selected.id} />
              <RecetasAsignadasForm key={`r-${selected.id}`} userId={selected.id} />
              <SuplementosAsignadosForm key={`s-${selected.id}`} userId={selected.id} />
            </div>
            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100">
              <button onClick={() => setSelected(null)} className="px-5 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
