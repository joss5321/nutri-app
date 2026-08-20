import { fetchPerfil } from "@/app/_data/perfiles";
import { fetchDietocalculo } from "@/app/_data/dietocalculo";
import { fetchEquivalentes, FOOD_GROUPS, MEAL_KEYS, NUTRICION_POR_EQUIV } from "@/app/_data/nutricion";
import { fetchRecetasAsignadas, type MealKey } from "@/app/_data/recetas_guardadas";
import { fetchPlanSuplementacion } from "@/app/_data/plan_suplementacion";
import { createPdfBuilder, fechaLarga, slugArchivo } from "./pdfBuilder";

const FORMULA_LABELS: Record<string, string> = {
  mifflin: "Mifflin-St Jeor", harris: "Harris-Benedict", fao: "FAO/OMS",
  valencia: "Valencia", schofield: "Schofield Pediátrica",
};
const ACTIVIDAD_LABELS: Record<string, string> = {
  sedentario: "Sedentario", ligero: "Ligero", moderado: "Moderado", activo: "Activo", muy_activo: "Muy activo",
};
const OBJETIVO_LABELS: Record<string, string> = {
  deficit: "Déficit calórico", mantenimiento: "Mantenimiento", superavit: "Superávit calórico",
};
const MEAL_TAB_LABELS: Record<MealKey, string> = {
  desayuno: "Desayuno", colacion_1: "Colación 1", comida: "Comida", colacion_2: "Colación 2", cena: "Cena",
};

export async function exportPlanNutricionPdf(userId: string, nombrePaciente: string): Promise<void> {
  const [perfil, dietocalculo, { equivalentes }, recetas, suplementos] = await Promise.all([
    fetchPerfil(userId),
    fetchDietocalculo(userId),
    fetchEquivalentes(userId),
    fetchRecetasAsignadas(userId),
    fetchPlanSuplementacion(userId),
  ]);

  const nombre = nombrePaciente || perfil.nombre_completo || "Paciente sin nombre";
  const { heading1, heading2, metaLine, divider, sectionTitle, subheading, kv, bulletList, empty, table, finish } = createPdfBuilder();

  // ── Encabezado ──────────────────────────────────────────
  heading1("Plan de Nutrición");
  heading2(nombre);
  metaLine(`Generado el ${fechaLarga(new Date().toISOString().slice(0, 10))}`);
  divider();

  // ── Dietocálculo ──────────────────────────────────────────
  sectionTitle("Dietocálculo");
  if (!dietocalculo) {
    empty("Este paciente aún no tiene un dietocálculo guardado.");
  } else {
    kv("Fórmula utilizada", FORMULA_LABELS[dietocalculo.formula] ?? dietocalculo.formula);
    kv("Nivel de actividad física", ACTIVIDAD_LABELS[dietocalculo.actividad] ?? dietocalculo.actividad);
    kv("Objetivo", OBJETIVO_LABELS[dietocalculo.objetivo] ?? dietocalculo.objetivo);
    if (dietocalculo.objetivo !== "mantenimiento" && dietocalculo.nivel_pct) {
      kv("Nivel de déficit/superávit", `${dietocalculo.nivel_pct}%`);
    }
    kv("Gasto Energético Basal (GEB)", dietocalculo.geb != null ? `${dietocalculo.geb.toFixed(0)} kcal` : null);
    kv("Efecto Termogénico (ETA)", dietocalculo.eta != null ? `${dietocalculo.eta.toFixed(0)} kcal` : null);
    kv("Gasto Energético Total (GET)", dietocalculo.get_total != null ? `${dietocalculo.get_total.toFixed(0)} kcal` : null);
    kv("GET Ajustado", dietocalculo.get_ajustado != null ? `${dietocalculo.get_ajustado.toFixed(0)} kcal` : null);

    table(
      ["Macronutriente", "gr/kg", "Gramos", "Kcal", "%"],
      [
        ["Carbohidratos", `${dietocalculo.carbs_gr_kg}`, (dietocalculo.carbs_kcal / 4).toFixed(0), dietocalculo.carbs_kcal.toFixed(0), `${dietocalculo.carbs_pct.toFixed(1)}%`],
        ["Proteínas", `${dietocalculo.prote_gr_kg}`, (dietocalculo.prote_kcal / 4).toFixed(0), dietocalculo.prote_kcal.toFixed(0), `${dietocalculo.prote_pct.toFixed(1)}%`],
        ["Lípidos", `${dietocalculo.lipidos_gr_kg}`, (dietocalculo.lipidos_kcal / 9).toFixed(0), dietocalculo.lipidos_kcal.toFixed(0), `${dietocalculo.lipidos_pct.toFixed(1)}%`],
      ],
    );
  }

  // ── Tabla de equivalentes ─────────────────────────────────
  sectionTitle("Tabla de equivalentes");
  if (equivalentes.length === 0) {
    empty("No hay equivalentes asignados.");
  } else {
    let totalRac = 0, totalHCO = 0, totalProt = 0, totalLip = 0, totalKcal = 0;
    const mealTotals: Record<string, number> = { desayuno: 0, colacion_1: 0, comida: 0, colacion_2: 0, cena: 0 };
    const rows = FOOD_GROUPS.map((fg) => {
      const e = equivalentes.find((x) => x.grupo === fg.grupo);
      const raciones = e ? MEAL_KEYS.reduce((acc, k) => acc + e[k], 0) : 0;
      const nutri = NUTRICION_POR_EQUIV[fg.grupo] ?? { hco: 0, prot: 0, lip: 0, kcal: 0 };
      const hco = raciones * nutri.hco, prot = raciones * nutri.prot, lip = raciones * nutri.lip, kcal = raciones * nutri.kcal;
      totalRac += raciones; totalHCO += hco; totalProt += prot; totalLip += lip; totalKcal += kcal;
      MEAL_KEYS.forEach((k) => { mealTotals[k] += e ? e[k] : 0; });
      return [
        `${fg.icono} ${fg.grupo}`, String(raciones),
        ...MEAL_KEYS.map((k) => String(e ? e[k] : 0)),
        hco.toFixed(0), prot.toFixed(0), lip.toFixed(0), kcal.toFixed(0),
      ];
    });

    table(
      ["Grupo", "#Rac", "Desay.", "Col.1", "Comida", "Col.2", "Cena", "HCO(g)", "Prot(g)", "Líp(g)", "Kcal"],
      rows,
      {
        foot: [[
          "TOTAL", String(totalRac),
          String(mealTotals.desayuno), String(mealTotals.colacion_1), String(mealTotals.comida),
          String(mealTotals.colacion_2), String(mealTotals.cena),
          totalHCO.toFixed(0), totalProt.toFixed(0), totalLip.toFixed(0), totalKcal.toFixed(0),
        ]],
        columnStyles: { 0: { cellWidth: 38 } },
      },
    );
  }

  // ── Recetas asignadas ─────────────────────────────────────
  sectionTitle("Recetas asignadas");
  if (recetas.length === 0) {
    empty("No hay recetas asignadas.");
  } else {
    for (const mealKey of MEAL_KEYS) {
      const items = recetas.filter((r) => r.tiempo_comida === mealKey);
      if (items.length === 0) continue;
      subheading(MEAL_TAB_LABELS[mealKey]);
      bulletList(items.map((r) =>
        [r.nombre, r.tipo, r.calorias != null ? `${r.calorias} kcal` : null, r.nivel]
          .filter(Boolean).join(" — ")
      ));
    }
  }

  // ── Suplementación ────────────────────────────────────────
  sectionTitle("Suplementación");
  if (suplementos.length === 0) {
    empty("No hay suplementos asignados.");
  } else {
    table(
      ["Suplemento", "Dosis", "Hora", "Momento", "Notas"],
      suplementos.map((s) => [
        [s.suplementos.nombre, s.suplementos.marca].filter(Boolean).join(" · "),
        s.dosis ?? "—", s.hora ?? "—", s.momento ?? "—", s.notas ?? "—",
      ]),
    );
  }

  const fechaArchivo = new Date().toISOString().slice(0, 10);
  finish(`plan_nutricion_${slugArchivo(nombre)}_${fechaArchivo}.pdf`);
}
