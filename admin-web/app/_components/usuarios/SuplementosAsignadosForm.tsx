"use client";
import { useEffect, useState } from "react";
import { fetchSuplementos, type Suplemento } from "@/app/_data/suplementos";
import {
  fetchPlanSuplementacion,
  savePlanSuplementacion,
  type PlanSuplementoInput,
} from "@/app/_data/plan_suplementacion";

type AsignadoRow = {
  suplemento: Suplemento;
  dosis: string;
  hora: string;
  momento: string;
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

  const loadData = () => {
    Promise.all([fetchSuplementos(), fetchPlanSuplementacion(userId)])
      .then(([todos, plan]) => {
        setCatalogo(todos);
        setAsignados(
          plan.map((p) => ({
            suplemento: p.suplementos,
            dosis: p.dosis ?? "",
            hora: p.hora ?? "",
            momento: p.momento ?? "",
          }))
        );
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

  const asignadosIds = new Set(asignados.map((a) => a.suplemento.id));

  const addSuplemento = (suplementoId: string) => {
    if (asignadosIds.has(suplementoId)) return;
    const sup = catalogo.find((s) => s.id === suplementoId);
    if (sup) setAsignados((prev) => [...prev, { suplemento: sup, dosis: "", hora: "", momento: "" }]);
  };

  const removeSuplemento = (suplementoId: string) => {
    setAsignados((prev) => prev.filter((a) => a.suplemento.id !== suplementoId));
  };

  const updateRow = (suplementoId: string, field: "dosis" | "hora" | "momento", value: string) => {
    setAsignados((prev) =>
      prev.map((a) => (a.suplemento.id === suplementoId ? { ...a, [field]: value } : a))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const items: PlanSuplementoInput[] = asignados.map((a) => ({
        suplemento_id: a.suplemento.id,
        dosis: a.dosis.trim() || null,
        hora: a.hora || null,
        momento: a.momento || null,
      }));
      await savePlanSuplementacion(userId, items);
      setFeedback({ type: "success", text: "Suplementación guardada correctamente." });
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
    return <p className="text-sm text-gray-400 text-center py-10">Cargando suplementos...</p>;
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
        <p className="font-semibold text-gray-900">Asignar suplementos</p>
        <p className="text-sm text-gray-500">Arrastra o haz clic en los suplementos del catálogo para asignarlos con dosis y horario.</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* ── Catálogo (izquierda) ── */}
        <div className="col-span-2 flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-600">Catálogo de suplementos</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-9">
            <span className="text-gray-400 text-sm">🔍</span>
            <input placeholder="Buscar suplemento..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700" />
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[24rem] pr-1">
            {catalogoDisponible.map((s) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
                onClick={() => addSuplemento(s.id)}
                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                title="Arrastra o haz clic para asignar"
              >
                <span className="text-xl">💊</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{s.nombre}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {s.marca && <span>{s.marca}</span>}
                    {s.gramaje && <span>· {s.gramaje}</span>}
                  </div>
                </div>
                <span className="text-gray-300 text-lg">+</span>
              </div>
            ))}
            {catalogoDisponible.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">
                {catalogo.length === 0 ? "No hay suplementos en el catálogo." : "No se encontraron suplementos."}
              </p>
            )}
          </div>
        </div>

        {/* ── Asignados (derecha, drop zone) ── */}
        <div className="col-span-3 flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-600">
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
              dragOver ? "border-primary bg-primary/5" : "border-gray-200"
            }`}
          >
            {asignados.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-1">
                <span className="text-3xl">💊</span>
                <p className="text-sm text-center">Arrastra suplementos aquí para asignarlos</p>
              </div>
            )}
            {asignados.map((a) => (
              <div key={a.suplemento.id} className="bg-white border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">💊</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{a.suplemento.nombre}</p>
                    {a.suplemento.marca && <p className="text-xs text-gray-400">{a.suplemento.marca} {a.suplemento.gramaje && `· ${a.suplemento.gramaje}`}</p>}
                  </div>
                  <button onClick={() => removeSuplemento(a.suplemento.id)} className="text-gray-400 hover:text-red-500 text-sm">✕</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Dosis</label>
                    <input value={a.dosis} onChange={(e) => updateRow(a.suplemento.id, "dosis", e.target.value)}
                      placeholder="Ej. 1 medida (30g)"
                      className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Hora</label>
                    <input type="time" value={a.hora} onChange={(e) => updateRow(a.suplemento.id, "hora", e.target.value)}
                      className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Momento</label>
                    <select value={a.momento} onChange={(e) => updateRow(a.suplemento.id, "momento", e.target.value)}
                      className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs bg-white focus:outline-none focus:border-primary">
                      <option value="">Seleccionar...</option>
                      {MOMENTOS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
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
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
          {saving ? "Guardando..." : "💾 Guardar suplementación"}
        </button>
      </div>
    </div>
  );
}
