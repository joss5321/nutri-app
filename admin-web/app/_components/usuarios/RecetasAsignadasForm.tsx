"use client";
import { useEffect, useState } from "react";
import { fetchRecetas, type Receta, type RecetaInput } from "@/app/_data/recetas";
import { fetchRecetasAsignadas, saveRecetasAsignadas, personalizeReceta, type MealKey } from "@/app/_data/recetas_guardadas";
import RecetaModal from "@/app/_components/recetas/RecetaModal";

const MEAL_TABS: { key: MealKey; label: string; emoji: string }[] = [
  { key: "desayuno",   label: "Desayuno",   emoji: "🌅" },
  { key: "colacion_1", label: "Colación 1", emoji: "🍎" },
  { key: "comida",     label: "Comida",     emoji: "🍽" },
  { key: "colacion_2", label: "Colación 2", emoji: "🥜" },
  { key: "cena",       label: "Cena",       emoji: "🌙" },
];

const emptyMeals = (): Record<MealKey, Receta[]> => ({
  desayuno: [], colacion_1: [], comida: [], colacion_2: [], cena: [],
});

export default function RecetasAsignadasForm({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [catalogo, setCatalogo] = useState<Receta[]>([]);
  const [asignadas, setAsignadas] = useState<Record<MealKey, Receta[]>>(emptyMeals);
  const [activeTab, setActiveTab] = useState<MealKey>("desayuno");
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [editingReceta, setEditingReceta] = useState<{ receta: Receta; meal: MealKey } | null>(null);

  const loadData = () => {
    Promise.all([fetchRecetas(), fetchRecetasAsignadas(userId)])
      .then(([todas, guardadas]) => {
        setCatalogo(todas);
        const byMeal = emptyMeals();
        guardadas.forEach((r) => {
          const key = (r.tiempo_comida ?? "desayuno") as MealKey;
          byMeal[key] = [...byMeal[key], r];
        });
        setAsignadas(byMeal);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las recetas."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const load = () => { setLoading(true); setError(null); loadData(); };

  const allAsignadas = Object.values(asignadas).flat();
  const assignedBaseIds = new Set(
    allAsignadas.map((r) => r.receta_base_id).filter(Boolean) as string[]
  );
  const asignadasIds = new Set(allAsignadas.map((r) => r.id));

  const addReceta = (recetaId: string) => {
    if (asignadasIds.has(recetaId)) return;
    const receta = catalogo.find((r) => r.id === recetaId);
    if (receta) {
      setAsignadas((prev) => ({
        ...prev,
        [activeTab]: [...prev[activeTab], receta],
      }));
    }
  };

  const removeReceta = (recetaId: string, meal: MealKey) => {
    setAsignadas((prev) => ({
      ...prev,
      [meal]: prev[meal].filter((r) => r.id !== recetaId),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const flat = MEAL_TABS.flatMap(({ key }) =>
        asignadas[key].map((r) => ({ receta_id: r.id, tiempo_comida: key }))
      );
      await saveRecetasAsignadas(userId, flat);
      setFeedback({ type: "success", text: "Recetas guardadas correctamente." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudieron guardar las recetas." });
    } finally {
      setSaving(false);
    }
  };

  const handleCustomSave = async (input: RecetaInput): Promise<Receta> => {
    const { receta: current, meal } = editingReceta!;
    const saved = await personalizeReceta(userId, current.id, input);
    setAsignadas((prev) => ({
      ...prev,
      [meal]: prev[meal].map((r) => (r.id === current.id || r.id === saved.id) ? saved : r),
    }));
    setEditingReceta(null);
    return saved;
  };

  const catalogoDisponible = catalogo.filter((r) => {
    if (asignadasIds.has(r.id)) return false;
    if (assignedBaseIds.has(r.id)) return false;
    if (!search) return true;
    return r.nombre.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Cargando recetas...</p>;
  if (error) return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Reintentar</button>
    </div>
  );

  const activeTabInfo = MEAL_TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold text-gray-900">Asignar recetas</p>
        <p className="text-sm text-gray-500">Selecciona el tiempo de comida y asigna recetas del catálogo.</p>
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

        {/* ── Asignadas con tabs (derecha) ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-600">
            Recetas asignadas ({allAsignadas.length})
          </p>

          {/* Meal tabs */}
          <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
            {MEAL_TABS.map((tab) => {
              const count = asignadas[tab.key].length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-1.5 px-0.5 text-[11px] font-semibold rounded-lg transition-colors leading-tight ${
                    activeTab === tab.key
                      ? "bg-white text-primary shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span className="block text-base">{tab.emoji}</span>
                  <span className="block truncate">{tab.label}</span>
                  {count > 0 && (
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${
                      activeTab === tab.key ? "bg-primary text-white" : "bg-gray-300 text-gray-600"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Drop zone for active tab */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) addReceta(id);
              setDragOver(false);
            }}
            className={`flex-1 rounded-xl border-2 border-dashed p-3 flex flex-col gap-2 min-h-[15rem] overflow-y-auto transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-gray-200"
            }`}
          >
            {asignadas[activeTab].length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-1 py-6">
                <span className="text-3xl">{activeTabInfo.emoji}</span>
                <p className="text-xs text-center">Arrastra recetas para {activeTabInfo.label}</p>
              </div>
            )}
            {asignadas[activeTab].map((r) => (
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
                  onClick={() => setEditingReceta({ receta: r, meal: activeTab })}
                  className="text-gray-400 hover:text-primary text-sm px-1"
                  title="Editar receta para este usuario"
                >
                  ✏
                </button>
                <button onClick={() => removeReceta(r.id, activeTab)} className="text-gray-400 hover:text-red-500 text-sm">✕</button>
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
          receta={editingReceta.receta}
          onClose={() => setEditingReceta(null)}
          onSave={(saved) => {
            setAsignadas((prev) => ({
              ...prev,
              [editingReceta.meal]: prev[editingReceta.meal].map((r) => (r.id === saved.id ? saved : r)),
            }));
            setEditingReceta(null);
          }}
          customSave={handleCustomSave}
        />
      )}
    </div>
  );
}
