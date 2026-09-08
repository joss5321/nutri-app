"use client";
import { useEffect, useState } from "react";
import { fetchRecetas, type Receta, type RecetaInput } from "@/app/_data/recetas";
import { fetchRecetasAsignadas, saveRecetasAsignadas, personalizeReceta, type MealKey } from "@/app/_data/recetas_guardadas";
import RecetaModal from "@/app/_components/recetas/RecetaModal";
import { StickyNote, Search, Flame, BarChart3, Pencil, X, Save, Sunrise, Apple, UtensilsCrossed, Cookie, Moon } from "lucide-react";

type LucideIcon = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

const MEAL_TABS: { key: MealKey; label: string; Icon: LucideIcon }[] = [
  { key: "desayuno",   label: "Desayuno",   Icon: Sunrise },
  { key: "colacion_1", label: "Colación 1", Icon: Apple },
  { key: "comida",     label: "Comida",     Icon: UtensilsCrossed },
  { key: "colacion_2", label: "Colación 2", Icon: Cookie },
  { key: "cena",       label: "Cena",       Icon: Moon },
];

const emptyMeals = (): Record<MealKey, Receta[]> => ({
  desayuno: [], colacion_1: [], comida: [], colacion_2: [], cena: [],
});

// Mapea cada tiempo de comida al "tipo" de receta correspondiente en el
// catálogo (recetas.tipo). Ambas colaciones comparten el mismo tipo
// "Colación" — el catálogo no distingue colación 1 de colación 2.
const MEAL_TO_TIPO: Record<MealKey, string> = {
  desayuno: "Desayuno",
  colacion_1: "Colación",
  comida: "Comida",
  colacion_2: "Colación",
  cena: "Cena",
};

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
  const [ready, setReady] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const DRAFT_KEY = `recetas_draft_${userId}`;

  const asignadasAIds = (m: Record<MealKey, Receta[]>): Record<MealKey, string[]> =>
    Object.fromEntries(MEAL_TABS.map(({ key }) => [key, m[key].map((r) => r.id)])) as Record<MealKey, string[]>;

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

        // ── Restaurar borrador sin guardar, si existe y difiere de lo cargado ──
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          if (raw) {
            const d = JSON.parse(raw) as Record<MealKey, string[]>;
            const loadedIds = asignadasAIds(byMeal);
            const differs = MEAL_TABS.some(({ key }) =>
              JSON.stringify(d[key] ?? []) !== JSON.stringify(loadedIds[key])
            );
            if (differs) {
              // El catálogo y lo ya asignado cubren cualquier receta (incluidas personalizadas)
              const pool = [...todas, ...guardadas];
              const byId = new Map(pool.map((r) => [r.id, r]));
              const restored = emptyMeals();
              MEAL_TABS.forEach(({ key }) => {
                restored[key] = (d[key] ?? []).map((id) => byId.get(id)).filter(Boolean) as Receta[];
              });
              setAsignadas(restored);
              setHasDraft(true);
            }
          }
        } catch {}
        setReady(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las recetas."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const load = () => { setLoading(true); setError(null); loadData(); };

  // Auto-guardar borrador (solo ids por tiempo de comida) en cada cambio
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(asignadasAIds(asignadas))); } catch {}
  // DRAFT_KEY es estable durante el ciclo de vida del componente (mismo userId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, asignadas]);

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
      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
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
    if (r.tipo !== MEAL_TO_TIPO[activeTab]) return false;
    if (!search) return true;
    return r.nombre.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <p className="text-sm text-muted text-center py-10">Cargando recetas...</p>;
  if (error) return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <p className="text-sm text-error">{error}</p>
      <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Reintentar</button>
    </div>
  );

  const activeTabInfo = MEAL_TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="space-y-4">
      {hasDraft && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-warning-soft border border-warning/30 rounded-xl text-xs text-warning font-medium">
          <StickyNote size={14} className="shrink-0" />
          <span>Borrador restaurado — tienes cambios sin guardar en este formulario.</span>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(DRAFT_KEY);
              setHasDraft(false);
              setReady(false);
              load();
            }}
            className="ml-auto shrink-0 text-warning hover:opacity-70 underline font-semibold">
            Descartar cambios
          </button>
        </div>
      )}
      <div>
        <p className="font-semibold text-text-primary">Asignar recetas</p>
        <p className="text-sm text-secondary">Selecciona el tiempo de comida y asigna recetas del catálogo.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* ── Catálogo (izquierda) ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-secondary">Catálogo de recetas</p>
          <div className="flex items-center gap-2 bg-background-secondary border border-border rounded-xl px-3 h-9">
            <Search size={14} className="text-muted shrink-0" />
            <input
              placeholder="Buscar receta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent focus:outline-none text-text-primary"
            />
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[20rem] pr-1">
            {catalogoDisponible.map((r) => (
              <div
                key={r.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                onClick={() => addReceta(r.id)}
                className="flex items-center gap-2 bg-background-secondary border border-border rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                title="Arrastra o haz clic para asignar"
              >
                <span className="text-xl">{r.emoji || "🍽"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{r.nombre}</p>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    {r.tipo && <span>{r.tipo}</span>}
                    {r.calorias && <span className="inline-flex items-center gap-0.5"><Flame size={10} /> {r.calorias} kcal</span>}
                    {r.nivel && <span className="inline-flex items-center gap-0.5"><BarChart3 size={10} /> {r.nivel}</span>}
                  </div>
                </div>
                <span className="text-muted text-lg leading-none">+</span>
              </div>
            ))}
            {catalogoDisponible.length === 0 && (
              <p className="text-xs text-muted text-center py-4">
                {catalogo.length === 0 ? "No hay recetas en el catálogo." : "No se encontraron recetas."}
              </p>
            )}
          </div>
        </div>

        {/* ── Asignadas con tabs (derecha) ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-secondary">
            Recetas asignadas ({allAsignadas.length})
          </p>

          {/* Meal tabs */}
          <div className="flex gap-0.5 bg-surface-muted rounded-xl p-1">
            {MEAL_TABS.map((tab) => {
              const count = asignadas[tab.key].length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-1.5 px-0.5 text-[11px] font-semibold rounded-lg transition-colors leading-tight ${
                    activeTab === tab.key
                      ? "bg-white text-primary shadow-sm"
                      : "text-secondary hover:text-text-primary"
                  }`}
                >
                  <tab.Icon size={15} className="mx-auto mb-0.5" />
                  <span className="block truncate">{tab.label}</span>
                  {count > 0 && (
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${
                      activeTab === tab.key ? "bg-primary text-white" : "bg-surface-muted text-secondary"
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
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            {asignadas[activeTab].length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-muted gap-1 py-6">
                <activeTabInfo.Icon size={26} />
                <p className="text-xs text-center">Arrastra recetas para {activeTabInfo.label}</p>
              </div>
            )}
            {asignadas[activeTab].map((r) => (
              <div key={r.id} className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2">
                <span className="text-xl">{r.emoji || "🍽"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary truncate">{r.nombre}</p>
                    {r.user_id !== null && (
                      <span className="shrink-0 text-[10px] font-semibold bg-brand-soft text-primary px-1.5 py-0.5 rounded-full">
                        Personalizada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    {r.tipo && <span>{r.tipo}</span>}
                    {r.calorias && <span className="inline-flex items-center gap-0.5"><Flame size={10} /> {r.calorias} kcal</span>}
                  </div>
                </div>
                <button
                  onClick={() => setEditingReceta({ receta: r, meal: activeTab })}
                  className="text-muted hover:text-primary px-1"
                  title="Editar receta para este usuario"
                >
                  <Pencil size={14} />
                </button>
                <button onClick={() => removeReceta(r.id, activeTab)} className="text-muted hover:text-error"><X size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-divider">
        {feedback && (
          <span className={`text-xs font-medium ${feedback.type === "success" ? "text-success" : "text-error"}`}>
            {feedback.text}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
        >
          {!saving && <Save size={15} />}
          {saving ? "Guardando..." : "Guardar recetas"}
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
          userId={userId}
          mealKey={editingReceta.meal}
        />
      )}
    </div>
  );
}
