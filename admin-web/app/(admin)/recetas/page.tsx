"use client";
import { useEffect, useState } from "react";
import RecetaModal from "@/app/_components/recetas/RecetaModal";
import ConfirmModal from "@/app/_components/ConfirmModal";
import {
  CATEGORIAS_NUTRICIONALES,
  NIVELES_RECETA,
  TIPOS_RECETA,
  deleteReceta,
  duplicateReceta,
  fetchRecetas,
  type Receta,
} from "@/app/_data/recetas";

function RecipeDetail({
  receta,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  duplicating,
  deleting,
}: {
  receta: Receta;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  duplicating: boolean;
  deleting: boolean;
}) {
  const [tab, setTab] = useState<"ing" | "prep" | "info">("ing");

  return (
    <div className="w-96 shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base leading-snug">{receta.nombre}</p>
          {receta.tipo && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium inline-block mt-1">{receta.tipo}</span>
          )}
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 text-lg">×</button>
      </div>

      {/* Hero */}
      <div className="h-40 bg-primary/5 flex items-center justify-center text-6xl shrink-0">
        {receta.emoji || "🍽️"}
      </div>

      {/* Quick info */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 text-xs text-gray-500">
        <span>⏱ {receta.tiempo_min ?? "—"} min</span>
        <span>📊 {receta.nivel ?? "—"}</span>
        <span>🔥 {receta.calorias ?? "—"} kcal</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-100">
        <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50">
          ✏️ Editar
        </button>
        <button onClick={onDuplicate} disabled={duplicating} className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50">
          📋 {duplicating ? "Duplicando..." : "Duplicar"}
        </button>
        <button onClick={onDelete} disabled={deleting} className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50">
          🗑 {deleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-4">
        {([["ing", "Ingredientes"], ["prep", "Preparación"], ["info", "Info nutricional"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`py-3 px-2 text-xs font-semibold border-b-2 transition-colors ${
              tab === key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 flex-1">
        {tab === "ing" && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-3">
              Ingredientes{receta.porciones ? ` (${receta.porciones})` : ""}
            </p>
            {receta.ingredientes.length > 0 ? (
              <div className="flex flex-col gap-2">
                {receta.ingredientes.map((ing) => (
                  <div key={ing.id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                    <input type="checkbox" className="accent-primary" />
                    <span className="text-sm text-gray-700">{ing.descripcion}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin ingredientes registrados.</p>
            )}
          </div>
        )}

        {tab === "prep" && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-3">Pasos de preparación</p>
            {receta.pasos.length > 0 ? (
              <div className="flex flex-col gap-3">
                {receta.pasos.map((paso) => (
                  <div key={paso.id} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">{paso.numero}</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{paso.descripcion}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin pasos registrados.</p>
            )}
          </div>
        )}

        {tab === "info" && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">Macronutrientes (por porción)</p>
              {[
                { label: "Proteínas",     value: receta.proteinas_g ?? 0,     unit: "g", color: "bg-primary"    },
                { label: "Carbohidratos", value: receta.carbohidratos_g ?? 0, unit: "g", color: "bg-blue-400"   },
                { label: "Grasas",        value: receta.grasas_g ?? 0,        unit: "g", color: "bg-yellow-400" },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${m.color} shrink-0`} />
                  <span className="text-sm text-gray-700 flex-1">{m.label}</span>
                  <span className="text-sm font-bold text-gray-900">{m.value}{m.unit}</span>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-bold text-gray-700 mb-2">Información adicional</p>
              {[
                { label: "Dificultad",            value: receta.nivel ?? "—" },
                { label: "Tiempo de preparación", value: receta.tiempo_prep_min != null ? `${receta.tiempo_prep_min} min` : "—" },
                { label: "Tiempo de cocción",     value: receta.tiempo_coccion_min != null ? `${receta.tiempo_coccion_min} min` : "—" },
                { label: "Tipo de comida",        value: receta.tipo ?? "—" },
                { label: "Categoría",             value: receta.categoria_nutricional ?? "—" },
              ].map((r) => (
                <div key={r.label} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-medium text-gray-800">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RecetasPage() {
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [tipo, setTipo]       = useState("Todas");
  const [nivel, setNivel]     = useState("Todas");
  const [selected, setSelected] = useState<Receta | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Receta | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const loadRecetas = () => {
    fetchRecetas()
      .then(setRecetas)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las recetas."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRecetas();
  }, []);

  const load = () => {
    setLoading(true);
    setError(null);
    loadRecetas();
  };

  const filtered = recetas.filter((r) => {
    const matchSearch = search === "" || r.nombre.toLowerCase().includes(search.toLowerCase());
    const matchCat    = categoria === "Todas" || r.categoria_nutricional === categoria;
    const matchTipo   = tipo === "Todas" || r.tipo === tipo;
    const matchNivel  = nivel === "Todas" || r.nivel === nivel;
    return matchSearch && matchCat && matchTipo && matchNivel;
  });

  const handleSaved = (receta: Receta) => {
    setRecetas((prev) => {
      const exists = prev.some((r) => r.id === receta.id);
      return exists ? prev.map((r) => (r.id === receta.id ? receta : r)) : [receta, ...prev];
    });
    setSelected((prev) => (prev?.id === receta.id ? receta : prev));
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deleteReceta(id);
      setRecetas((prev) => prev.filter((r) => r.id !== id));
      setSelected((prev) => (prev?.id === id ? null : prev));
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar la receta.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (receta: Receta) => {
    setDuplicatingId(receta.id);
    try {
      const copia = await duplicateReceta(receta);
      setRecetas((prev) => [copia, ...prev]);
      setSelected(copia);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo duplicar la receta.");
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
            <p className="text-gray-500 text-sm mt-1">Gestiona y crea recetas saludables para tus planes nutricionales.</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors">
            + Nueva receta
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div>
            <label className="text-xs text-gray-400 font-medium mb-0.5 ml-1 block">&nbsp;</label>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 h-10 shadow-sm">
              <span className="text-gray-400 text-sm">🔍</span>
              <input placeholder="Buscar recetas..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-40 text-sm focus:outline-none text-gray-700" />
            </div>
          </div>
          {[
            { label: "Categoría",  value: categoria, set: setCategoria, options: ["Todas", ...CATEGORIAS_NUTRICIONALES] },
            { label: "Tipo",       value: tipo,      set: setTipo,      options: ["Todas", ...TIPOS_RECETA] },
            { label: "Dificultad", value: nivel,     set: setNivel,     options: ["Todas", ...NIVELES_RECETA] },
          ].map((f) => (
            <div key={f.label}>
              <label className="text-xs text-gray-400 font-medium mb-0.5 ml-1 block">{f.label}</label>
              <select value={f.value} onChange={(e) => f.set(e.target.value)}
                className="h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary bg-white shadow-sm">
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            <span>{error}</span>
            <button onClick={load} className="font-semibold hover:underline">Reintentar</button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 py-10 text-center">Cargando recetas...</p>
        ) : (
          <>
            {/* Counter */}
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-semibold text-gray-900">{filtered.length}</span> recetas encontradas
            </p>

            {/* Grid */}
            <div className="grid grid-cols-3 gap-5">
              {filtered.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelected(r.id === selected?.id ? null : r)}
                  className={`bg-white rounded-2xl border overflow-hidden cursor-pointer hover:shadow-md transition-all ${
                    selected?.id === r.id ? "border-primary shadow-md" : "border-gray-200"
                  }`}
                >
                  {/* Image */}
                  <div className="relative h-40 bg-primary/5 flex items-center justify-center">
                    <span className="text-5xl">{r.emoji || "🍽️"}</span>
                    {r.tipo && (
                      <span className="absolute top-2 left-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full font-semibold">
                        {r.tipo}
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <p className="font-semibold text-gray-900 text-sm leading-snug mb-2">{r.nombre}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span>⏱ {r.tiempo_min ?? "—"} min</span>
                      <span>📊 {r.nivel ?? "—"}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{r.calorias ?? "—"} kcal</p>
                    {r.categoria_nutricional && (
                      <span className="mt-2 inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {r.categoria_nutricional}
                      </span>
                    )}

                    {/* Botones de acción */}
                    <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setEditing(r)}
                        className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                      >
                        ✏ Editar
                      </button>
                      <button
                        onClick={() => handleDuplicate(r)}
                        disabled={duplicatingId === r.id}
                        className="h-9 px-3 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {duplicatingId === r.id ? "..." : "📋"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(r.id)}
                        disabled={deletingId === r.id}
                        className="h-9 px-3 rounded-xl border border-gray-200 text-red-500 text-xs font-semibold hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deletingId === r.id ? "..." : "🗑"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400">
                  <span className="text-4xl mb-2">🔍</span>
                  <p className="text-sm">No se encontraron recetas.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <RecipeDetail
          receta={selected}
          onClose={() => setSelected(null)}
          onEdit={() => setEditing(selected)}
          onDuplicate={() => handleDuplicate(selected)}
          onDelete={() => setConfirmDeleteId(selected.id)}
          duplicating={duplicatingId === selected.id}
          deleting={deletingId === selected.id}
        />
      )}

      {showCreate && (
        <RecetaModal onSave={handleSaved} onClose={() => setShowCreate(false)} />
      )}
      {editing && (
        <RecetaModal receta={editing} onSave={handleSaved} onClose={() => setEditing(null)} />
      )}
      {confirmDeleteId && (
        <ConfirmModal
          title="Eliminar receta"
          message="¿Estás seguro de que deseas eliminar esta receta del catálogo? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
