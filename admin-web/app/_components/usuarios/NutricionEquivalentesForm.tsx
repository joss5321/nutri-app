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

// Valores nutricionales por equivalente — Sistema Mexicano de Alimentos Equivalentes (SMAE)
const NUTRICION_POR_EQUIV: Record<string, { hco: number; prot: number; lip: number; kcal: number }> = {
  "Cereales sin grasa":  { hco: 15, prot: 2, lip: 0, kcal: 70 },
  "Frutas":              { hco: 15, prot: 0, lip: 0, kcal: 60 },
  "Verduras":            { hco: 4,  prot: 2, lip: 0, kcal: 25 },
  "Leche descremada":    { hco: 12, prot: 8, lip: 2, kcal: 95 },
  "POA muy bajo aporte": { hco: 0,  prot: 7, lip: 1, kcal: 40 },
  "POA bajo aporte":     { hco: 0,  prot: 7, lip: 3, kcal: 55 },
  "POA medio aporte":    { hco: 0,  prot: 7, lip: 5, kcal: 75 },
  "Aceites y grasas":    { hco: 0,  prot: 0, lip: 5, kcal: 45 },
  "AC y C c/Proteína":   { hco: 20, prot: 8, lip: 1, kcal: 120 },
};

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

  // Totales generales
  let totalRaciones = 0, totalHCO = 0, totalProt = 0, totalLip = 0, totalKcal = 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-semibold text-gray-900">Tabla de equivalentes</p>
        <p className="text-sm text-gray-500">Define cuántos equivalentes de cada grupo corresponden a cada tiempo de comida. Los valores nutricionales se calculan según el SMAE.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary/5">
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Grupo</th>
              {MEAL_LABELS.map((m) => (
                <th key={m} className="px-2 py-2 text-xs font-semibold text-primary text-center">{m}</th>
              ))}
              <th className="px-2 py-2 text-xs font-semibold text-gray-600 text-center"># Raciones</th>
              <th className="px-2 py-2 text-xs font-semibold text-amber-600 text-center">HCO (g)</th>
              <th className="px-2 py-2 text-xs font-semibold text-red-600 text-center">Prot (g)</th>
              <th className="px-2 py-2 text-xs font-semibold text-purple-600 text-center">Líp (g)</th>
              <th className="px-2 py-2 text-xs font-semibold text-green-700 text-center">Kcal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, gi) => {
              const raciones = MEAL_KEYS.reduce((acc, key) => acc + row[key], 0);
              const nutri = NUTRICION_POR_EQUIV[row.grupo] ?? { hco: 0, prot: 0, lip: 0, kcal: 0 };
              const hco = raciones * nutri.hco;
              const prot = raciones * nutri.prot;
              const lip = raciones * nutri.lip;
              const kcal = raciones * nutri.kcal;

              totalRaciones += raciones;
              totalHCO += hco;
              totalProt += prot;
              totalLip += lip;
              totalKcal += kcal;

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
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">{raciones}</span>
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs text-amber-700 font-medium">{hco.toFixed(0)}</td>
                  <td className="px-2 py-1.5 text-center text-xs text-red-600 font-medium">{prot.toFixed(0)}</td>
                  <td className="px-2 py-1.5 text-center text-xs text-purple-600 font-medium">{lip.toFixed(0)}</td>
                  <td className="px-2 py-1.5 text-center text-xs text-green-700 font-bold">{kcal.toFixed(0)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
              <td className="px-3 py-2.5 text-xs text-gray-700" colSpan={MEAL_KEYS.length + 1}>TOTAL</td>
              <td className="px-2 py-2.5 text-center">
                <span className="text-sm font-extrabold bg-primary text-white px-3 py-1 rounded-full">{totalRaciones}</span>
              </td>
              <td className="px-2 py-2.5 text-center text-xs text-amber-700">{totalHCO.toFixed(0)}</td>
              <td className="px-2 py-2.5 text-center text-xs text-red-600">{totalProt.toFixed(0)}</td>
              <td className="px-2 py-2.5 text-center text-xs text-purple-600">{totalLip.toFixed(0)}</td>
              <td className="px-2 py-2.5 text-center text-sm text-green-700 font-extrabold">{totalKcal.toFixed(0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Resumen de macros */}
      {totalKcal > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-center">
            <p className="text-xs text-amber-600 font-medium">HCO</p>
            <p className="text-xl font-extrabold text-amber-700">{totalHCO.toFixed(0)}g</p>
            <p className="text-xs text-amber-500">{((totalHCO * 4 / totalKcal) * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 border border-red-200 text-center">
            <p className="text-xs text-red-600 font-medium">Proteína</p>
            <p className="text-xl font-extrabold text-red-700">{totalProt.toFixed(0)}g</p>
            <p className="text-xs text-red-500">{((totalProt * 4 / totalKcal) * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 border border-purple-200 text-center">
            <p className="text-xs text-purple-600 font-medium">Lípidos</p>
            <p className="text-xl font-extrabold text-purple-700">{totalLip.toFixed(0)}g</p>
            <p className="text-xs text-purple-500">{((totalLip * 9 / totalKcal) * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 border border-green-200 text-center">
            <p className="text-xs text-green-600 font-medium">Total</p>
            <p className="text-xl font-extrabold text-green-700">{totalKcal.toFixed(0)}</p>
            <p className="text-xs text-green-500">kcal</p>
          </div>
        </div>
      )}

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
