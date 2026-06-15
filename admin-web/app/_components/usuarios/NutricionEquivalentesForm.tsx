"use client";
import { useEffect, useState } from "react";
import {
  FOOD_GROUPS,
  MEAL_KEYS,
  MEAL_LABELS,
  fetchEquivalentes,
  saveEquivalentes,
  type EquivalenteInput,
} from "@/app/_data/nutricion";

const buildEmptyRows = (): EquivalenteInput[] =>
  FOOD_GROUPS.map((fg) => ({
    icono: fg.icono,
    grupo: fg.grupo,
    desayuno: 0,
    colacion_1: 0,
    comida: 0,
    colacion_2: 0,
    cena: 0,
  }));

export default function NutricionEquivalentesForm({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [planId, setPlanId] = useState<string | null>(null);
  const [rows, setRows] = useState<EquivalenteInput[]>(buildEmptyRows);

  const loadEquivalentes = () => {
    fetchEquivalentes(userId)
      .then(({ planId, equivalentes }) => {
        setPlanId(planId);
        setRows(
          FOOD_GROUPS.map((fg) => {
            const existing = equivalentes.find((e) => e.grupo === fg.grupo);
            return existing
              ? {
                  icono: fg.icono,
                  grupo: fg.grupo,
                  desayuno: existing.desayuno,
                  colacion_1: existing.colacion_1,
                  comida: existing.comida,
                  colacion_2: existing.colacion_2,
                  cena: existing.cena,
                }
              : { icono: fg.icono, grupo: fg.grupo, desayuno: 0, colacion_1: 0, comida: 0, colacion_2: 0, cena: 0 };
          })
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar la tabla de equivalentes."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEquivalentes();
  }, []);

  const load = () => {
    setLoading(true);
    setError(null);
    loadEquivalentes();
  };

  const updateMeal = (gi: number, mealKey: (typeof MEAL_KEYS)[number], value: string) => {
    const v = Math.max(0, parseInt(value) || 0);
    setRows((prev) => prev.map((r, i) => (i === gi ? { ...r, [mealKey]: v } : r)));
  };

  const handleSave = async () => {
    if (!planId) return;
    setSaving(true);
    setFeedback(null);
    try {
      await saveEquivalentes(planId, rows);
      setFeedback({ type: "success", text: "Equivalentes guardados correctamente." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudieron guardar los equivalentes." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-10">Cargando equivalentes...</p>;
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
    <div className="space-y-6">
      <div>
        <p className="font-semibold text-gray-900">Tabla de equivalentes</p>
        <p className="text-sm text-gray-500">Define cuántos equivalentes de cada grupo corresponden a cada tiempo de comida.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary/5">
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Grupo</th>
              {MEAL_LABELS.map((m) => (
                <th key={m} className="px-2 py-2 text-xs font-semibold text-primary text-center">{m}</th>
              ))}
              <th className="px-2 py-2 text-xs font-semibold text-gray-600 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, gi) => {
              const total = MEAL_KEYS.reduce((acc, key) => acc + row[key], 0);
              return (
                <tr key={row.grupo} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{row.icono}</span>
                      <span className="text-gray-700 text-xs font-medium">{row.grupo}</span>
                    </div>
                  </td>
                  {MEAL_KEYS.map((key) => (
                    <td key={key} className="px-1 py-1.5">
                      <input type="number" min={0} value={row[key]}
                        onChange={(e) => updateMeal(gi, key, e.target.value)}
                        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary mx-auto block" />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">{total}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          {saving ? "Guardando..." : "💾 Guardar equivalentes"}
        </button>
      </div>
    </div>
  );
}
