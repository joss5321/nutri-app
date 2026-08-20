import type { Exercise } from "@/app/_data/exercises";
import { createPdfBuilder, fechaLarga, slugArchivo } from "./pdfBuilder";

type SerieRow = { reps: string; peso: string };

type AssignedExport = {
  exerciseId: string;
  series: string;
  seriesRows: SerieRow[];
  rir: string;
  rpe: string;
  descanso: string;
  tipoEsfuerzo: "reps" | "tiempo";
  unidadPeso: "kg" | "lbs";
};

export function exportRutinaPdf(params: {
  nombrePaciente: string;
  nombreRutina: string;
  days: string[];
  assigned: Record<string, AssignedExport[]>;
  exercises: Exercise[];
}): void {
  const { nombrePaciente, nombreRutina, days, assigned, exercises } = params;
  const exerciseById = (id: string) => exercises.find((e) => e.id === id);

  const { heading1, heading2, metaLine, divider, sectionTitle, subheading, kv, table, empty, finish } = createPdfBuilder();

  // ── Encabezado ──────────────────────────────────────────
  heading1("Rutina de Entrenamiento");
  heading2(nombreRutina || `Rutina de ${nombrePaciente}`);
  metaLine(`Paciente: ${nombrePaciente}`);
  metaLine(`Generado el ${fechaLarga(new Date().toISOString().slice(0, 10))}`);
  divider();

  const totalEjercicios = Object.values(assigned).reduce((acc, d) => acc + d.length, 0);
  if (totalEjercicios === 0) {
    empty("Esta rutina todavía no tiene ejercicios asignados.");
  } else {
    for (const day of days) {
      const list = assigned[day] ?? [];
      if (list.length === 0) continue;
      sectionTitle(day);
      for (const a of list) {
        const ex = exerciseById(a.exerciseId);
        if (!ex) continue;
        subheading(`${ex.emoji || "🏋️"} ${ex.nombre}${ex.grupo_muscular ? " — " + ex.grupo_muscular : ""}`);
        const metaBits = [
          a.rir.trim() && `RIR: ${a.rir}`,
          a.rpe.trim() && `RPE: ${a.rpe}`,
          a.descanso.trim() && `Descanso: ${a.descanso}s`,
        ].filter(Boolean).join("   ·   ");
        if (metaBits) kv("Detalles", metaBits);
        const unidadLabel = a.tipoEsfuerzo === "tiempo" ? "Tiempo (seg)" : "Reps";
        table(
          ["Serie", unidadLabel, `Peso (${a.unidadPeso})`],
          a.seriesRows.map((r, i) => [`S${i + 1}`, r.reps || "—", r.peso || "—"]),
        );
      }
    }
  }

  // ── Distribución muscular semanal ────────────────────────
  const muscleSeries: Record<string, { series: number; ejercicios: Set<string> }> = {};
  for (const day of days) {
    for (const a of assigned[day] ?? []) {
      const ex = exerciseById(a.exerciseId);
      if (!ex) continue;
      const s = parseInt(a.series) || 0;
      const groups = [ex.grupo_muscular, ...ex.grupos_secundarios].filter(Boolean) as string[];
      for (const g of groups) {
        if (!muscleSeries[g]) muscleSeries[g] = { series: 0, ejercicios: new Set() };
        muscleSeries[g].series += s;
        muscleSeries[g].ejercicios.add(ex.nombre);
      }
    }
  }
  const entries = Object.entries(muscleSeries).sort((a, b) => b[1].series - a[1].series);
  if (entries.length > 0) {
    sectionTitle("Distribución muscular semanal");
    table(
      ["Grupo muscular", "Series", "Ejercicios"],
      entries.map(([m, v]) => [m, String(v.series), [...v.ejercicios].join(", ")]),
      { columnStyles: { 2: { cellWidth: 90 } } },
    );
  }

  const fechaArchivo = new Date().toISOString().slice(0, 10);
  finish(`rutina_${slugArchivo(nombrePaciente)}_${fechaArchivo}.pdf`);
}
