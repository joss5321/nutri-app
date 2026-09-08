"use client";
import { useEffect, useState } from "react";
import { fetchSuplementos, type Suplemento } from "@/app/_data/suplementos";
import {
  fetchPlanSuplementacion,
  savePlanSuplementacion,
  type PlanSuplementoInput,
} from "@/app/_data/plan_suplementacion";
import { StickyNote, Search, Pill, X, Save } from "lucide-react";

type AsignadoRow = {
  suplemento: Suplemento;
  dosis: string;
  hora: string;
  momento: string;
  notas: string;
};

const MOMENTOS = ["Con el desayuno", "Post entrenamiento", "Durante entrenamiento", "Con la comida", "Antes de dormir"];

export default function SuplementosAsignadosForm({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [catalogo, setCatalogo] = useState<Suplemento[]>([]);
  const [asignados, setAsignados] = useState<AsignadoRow[]>([]);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const DRAFT_KEY = `suplementos_draft_${userId}`;

  const asignadosAInput = (rows: AsignadoRow[]): PlanSuplementoInput[] =>
    rows.map((a) => ({
      suplemento_id: a.suplemento.id,
      dosis: a.dosis.trim() || null,
      hora: a.hora || null,
      momento: a.momento || null,
      notas: a.notas.trim() || null,
    }));

  const loadData = () => {
    Promise.all([fetchSuplementos(), fetchPlanSuplementacion(userId)])
      .then(([todos, plan]) => {
        setCatalogo(todos);
        const loaded: AsignadoRow[] = plan.map((p) => ({
          suplemento: p.suplementos,
          dosis: p.dosis ?? "",
          hora: p.hora ?? "",
          momento: p.momento ?? "",
          notas: p.notas ?? "",
        }));
        setAsignados(loaded);

        // ── Restaurar borrador sin guardar, si existe y difiere de lo cargado ──
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          if (raw) {
            const d = JSON.parse(raw) as PlanSuplementoInput[];
            const differs = JSON.stringify(d) !== JSON.stringify(asignadosAInput(loaded));
            if (differs) {
              const byId = new Map(todos.map((s) => [s.id, s]));
              const restored = d
                .map((item) => {
                  const sup = byId.get(item.suplemento_id);
                  if (!sup) return null;
                  return {
                    suplemento: sup,
                    dosis: item.dosis ?? "",
                    hora: item.hora ?? "",
                    momento: item.momento ?? "",
                    notas: item.notas ?? "",
                  };
                })
                .filter(Boolean) as AsignadoRow[];
              setAsignados(restored);
              setHasDraft(true);
            }
          }
        } catch {}
        setReady(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los suplementos."))
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

  // Auto-guardar borrador en cada cambio de la lista
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(asignadosAInput(asignados))); } catch {}
  // DRAFT_KEY es estable durante el ciclo de vida del componente (mismo userId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, asignados]);

  const asignadosIds = new Set(asignados.map((a) => a.suplemento.id));

  const addSuplemento = (suplementoId: string) => {
    if (asignadosIds.has(suplementoId)) return;
    const sup = catalogo.find((s) => s.id === suplementoId);
    if (sup) setAsignados((prev) => [...prev, { suplemento: sup, dosis: "", hora: "", momento: "", notas: "" }]);
  };

  const removeSuplemento = (suplementoId: string) => {
    setAsignados((prev) => prev.filter((a) => a.suplemento.id !== suplementoId));
  };

  const updateRow = (suplementoId: string, field: "dosis" | "hora" | "momento" | "notas", value: string) => {
    setAsignados((prev) =>
      prev.map((a) => (a.suplemento.id === suplementoId ? { ...a, [field]: value } : a))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const items = asignadosAInput(asignados);
      await savePlanSuplementacion(userId, items);
      setFeedback({ type: "success", text: "Suplementación guardada correctamente." });
      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  };

  const catalogoDisponible = catalogo.filter((s) => {
    if (asignadosIds.has(s.id)) return false;
    if (!search) return true;
    return s.nombre.toLowerCase().includes(search.toLowerCase()) || (s.marca ?? "").toLowerCase().includes(search.toLowerCase());
  });

  if (loading) {
    return <p className="text-sm text-muted text-center py-10">Cargando suplementos...</p>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <p className="text-sm text-error">{error}</p>
        <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Reintentar</button>
      </div>
    );
  }

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
        <p className="font-semibold text-text-primary">Asignar suplementos</p>
        <p className="text-sm text-secondary">Arrastra o haz clic en los suplementos del catálogo para asignarlos con dosis y horario.</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* ── Catálogo (izquierda) ── */}
        <div className="col-span-2 flex flex-col gap-3">
          <p className="text-xs font-bold text-secondary">Catálogo de suplementos</p>
          <div className="flex items-center gap-2 bg-background-secondary border border-border rounded-xl px-3 h-9">
            <Search size={14} className="text-muted shrink-0" />
            <input placeholder="Buscar suplemento..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent focus:outline-none text-text-primary" />
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[24rem] pr-1">
            {catalogoDisponible.map((s) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
                onClick={() => addSuplemento(s.id)}
                className="flex items-center gap-2 bg-background-secondary border border-border rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                title="Arrastra o haz clic para asignar"
              >
                <Pill size={20} className="text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{s.nombre}</p>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    {s.marca && <span>{s.marca}</span>}
                    {s.gramaje && <span>· {s.gramaje}</span>}
                  </div>
                </div>
                <span className="text-muted text-lg">+</span>
              </div>
            ))}
            {catalogoDisponible.length === 0 && (
              <p className="text-xs text-muted text-center py-4">
                {catalogo.length === 0 ? "No hay suplementos en el catálogo." : "No se encontraron suplementos."}
              </p>
            )}
          </div>
        </div>

        {/* ── Asignados (derecha, drop zone) ── */}
        <div className="col-span-3 flex flex-col gap-3">
          <p className="text-xs font-bold text-secondary">
            Suplementos asignados ({asignados.length})
          </p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) addSuplemento(id);
              setDragOver(false);
            }}
            className={`flex-1 rounded-xl border-2 border-dashed p-3 flex flex-col gap-3 min-h-[24rem] overflow-y-auto transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            {asignados.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-muted gap-1">
                <div className="w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center mb-1">
                  <Pill size={26} className="text-primary" />
                </div>
                <p className="text-sm text-center">Arrastra suplementos aquí para asignarlos</p>
              </div>
            )}
            {asignados.map((a) => (
              <div key={a.suplemento.id} className="bg-white border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Pill size={20} className="text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary truncate">{a.suplemento.nombre}</p>
                    {a.suplemento.marca && <p className="text-xs text-muted">{a.suplemento.marca} {a.suplemento.gramaje && `· ${a.suplemento.gramaje}`}</p>}
                  </div>
                  <button onClick={() => removeSuplemento(a.suplemento.id)} className="text-muted hover:text-error"><X size={15} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted block mb-0.5">Dosis</label>
                    <input value={a.dosis} onChange={(e) => updateRow(a.suplemento.id, "dosis", e.target.value)}
                      placeholder="Ej. 1 medida (30g)"
                      className="w-full h-8 border border-border rounded-lg px-2 text-xs focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-0.5">Hora</label>
                    <input type="time" value={a.hora} onChange={(e) => updateRow(a.suplemento.id, "hora", e.target.value)}
                      className="w-full h-8 border border-border rounded-lg px-2 text-xs focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-0.5">Momento</label>
                    <select value={a.momento} onChange={(e) => updateRow(a.suplemento.id, "momento", e.target.value)}
                      className="w-full h-8 border border-border rounded-lg px-2 text-xs bg-white focus:outline-none focus:border-primary">
                      <option value="">Seleccionar...</option>
                      {MOMENTOS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-[10px] text-muted block mb-0.5">Notas</label>
                  <input value={a.notas} onChange={(e) => updateRow(a.suplemento.id, "notas", e.target.value)}
                    placeholder="Ej. Tomar con agua fría, evitar con cafeína..."
                    className="w-full h-8 border border-border rounded-lg px-2 text-xs focus:outline-none focus:border-primary" />
                </div>
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
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
          {!saving && <Save size={15} />}
          {saving ? "Guardando..." : "Guardar suplementación"}
        </button>
      </div>
    </div>
  );
}
