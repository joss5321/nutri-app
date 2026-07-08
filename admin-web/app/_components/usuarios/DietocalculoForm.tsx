"use client";
import { useEffect, useState } from "react";
import { fetchPerfil } from "@/app/_data/perfiles";
import { fetchUltimaMedida } from "@/app/_data/medidas";
import { fetchDietocalculo, saveDietocalculo, type DietocalculoInput } from "@/app/_data/dietocalculo";

// ── Fórmulas GEB ────────────────────────────────────────────
type Formula = "mifflin" | "harris" | "fao" | "valencia" | "schofield";

const FORMULA_LABELS: Record<Formula, string> = {
  mifflin: "Mifflin-St Jeor",
  harris: "Harris-Benedict",
  fao: "FAO/OMS",
  valencia: "Valencia",
  schofield: "Schofield Pediátrica",
};

function calcGEB(formula: Formula, peso: number, altura: number, edad: number, sexo: string): number | null {
  if (peso <= 0 || edad <= 0) return null;
  const isMale = sexo === "masculino";
  switch (formula) {
    case "mifflin":
      if (altura <= 0) return null;
      return isMale ? 10 * peso + 6.25 * altura - 5 * edad + 5 : 10 * peso + 6.25 * altura - 5 * edad - 161;
    case "harris":
      if (altura <= 0) return null;
      return isMale ? 88.362 + 13.397 * peso + 4.799 * altura - 5.677 * edad : 447.593 + 9.247 * peso + 3.098 * altura - 4.33 * edad;
    case "fao": {
      const altM = altura / 100;
      if (edad >= 10 && edad < 18) return isMale ? 1000 + 33.7 * peso + 839 * altM : 925 + 22.7 * peso + 784 * altM;
      if (edad >= 18 && edad < 30) return isMale ? 15.3 * peso + 679 : 14.7 * peso + 496;
      if (edad >= 30 && edad < 60) return isMale ? 11.6 * peso + 879 : 8.7 * peso + 829;
      if (edad >= 60) return isMale ? 13.5 * peso + 487 : 10.5 * peso + 596;
      return null;
    }
    case "valencia":
      return isMale ? 24.375 * peso + 154.73 - 4.7 * edad : 22.078 * peso + 14.818 - 0.4757 * edad;
    case "schofield":
      if (edad < 3) return isMale ? 59.512 * peso - 30.4 : 58.317 * peso - 31.1;
      if (edad < 10) return isMale ? 22.706 * peso + 504.3 : 20.315 * peso + 485.9;
      if (edad < 18) return isMale ? 17.686 * peso + 658.2 : 13.384 * peso + 692.6;
      if (edad < 30) return isMale ? 15.057 * peso + 692.2 : 14.818 * peso + 486.6;
      if (edad < 60) return isMale ? 11.472 * peso + 873.1 : 8.126 * peso + 845.6;
      if (edad >= 60) return isMale ? 11.711 * peso + 587.7 : 9.082 * peso + 658.5;
      return null;
  }
}

type ActividadKey = "sedentario" | "ligero" | "moderado" | "activo" | "muy_activo";
const ACTIVIDAD_LABELS: Record<ActividadKey, string> = {
  sedentario: "Sedentario (mínimo ejercicio)", ligero: "Ligero (1-3 días/semana)",
  moderado: "Moderado (3-5 días/semana)", activo: "Activo (5-6 días/semana)", muy_activo: "Muy activo (6-7 días/semana)",
};
// Etiquetas específicas para Valencia y Schofield (rangos 1.40-1.69 / 1.70-1.99 / 2.0-2.40)
const ACTIVIDAD_LABELS_VS: Record<ActividadKey, string> = {
  sedentario: "Sedentario",
  ligero:     "Ligera (1.40 – 1.69)",
  moderado:   "Moderada (1.70 – 1.99)",
  activo:     "Intensa (2.00 – 2.20)",
  muy_activo: "Intensa máx. (2.21 – 2.40)",
};
const FACTORES: Record<Formula, Record<ActividadKey, number>> = {
  mifflin:   { sedentario: 1.2,  ligero: 1.375, moderado: 1.55,  activo: 1.725, muy_activo: 1.9  },
  harris:    { sedentario: 1.2,  ligero: 1.375, moderado: 1.55,  activo: 1.725, muy_activo: 1.9  },
  fao:       { sedentario: 1.4,  ligero: 1.55,  moderado: 1.75,  activo: 2.0,   muy_activo: 2.2  },
  valencia:  { sedentario: 1.3,  ligero: 1.55,  moderado: 1.85,  activo: 2.10,  muy_activo: 2.40 },
  schofield: { sedentario: 1.3,  ligero: 1.55,  moderado: 1.85,  activo: 2.10,  muy_activo: 2.40 },
};

type Objetivo = "deficit" | "mantenimiento" | "superavit";

export default function DietocalculoForm({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  const [peso, setPeso] = useState(0);
  const [altura, setAltura] = useState(0);
  const [edad, setEdad] = useState(0);
  const [sexo, setSexo] = useState("femenino");

  const [formula, setFormula] = useState<Formula>("mifflin");
  const [actividad, setActividad] = useState<ActividadKey>("sedentario");
  const [objetivo, setObjetivo] = useState<Objetivo>("mantenimiento");
  const [nivelPct, setNivelPct] = useState("");
  const [carbsGrKg, setCarbsGrKg] = useState("");
  const [proteGrKg, setProteGrKg] = useState("");
  const [lipidosGrKg, setLipidosGrKg] = useState("");

  useEffect(() => {
    Promise.all([fetchPerfil(userId), fetchUltimaMedida(userId), fetchDietocalculo(userId)])
      .then(([perfil, medida, calculo]) => {
        setSexo(perfil.sexo ?? "femenino");
        setAltura(perfil.altura_cm ?? 0);
        if (perfil.fecha_nacimiento) {
          const [y, m, d] = perfil.fecha_nacimiento.split("-").map(Number);
          const hoy = new Date();
          let e = hoy.getFullYear() - y;
          if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) e--;
          setEdad(e);
        }
        if (medida?.peso_kg) setPeso(medida.peso_kg);

        if (calculo) {
          setExistingId(calculo.id);
          setFormula(calculo.formula as Formula);
          setActividad(calculo.actividad as ActividadKey);
          setObjetivo(calculo.objetivo as Objetivo);
          setNivelPct(calculo.nivel_pct > 0 ? String(calculo.nivel_pct) : "");
          setCarbsGrKg(calculo.carbs_gr_kg > 0 ? String(calculo.carbs_gr_kg) : "");
          setProteGrKg(calculo.prote_gr_kg > 0 ? String(calculo.prote_gr_kg) : "");
          setLipidosGrKg(calculo.lipidos_gr_kg > 0 ? String(calculo.lipidos_gr_kg) : "");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar datos."))
      .finally(() => setLoading(false));
  }, [userId]);

  // ── Cálculos ──────────────────────────────────────────────
  const geb = calcGEB(formula, peso, altura, edad, sexo);
  const eta = geb != null ? geb * 0.1 : null;
  const factorAF = FACTORES[formula][actividad];
  const get = geb != null ? geb * factorAF + (eta ?? 0) : null;
  const nivelNum = Math.max(0, Math.min(20, parseFloat(nivelPct) || 0));
  const getAjustado = get != null
    ? objetivo === "deficit" ? get - get * (nivelNum / 100)
    : objetivo === "superavit" ? get + get * (nivelNum / 100)
    : get : null;

  const carbsGr = parseFloat(carbsGrKg) || 0;
  const proteGr = parseFloat(proteGrKg) || 0;
  const lipidosGr = parseFloat(lipidosGrKg) || 0;
  const carbsKcal = carbsGr * peso * 4;
  const proteKcal = proteGr * peso * 4;
  const lipidosKcal = lipidosGr * peso * 9;
  const totalMacroKcal = carbsKcal + proteKcal + lipidosKcal;
  const carbsPct = getAjustado && getAjustado > 0 ? (carbsKcal / getAjustado) * 100 : 0;
  const protePct = getAjustado && getAjustado > 0 ? (proteKcal / getAjustado) * 100 : 0;
  const lipidosPct = getAjustado && getAjustado > 0 ? (lipidosKcal / getAjustado) * 100 : 0;

  const handleSave = async () => {
    if (geb == null) { setFeedback({ type: "error", text: "No se puede calcular con los datos actuales." }); return; }
    setSaving(true);
    setFeedback(null);
    try {
      const input: DietocalculoInput = {
        formula, actividad, objetivo,
        nivel_pct: nivelNum,
        geb, eta, factor_af: factorAF,
        get_total: get, get_ajustado: getAjustado,
        carbs_gr_kg: carbsGr, prote_gr_kg: proteGr, lipidos_gr_kg: lipidosGr,
        carbs_kcal: carbsKcal, prote_kcal: proteKcal, lipidos_kcal: lipidosKcal,
        carbs_pct: carbsPct, prote_pct: protePct, lipidos_pct: lipidosPct,
      };
      const saved = await saveDietocalculo(userId, input, existingId ?? undefined);
      setExistingId(saved.id);
      setFeedback({ type: "success", text: existingId ? "Dietocálculo actualizado." : "Dietocálculo guardado." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Cargando datos del usuario...</p>;
  if (error) return <p className="text-sm text-red-600 text-center py-10">{error}</p>;

  return (
    <div className="space-y-6">
      {existingId && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-xs text-green-700 flex items-center gap-2">
          <span>✅</span> Este usuario ya tiene un dietocálculo guardado. Los cambios se actualizarán al guardar.
        </div>
      )}

      {/* Datos del usuario */}
      <div>
        <p className="font-semibold text-gray-900 mb-2">Datos del usuario</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Peso (kg)", value: peso },
            { label: "Estatura (cm)", value: altura },
            { label: "Edad (años)", value: edad },
            { label: "Sexo", value: sexo.charAt(0).toUpperCase() + sexo.slice(1) },
          ].map((d) => (
            <div key={d.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-500">{d.label}</p>
              <p className="font-bold text-gray-900 text-sm mt-0.5">{d.value || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Fórmula + actividad */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Fórmula</label>
          <select value={formula} onChange={(e) => setFormula(e.target.value as Formula)}
            className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary">
            {(Object.keys(FORMULA_LABELS) as Formula[]).map((f) => (
              <option key={f} value={f}>{FORMULA_LABELS[f]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Factor de actividad física ({factorAF})</label>
          <select value={actividad} onChange={(e) => setActividad(e.target.value as ActividadKey)}
            className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary">
            {(Object.keys(ACTIVIDAD_LABELS) as ActividadKey[]).map((a) => (
              <option key={a} value={a}>{(formula === "valencia" || formula === "schofield") ? ACTIVIDAD_LABELS_VS[a] : ACTIVIDAD_LABELS[a]} — {FACTORES[formula][a]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* GEB / ETA / GET */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-xs text-blue-600 font-medium">Gasto Energético Basal (GEB)</p>
          <p className="text-2xl font-extrabold text-blue-800 mt-1">{geb != null ? geb.toFixed(0) : "—"}</p>
          <p className="text-xs text-blue-500">kcal</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <p className="text-xs text-orange-600 font-medium">Efecto Termogénico (ETA 10%)</p>
          <p className="text-2xl font-extrabold text-orange-800 mt-1">{eta != null ? eta.toFixed(0) : "—"}</p>
          <p className="text-xs text-orange-500">kcal</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-xs text-green-600 font-medium">Gasto Energético Total (GET)</p>
          <p className="text-2xl font-extrabold text-green-800 mt-1">{get != null ? get.toFixed(0) : "—"}</p>
          <p className="text-xs text-green-500">kcal</p>
        </div>
      </div>

      {/* Objetivo */}
      <div className="grid grid-cols-3 gap-4 items-end">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Objetivo</label>
          <select value={objetivo} onChange={(e) => setObjetivo(e.target.value as Objetivo)}
            className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary">
            <option value="deficit">Déficit calórico</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="superavit">Superávit calórico</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">
            Nivel de {objetivo === "deficit" ? "déficit" : objetivo === "superavit" ? "superávit" : "—"} (%)
          </label>
          <input type="number" min={5} max={20} value={nivelPct} onChange={(e) => setNivelPct(e.target.value)}
            disabled={objetivo === "mantenimiento"} placeholder="5 – 20"
            className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary disabled:bg-gray-50 disabled:text-gray-400" />
        </div>
        <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
          <p className="text-xs text-primary font-medium">GET Ajustado</p>
          <p className="text-2xl font-extrabold text-primary">{getAjustado != null ? getAjustado.toFixed(0) : "—"}</p>
          <p className="text-xs text-gray-500">kcal</p>
        </div>
      </div>

      {/* Macronutrientes */}
      <div>
        <p className="font-semibold text-gray-900 mb-2">Distribución de macronutrientes</p>
        <p className="text-xs text-gray-500 mb-3">Ingresa gramos por kilogramo de peso corporal.</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Carbohidratos", grKg: carbsGrKg, setGrKg: setCarbsGrKg, kcal: carbsKcal, pct: carbsPct, factor: "4 kcal/g", color: "bg-amber-50 border-amber-200 text-amber-700" },
            { label: "Proteínas", grKg: proteGrKg, setGrKg: setProteGrKg, kcal: proteKcal, pct: protePct, factor: "4 kcal/g", color: "bg-red-50 border-red-200 text-red-700" },
            { label: "Lípidos", grKg: lipidosGrKg, setGrKg: setLipidosGrKg, kcal: lipidosKcal, pct: lipidosPct, factor: "9 kcal/g", color: "bg-purple-50 border-purple-200 text-purple-700" },
          ].map((m) => (
            <div key={m.label} className={`rounded-xl p-3 border ${m.color}`}>
              <p className="text-xs font-semibold mb-2">{m.label} <span className="font-normal opacity-70">({m.factor})</span></p>
              <div className="flex items-center gap-2 mb-2">
                <input type="number" min={0} step="0.1" value={m.grKg} onChange={(e) => m.setGrKg(e.target.value)}
                  placeholder="gr/kg" className="w-20 h-9 border border-gray-200 rounded-lg px-2 text-sm text-center focus:outline-none focus:border-primary bg-white" />
                <span className="text-xs opacity-70">gr × kg</span>
              </div>
              <p className="text-xs opacity-80">{m.kcal.toFixed(0)} kcal</p>
              <p className="text-lg font-extrabold mt-1">{m.pct.toFixed(1)}%</p>
            </div>
          ))}
        </div>

        {totalMacroKcal > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Total macros: {totalMacroKcal.toFixed(0)} kcal</span>
              <span>GET ajustado: {getAjustado?.toFixed(0) ?? "—"} kcal</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
              {carbsPct > 0 && <div className="bg-amber-400 h-full" style={{ width: `${Math.min(carbsPct, 100)}%` }} />}
              {protePct > 0 && <div className="bg-red-400 h-full" style={{ width: `${Math.min(protePct, 100)}%` }} />}
              {lipidosPct > 0 && <div className="bg-purple-400 h-full" style={{ width: `${Math.min(lipidosPct, 100)}%` }} />}
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span className="text-amber-600 font-medium">Carbs <strong>{(carbsGr * peso).toFixed(0)}g</strong> ({carbsPct.toFixed(1)}%)</span>
              <span className="text-red-500 font-medium">Prot <strong>{(proteGr * peso).toFixed(0)}g</strong> ({protePct.toFixed(1)}%)</span>
              <span className="text-purple-500 font-medium">Líp <strong>{(lipidosGr * peso).toFixed(0)}g</strong> ({lipidosPct.toFixed(1)}%)</span>
            </div>
          </div>
        )}
      </div>

      {/* Guardar */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        {feedback && (
          <span className={`text-xs font-medium ${feedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {feedback.text}
          </span>
        )}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
          {saving ? "Guardando..." : existingId ? "💾 Actualizar dietocálculo" : "💾 Guardar dietocálculo"}
        </button>
      </div>
    </div>
  );
}
