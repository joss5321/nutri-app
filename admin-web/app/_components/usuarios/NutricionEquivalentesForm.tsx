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
import { fetchDietocalculo, type Dietocalculo } from "@/app/_data/dietocalculo";

// Valores nutricionales por equivalente — SMAE
const NUTRICION_POR_EQUIV: Record<string, { hco: number; prot: number; lip: number; kcal: number }> = {
  "Cereales sin grasa":  { hco: 15, prot: 2, lip: 0, kcal: 70 },
  "Cereales con grasa":  { hco: 15, prot: 2, lip: 5, kcal: 115 },
  "Frutas":              { hco: 15, prot: 0, lip: 0, kcal: 60 },
  "Verduras":            { hco: 4,  prot: 2, lip: 0, kcal: 25 },
  "Leche descremada":    { hco: 12, prot: 9, lip: 2, kcal: 95 },
  "Leguminosas":         { hco: 20, prot: 8, lip: 1, kcal: 120 },
  "POA muy bajo aporte": { hco: 0,  prot: 7, lip: 1, kcal: 40 },
  "POA bajo aporte":     { hco: 0,  prot: 7, lip: 3, kcal: 55 },
  "POA medio aporte":    { hco: 0,  prot: 7, lip: 5, kcal: 75 },
  "POA alto aporte":     { hco: 0,  prot: 7, lip: 8, kcal: 100 },
  "Aceites y grasas":    { hco: 0,  prot: 0, lip: 5, kcal: 45 },
  "AC y G c/Proteína":   { hco: 3,  prot: 3, lip: 5, kcal: 70 },
  "Azúcares sin grasa":  { hco: 10, prot: 0, lip: 0, kcal: 40 },
  "Azúcares con grasa":  { hco: 10, prot: 0, lip: 5, kcal: 85 },
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

const buildRacList = (rows: EquivalenteInput[]) =>
  rows.map((r) => MEAL_KEYS.reduce((acc, k) => acc + r[k], 0));

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Distribuye `total` raciones entre 5 tiempos de comida con pesos aleatorios, sumando exactamente total
function distribuirEnComidas(total: number): [number, number, number, number, number] {
  if (total === 0) return [0, 0, 0, 0, 0];
  // Pesos base [desayuno, col1, comida, col2, cena] con variación aleatoria
  const w = [
    0.20 + Math.random() * 0.10,
    0.05 + Math.random() * 0.08,
    0.35 + Math.random() * 0.10,
    0.05 + Math.random() * 0.08,
    0.10 + Math.random() * 0.10,
  ];
  const sum = w.reduce((a, b) => a + b, 0);
  const norm = w.map((x) => x / sum);
  const floors = norm.map((x) => Math.floor(x * total));
  let rem = total - floors.reduce((a, b) => a + b, 0);
  // Distribuir sobrante a los de mayor parte decimal
  const order = norm
    .map((x, i) => ({ i, frac: x * total - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < rem; k++) floors[order[k].i]++;
  return floors as [number, number, number, number, number];
}

// Genera raciones por grupo cuya Kcal SMAE total ≈ get_ajustado del dietocálculo
function generarSugerencia(
  targetHCO: number,
  targetProt: number,
  targetLip: number,
  getAjustado: number,
): { racList: number[]; rows: EquivalenteInput[] } {
  const racMap: Record<string, number> = {};
  FOOD_GROUPS.forEach((g) => { racMap[g.grupo] = 0; });

  // Paso 1: Grupos base siempre presentes
  racMap["Verduras"]         = randInt(2, 4);
  racMap["Frutas"]           = randInt(2, 3);
  racMap["Leche descremada"] = randInt(1, 2);

  // Paso 2: Restar contribución de grupos base
  let remHCO = targetHCO;
  let remProt = targetProt;
  let remLip  = targetLip;
  FOOD_GROUPS.forEach((g) => {
    const r = racMap[g.grupo];
    if (r > 0) {
      const n = NUTRICION_POR_EQUIV[g.grupo] ?? { hco: 0, prot: 0, lip: 0, kcal: 0 };
      remHCO -= r * n.hco;
      remProt -= r * n.prot;
      remLip  -= r * n.lip;
    }
  });

  // Paso 3: Proteína con POA (tipo aleatorio)
  const poaOpciones = ["POA muy bajo aporte", "POA bajo aporte", "POA medio aporte"];
  const poaElegido  = poaOpciones[randInt(0, poaOpciones.length - 1)];
  const poaNutri    = NUTRICION_POR_EQUIV[poaElegido];
  const poaRac      = Math.max(0, Math.round(Math.max(0, remProt) / poaNutri.prot));
  racMap[poaElegido] = poaRac;
  remHCO -= poaRac * poaNutri.hco;
  remProt -= poaRac * poaNutri.prot;
  remLip  -= poaRac * poaNutri.lip;

  // Paso 4: Grasa con Aceites y grasas
  const aceiteRac = Math.max(0, Math.round(Math.max(0, remLip) / 5));
  racMap["Aceites y grasas"] = aceiteRac;

  // Paso 5: HCO restante con Cereales sin grasa
  const cerealRac = Math.max(0, Math.round(Math.max(0, remHCO) / 15));
  racMap["Cereales sin grasa"] = cerealRac;

  // Paso 6: Escalar todas las raciones para que Kcal SMAE total ≈ getAjustado
  let racListDraft = FOOD_GROUPS.map((g) => racMap[g.grupo] ?? 0);
  const totalSMAEKcal = FOOD_GROUPS.reduce((sum, g, i) => {
    const n = NUTRICION_POR_EQUIV[g.grupo] ?? { kcal: 0 };
    return sum + racListDraft[i] * n.kcal;
  }, 0);
  if (totalSMAEKcal > 0 && getAjustado > 0) {
    const scale = getAjustado / totalSMAEKcal;
    racListDraft = racListDraft.map((r) => Math.max(0, Math.round(r * scale)));
  }

  // Paso 7: Construir rows con distribución aleatoria en comidas (suma = raciones)
  const newRows: EquivalenteInput[] = FOOD_GROUPS.map((g, i) => {
    const rac = racListDraft[i];
    const [d, c1, com, c2, cen] = distribuirEnComidas(rac);
    return { icono: g.icono, grupo: g.grupo, desayuno: d, colacion_1: c1, comida: com, colacion_2: c2, cena: cen };
  });

  return { racList: racListDraft, rows: newRows };
}

export default function NutricionEquivalentesForm({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [rows, setRows] = useState<EquivalenteInput[]>(buildEmptyRows);
  // racList es independiente de los tiempos de comida — solo se valida al guardar
  const [racList, setRacList] = useState<number[]>(() => FOOD_GROUPS.map(() => 0));
  const [dietocalculo, setDietocalculo] = useState<Dietocalculo | null>(null);

  const loadData = () => {
    Promise.all([fetchEquivalentes(userId), fetchDietocalculo(userId)])
      .then(([{ planId: pid, equivalentes }, dc]) => {
        setPlanId(pid);
        setDietocalculo(dc);
        const loaded = FOOD_GROUPS.map((fg) => {
          const existing = equivalentes.find((e) => e.grupo === fg.grupo);
          return existing
            ? { icono: fg.icono, grupo: fg.grupo, desayuno: existing.desayuno, colacion_1: existing.colacion_1, comida: existing.comida, colacion_2: existing.colacion_2, cena: existing.cena }
            : { icono: fg.icono, grupo: fg.grupo, desayuno: 0, colacion_1: 0, comida: 0, colacion_2: 0, cena: 0 };
        });
        setRows(loaded);
        // Inicializar racList con la suma de comidas guardadas
        setRacList(buildRacList(loaded));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar la tabla de equivalentes."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const load = () => { setLoading(true); setError(null); loadData(); };

  // Tiempos de comida y raciones son independientes entre sí
  const updateMeal = (gi: number, mealKey: (typeof MEAL_KEYS)[number], value: string) => {
    const v = Math.max(0, parseInt(value) || 0);
    setRows((prev) => prev.map((r, i) => (i === gi ? { ...r, [mealKey]: v } : r)));
  };

  const updateRaciones = (gi: number, value: string) => {
    const v = Math.max(0, parseInt(value) || 0);
    setRacList((prev) => prev.map((r, i) => (i === gi ? v : r)));
  };

  const handleSugerir = () => {
    if (!dietocalculo?.get_ajustado) return;
    const { get_ajustado, carbs_pct, prote_pct, lipidos_pct } = dietocalculo;
    // Derivar gramos objetivo proporcionalmente al GET y los porcentajes del dietocálculo
    const targetHCO  = (get_ajustado * (carbs_pct   || 0) / 100) / 4;
    const targetProt = (get_ajustado * (prote_pct    || 0) / 100) / 4;
    const targetLip  = (get_ajustado * (lipidos_pct  || 0) / 100) / 9;
    const { racList: newRac, rows: newRows } = generarSugerencia(targetHCO, targetProt, targetLip, get_ajustado);
    setRacList(newRac);
    setRows(newRows);
    setFeedback(null);
  };

  const handleSave = async () => {
    if (!planId) return;

    // Validar que raciones coincida con la suma de tiempos de comida en cada fila con datos
    const mismatches: string[] = [];
    rows.forEach((row, i) => {
      const mealSum = MEAL_KEYS.reduce((acc, k) => acc + row[k], 0);
      const rac = racList[i];
      // Solo validar filas donde el usuario ingresó algo
      if ((rac > 0 || mealSum > 0) && rac !== mealSum) {
        mismatches.push(row.grupo);
      }
    });

    if (mismatches.length > 0) {
      setFeedback({
        type: "error",
        text: `Las raciones no coinciden con los tiempos de comida en: ${mismatches.join(", ")}`,
      });
      return;
    }

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

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Cargando equivalentes...</p>;

  if (error) return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Reintentar</button>
    </div>
  );

  // HCO/Prot/Líp/Kcal se calculan desde racList (columna # Raciones)
  let totalHCO = 0, totalProt = 0, totalLip = 0, totalKcal = 0;
  const mealTotals: Record<string, number> = { desayuno: 0, colacion_1: 0, comida: 0, colacion_2: 0, cena: 0 };

  const rowCalcs = rows.map((row, gi) => {
    const raciones = racList[gi];
    const nutri = NUTRICION_POR_EQUIV[row.grupo] ?? { hco: 0, prot: 0, lip: 0, kcal: 0 };
    const hco = raciones * nutri.hco;
    const prot = raciones * nutri.prot;
    const lip = raciones * nutri.lip;
    const kcal = raciones * nutri.kcal;
    totalHCO += hco;
    totalProt += prot;
    totalLip += lip;
    totalKcal += kcal;
    MEAL_KEYS.forEach((k) => { mealTotals[k] += row[k]; });
    return { raciones, hco, prot, lip, kcal };
  });

  const totalRacList = racList.reduce((a, b) => a + b, 0);

  // Porcentajes actuales basados en kcal de macros (no en kcal total de equivalentes)
  const totalMacroKcalActual = totalHCO * 4 + totalProt * 4 + totalLip * 9;
  const actualHCOPct = totalMacroKcalActual > 0 ? (totalHCO * 4 / totalMacroKcalActual) * 100 : 0;
  const actualProtPct = totalMacroKcalActual > 0 ? (totalProt * 4 / totalMacroKcalActual) * 100 : 0;
  const actualLipPct = totalMacroKcalActual > 0 ? (totalLip * 9 / totalMacroKcalActual) * 100 : 0;

  // Meta desde dietocálculo — gramos derivados de kcal almacenadas
  const targetCarbsG = dietocalculo ? dietocalculo.carbs_kcal / 4 : null;
  const targetProteG = dietocalculo ? dietocalculo.prote_kcal / 4 : null;
  const targetLipG   = dietocalculo ? dietocalculo.lipidos_kcal / 9 : null;
  const targetMacroKcal = dietocalculo
    ? dietocalculo.carbs_kcal + dietocalculo.prote_kcal + dietocalculo.lipidos_kcal
    : null;
  const targetHCOPct  = targetMacroKcal && targetMacroKcal > 0 ? (dietocalculo!.carbs_kcal   / targetMacroKcal) * 100 : null;
  const targetProtPct = targetMacroKcal && targetMacroKcal > 0 ? (dietocalculo!.prote_kcal   / targetMacroKcal) * 100 : null;
  const targetLipPct  = targetMacroKcal && targetMacroKcal > 0 ? (dietocalculo!.lipidos_kcal / targetMacroKcal) * 100 : null;
  const targetKcal = dietocalculo?.get_ajustado ?? null;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-semibold text-gray-900">Tabla de equivalentes</p>
        <p className="text-sm text-gray-500">
          Ingresa el total de raciones y distribúyelas en los tiempos de comida. Al guardar se validará que coincidan.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary/5">
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Grupo</th>
              <th className="px-2 py-2 text-xs font-semibold text-gray-800 text-center bg-primary/10"># Raciones</th>
              {MEAL_LABELS.map((m) => (
                <th key={m} className="px-2 py-2 text-xs font-semibold text-primary text-center">{m}</th>
              ))}
              <th className="px-2 py-2 text-xs font-semibold text-amber-600 text-center">HCO (g)</th>
              <th className="px-2 py-2 text-xs font-semibold text-red-600 text-center">Prot (g)</th>
              <th className="px-2 py-2 text-xs font-semibold text-purple-600 text-center">Líp (g)</th>
              <th className="px-2 py-2 text-xs font-semibold text-green-700 text-center">Kcal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, gi) => {
              const { raciones, hco, prot, lip, kcal } = rowCalcs[gi];
              const mealSum = raciones;
              const rac = racList[gi];
              const mismatch = (rac > 0 || mealSum > 0) && rac !== mealSum;
              return (
                <tr key={row.grupo} className={`border-t border-gray-100 ${mismatch ? "bg-red-50/40" : "hover:bg-gray-50/50"}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{row.icono}</span>
                      <span className="text-gray-700 text-xs font-medium whitespace-nowrap">{row.grupo}</span>
                    </div>
                  </td>
                  <td className="px-1 py-1.5 bg-primary/5">
                    <input
                      type="number" min={0} value={rac}
                      onChange={(e) => updateRaciones(gi, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className={`w-14 h-8 text-center border-2 rounded-lg text-xs font-bold focus:outline-none mx-auto block ${
                        mismatch
                          ? "border-red-400 text-red-600 bg-red-50"
                          : "border-primary/40 text-primary focus:border-primary"
                      }`}
                    />
                  </td>
                  {MEAL_KEYS.map((key) => (
                    <td key={key} className="px-1 py-1.5">
                      <input
                        type="number" min={0} value={row[key]}
                        onChange={(e) => updateMeal(gi, key, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary mx-auto block"
                      />
                    </td>
                  ))}
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
              <td className="px-3 py-2.5 text-xs text-gray-700">TOTAL</td>
              <td className="px-2 py-2.5 text-center bg-primary/5">
                <span className="text-sm font-extrabold bg-primary text-white px-3 py-1 rounded-full">{totalRacList}</span>
              </td>
              {MEAL_KEYS.map((k) => (
                <td key={k} className="px-2 py-2.5 text-center text-xs text-gray-500 font-semibold">{mealTotals[k]}</td>
              ))}
              <td className="px-2 py-2.5 text-center text-xs text-amber-700 font-extrabold">{totalHCO.toFixed(0)}</td>
              <td className="px-2 py-2.5 text-center text-xs text-red-600 font-extrabold">{totalProt.toFixed(0)}</td>
              <td className="px-2 py-2.5 text-center text-xs text-purple-600 font-extrabold">{totalLip.toFixed(0)}</td>
              <td className="px-2 py-2.5 text-center text-sm text-green-700 font-extrabold">{totalKcal.toFixed(0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Distribución de macronutrientes */}
      {totalMacroKcalActual > 0 && (
        <div className="rounded-xl border border-gray-200 p-4 space-y-4 bg-gray-50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-gray-800">Distribución de macronutrientes</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Actual: <span className="font-bold text-gray-800">{totalKcal.toFixed(0)} kcal</span></span>
              {targetKcal != null && (
                <span>Meta GET: <span className="font-bold text-primary">{targetKcal.toFixed(0)} kcal</span></span>
              )}
            </div>
          </div>

          {/* Barra actual */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Actual</span>
              <div className="flex gap-3 text-[10px]">
                <span className="text-amber-600 font-medium">HCO {actualHCOPct.toFixed(1)}%</span>
                <span className="text-red-500 font-medium">Prot {actualProtPct.toFixed(1)}%</span>
                <span className="text-purple-500 font-medium">Líp {actualLipPct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-5 bg-gray-200 rounded-full overflow-hidden flex">
              {actualHCOPct > 0 && <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${Math.min(actualHCOPct, 100)}%` }} />}
              {actualProtPct > 0 && <div className="bg-red-400 h-full transition-all duration-300" style={{ width: `${Math.min(actualProtPct, 100)}%` }} />}
              {actualLipPct > 0 && <div className="bg-purple-400 h-full transition-all duration-300" style={{ width: `${Math.min(actualLipPct, 100)}%` }} />}
            </div>
            <div className="flex gap-5 mt-2 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                HCO: <strong>{totalHCO.toFixed(0)}g</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                Prot: <strong>{totalProt.toFixed(0)}g</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
                Líp: <strong>{totalLip.toFixed(0)}g</strong>
              </span>
            </div>
          </div>

          {/* Barra meta (dietocálculo) */}
          {targetHCOPct != null ? (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Meta (Dietocálculo)</span>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-amber-500 font-medium">HCO {targetHCOPct.toFixed(1)}%</span>
                  <span className="text-red-400 font-medium">Prot {targetProtPct?.toFixed(1)}%</span>
                  <span className="text-purple-400 font-medium">Líp {targetLipPct?.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex opacity-70">
                {targetHCOPct > 0 && <div className="bg-amber-300 h-full" style={{ width: `${Math.min(targetHCOPct, 100)}%` }} />}
                {(targetProtPct ?? 0) > 0 && <div className="bg-red-300 h-full" style={{ width: `${Math.min(targetProtPct ?? 0, 100)}%` }} />}
                {(targetLipPct ?? 0) > 0 && <div className="bg-purple-300 h-full" style={{ width: `${Math.min(targetLipPct ?? 0, 100)}%` }} />}
              </div>
              <div className="flex gap-5 mt-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />
                  HCO: <strong>{targetCarbsG?.toFixed(0) ?? "—"}g</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-300 inline-block" />
                  Prot: <strong>{targetProteG?.toFixed(0) ?? "—"}g</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-300 inline-block" />
                  Líp: <strong>{targetLipG?.toFixed(0) ?? "—"}g</strong>
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">Guarda el Dietocálculo para ver la distribución meta de macronutrientes.</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100 flex-wrap">
        <button
          onClick={handleSugerir}
          disabled={!dietocalculo?.get_ajustado}
          title={!dietocalculo?.get_ajustado ? "Primero guarda el Dietocálculo con GET ajustado" : ""}
          className="flex items-center gap-2 px-4 h-10 rounded-xl border-2 border-primary text-primary text-sm font-semibold hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ✨ Sugerir raciones
        </button>

        <div className="flex items-center gap-3">
          {feedback && (
            <p className={`text-xs font-medium ${feedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {feedback.text}
            </p>
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
    </div>
  );
}
