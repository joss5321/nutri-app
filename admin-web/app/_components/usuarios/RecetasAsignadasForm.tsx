"use client";
import { useEffect, useState } from "react";
import { fetchRecetas, type Receta, type RecetaInput } from "@/app/_data/recetas";
import { fetchRecetasAsignadas, saveRecetasAsignadas, personalizeReceta } from "@/app/_data/recetas_guardadas";
import RecetaModal from "@/app/_components/recetas/RecetaModal";

export default function RecetasAsignadasForm({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [catalogo, setCatalogo] = useState<Receta[]>([]);
  const [asignadas, setAsignadas] = useState<Receta[]>([]);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [editingReceta, setEditingReceta] = useState<Receta | null>(null);

  const loadData = () => {
    Promise.all([fetchRecetas(), fetchRecetasAsignadas(userId)])
      .then(([todas, guardadas]) => {
        setCatalogo(todas);
        setAsignadas(guardadas);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las recetas."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const load = () => {
    setLoading(true);
    setError(null);
    loadData();
  };

  // Base IDs already covered by personal copies — exclude from catalog
  const assignedBaseIds = new Set(
    asignadas.map((r) => r.receta_base_id).filter(Boolean) as string[]
  );
  const asignadasIds = new Set(asignadas.map((r) => r.id));

  const addReceta = (recetaId: string) => {
    if (asignadasIds.has(recetaId)) return;
    const receta = catalogo.find((r) => r.id === recetaId);
    if (receta) setAsignadas((prev) => [...prev, receta]);
  };

  const removeReceta = (recetaId: string) => {
    setAsignadas((prev) => prev.filter((r) => r.id !== recetaId));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await saveRecetasAsignadas(userId, asignadas.map((r) => r.id));
      setFeedback({ type: "success", text: "Recetas guardadas correctamente." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudieron guardar las recetas." });
    } finally {
      setSaving(false);
    }
  };

  const handleCustomSave = async (input: RecetaInput): Promise<Receta> => {
    const saved = await personalizeReceta(userId, editingReceta!.id, input);
    // Update local asignadas list with the returned (possibly new) personal copy
    setAsignadas((prev) =>
      prev.map((r) => (r.id === editingReceta!.id || r.id === saved.id) ? saved : r)
    );
    setEditingReceta(null);
    return saved;
  };

  const catalogoDisponible = catalogo.filter((r) => {
    if (asignadasIds.has(r.id)) return false;
    if (assignedBaseIds.has(r.id)) return false;
    if (!search) return true;
    return r.nombre.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-10">Cargando recetas...</p>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold text-gray-900">Asignar recetas</p>
        <p className="text-sm text-gray-500">Arrastra o haz clic en las recetas del catálogo para asignarlas al usuario.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* ── Catálogo (izquierda) ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-600">Catálogo de recetas</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-9">
            <span className="text-gray-400 text-sm">🔍</span>
            <input
              placeholder="Buscar receta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700"
            />
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[20rem] pr-1">
            {catalogoDisponible.map((r) => (
              <div
                key={r.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                onClick={() => addReceta(r.id)}
                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                title="Arrastra o haz clic para asignar"
              >
                <span className="text-xl">{r.emoji || "🍽"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.nombre}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {r.tipo && <span>{r.tipo}</span>}
                    {r.calorias && <span>🔥 {r.calorias} kcal</span>}
                    {r.nivel && <span>📊 {r.nivel}</span>}
                  </div>
                </div>
                <span className="text-gray-300 text-lg">+</span>
              </div>
            ))}
            {catalogoDisponible.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">
                {catalogo.length === 0 ? "No hay recetas en el catálogo." : "No se encontraron recetas."}
              </p>
            )}
          </div>
        </div>

        {/* ── Asignadas (derecha, drop zone) ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-600">
            Recetas asignadas ({asignadas.length})
          </p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) addReceta(id);
              setDragOver(false);
            }}
            className={`flex-1 rounded-xl border-2 border-dashed p-3 flex flex-col gap-2 min-h-[20rem] overflow-y-auto transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-gray-200"
            }`}
          >
            {asignadas.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-1">
                <span className="text-3xl">🍽</span>
                <p className="text-sm text-center">Arrastra recetas aquí para asignarlas</p>
              </div>
            )}
            {asignadas.map((r) => (
              <div key={r.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                <span className="text-xl">{r.emoji || "🍽"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.nombre}</p>
                    {r.user_id !== null && (
                      <span className="shrink-0 text-[10px] font-semibold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                        Personalizada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {r.tipo && <span>{r.tipo}</span>}
                    {r.calorias && <span>🔥 {r.calorias} kcal</span>}
                  </div>
                </div>
                <button
                  onClick={() => setEditingReceta(r)}
                  className="text-gray-400 hover:text-primary text-sm px-1"
                  title="Editar receta para este usuario"
                >
                  ✏
                </button>
                <button onClick={() => removeReceta(r.id)} className="text-gray-400 hover:text-red-500 text-sm">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        {feedback && (
          <span className={`text-xs font-medium ${feedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {feedback.text}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "Guardando..." : "💾 Guardar recetas"}
        </button>
      </div>

      {editingReceta && (
        <RecetaModal
          receta={editingReceta}
          onClose={() => setEditingReceta(null)}
          onSave={(saved) => {
            setAsignadas((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
            setEditingReceta(null);
          }}
          customSave={handleCustomSave}
        />
      )}
    </div>
  );
}
