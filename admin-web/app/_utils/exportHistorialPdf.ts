import type { HistoriaClinicaDatos } from "@/app/_data/historia_clinica";
import { createPdfBuilder, fechaLarga, slugArchivo, PDF_PRIMARY } from "./pdfBuilder";

type MedidasActuales = {
  peso: string;
  altura: string;
  cintura: string;
  cadera: string;
  masaMuscular: string;
  grasa: string;
  brazo: string;
  pantorrilla: string;
  imc: number | null;
};

export type ExportHistorialParams = {
  nombreCompleto: string;
  sexo: string;
  fechaNacimiento: string;
  edad: number | null;
  planMembresia: string;
  hist: HistoriaClinicaDatos;
  medida: MedidasActuales;
};

function yn(v: boolean | null): string | null {
  if (v === true) return "Sí";
  if (v === false) return "No";
  return null;
}

function imcClasificacion(imc: number): string {
  if (imc < 18.5) return "Bajo peso";
  if (imc < 25) return "Normal";
  if (imc < 30) return "Sobrepeso";
  return "Obesidad";
}

export function exportHistorialClinicoPdf({
  nombreCompleto, sexo, fechaNacimiento, edad, planMembresia, hist, medida,
}: ExportHistorialParams): void {
  const { heading1, heading2, metaLine, divider, sectionTitle, subheading, kv, bullets, checklist, finish } = createPdfBuilder();

  // ── Encabezado ──────────────────────────────────────────
  heading1("Historial Clínico");
  heading2(nombreCompleto || "Paciente sin nombre");
  const resumen = [
    sexo ? sexo.charAt(0).toUpperCase() + sexo.slice(1) : null,
    edad != null ? `${edad} años` : null,
    fechaNacimiento ? `Nac. ${fechaLarga(fechaNacimiento)}` : null,
    planMembresia === "premium" ? "Plan Premium" : "Plan Básico",
  ].filter(Boolean).join("   ·   ");
  metaLine(resumen);
  metaLine(`Generado el ${fechaLarga(new Date().toISOString().slice(0, 10))}`);
  divider();

  // ── Datos personales ────────────────────────────────────
  sectionTitle("Datos personales");
  kv("Ocupación", hist.ocupacion);
  kv("Nacionalidad / Residencia", hist.nacionalidad);
  kv("Motivo de consulta (expectativas)", hist.motivo_consulta);
  kv("Nota", hist.nota_datos_personales);

  // ── Medidas antropométricas ─────────────────────────────
  sectionTitle("Medidas antropométricas");
  kv("Peso (kg)", medida.peso);
  kv("Altura (cm)", medida.altura);
  if (medida.imc != null) {
    kv("Índice de Masa Corporal (IMC)", `${medida.imc.toFixed(1)} — ${imcClasificacion(medida.imc)}`);
  }
  kv("Circunferencia de cintura (cm)", medida.cintura);
  kv("Circunferencia de cadera (cm)", medida.cadera);
  kv("Masa muscular (kg)", medida.masaMuscular);
  kv("% Grasa corporal", medida.grasa);
  kv("Circunferencia de brazo (cm)", medida.brazo);
  kv("Circunferencia de pantorrilla (cm)", medida.pantorrilla);

  // ── Antecedentes personales ─────────────────────────────
  sectionTitle("Antecedentes personales");
  checklist("Síntomas gastrointestinales", [
    ["Diarrea", hist.ap_diarrea], ["Vómito", hist.ap_vomito], ["Náuseas", hist.ap_nauseas],
    ["Reflujo", hist.ap_reflujo], ["Gastritis", hist.ap_gastritis],
    ["Estreñimiento", hist.ap_estrenimiento], ["Colitis", hist.ap_colitis],
  ]);
  checklist("Enfermedades", [
    ["Obesidad", hist.ap_obesidad], ["Diabetes", hist.ap_diabetes], ["HTA (Hipertensión)", hist.ap_hta],
    ["Cáncer", hist.ap_cancer], ["Hipercolesterolemia", hist.ap_hipercolesterolemia],
    ["Hipertrigliceridemia", hist.ap_hipertrigliceridemia], ["Trastornos mentales", hist.ap_trastornos_mentales],
    ["Enfermedad Renal", hist.ap_enfermedad_renal], ["Enfermedad Cardíaca", hist.ap_enfermedad_cardiaca],
    ["Tiroides (Hipo/Hiper)", hist.ap_tiroides],
  ]);
  kv("Enfermedad diagnosticada (dx)", hist.ap_enfermedad_dx);
  if (hist.ap_toma_medicamento) {
    kv("Toma medicamento o suplemento", [
      hist.ap_medicamento_cual && `Cuál: ${hist.ap_medicamento_cual}`,
      hist.ap_medicamento_dosis && `Dosis: ${hist.ap_medicamento_dosis}`,
      hist.ap_medicamento_desde && `Desde: ${hist.ap_medicamento_desde}`,
    ].filter(Boolean).join("   ·   ") || "Sí");
  }
  kv("Ciclos menstruales", hist.ap_ciclos_menstruales);
  kv("Nota", hist.nota_antecedentes_personales);

  // ── Antecedentes familiares ─────────────────────────────
  sectionTitle("Antecedentes familiares");
  const afRows: [string, boolean, string][] = [
    ["Obesidad", hist.af_obesidad, hist.af_obesidad_quien],
    ["Diabetes", hist.af_diabetes, hist.af_diabetes_quien],
    ["HTA (Hipertensión)", hist.af_hta, hist.af_hta_quien],
    ["Cáncer", hist.af_cancer, hist.af_cancer_quien],
    ["Dislipidemia", hist.af_dislipidemia, hist.af_dislipidemia_quien],
    ["Trastornos mentales", hist.af_trastornos_mentales, hist.af_trastornos_mentales_quien],
    ["Enfermedad renal", hist.af_enfermedad_renal, hist.af_enfermedad_renal_quien],
    ["Enfermedad cardiaca", hist.af_enfermedad_cardiaca, hist.af_enfermedad_cardiaca_quien],
    ["Tiroides", hist.af_tiroides, hist.af_tiroides_quien],
  ];
  bullets("Antecedentes marcados", afRows
    .filter(([, checked]) => checked)
    .map(([label, , quien]) => (quien.trim() ? `${label} (${quien.trim()})` : label)));
  kv("Otros", hist.af_otros);
  kv("Nota", hist.nota_antecedentes_familiares);

  // ── Estilo de vida ───────────────────────────────────────
  sectionTitle("Estilo de vida");
  if (hist.ev_hace_ejercicio) {
    kv("Ejercicio", [
      hist.ev_tipo_ejercicio && `Tipo: ${hist.ev_tipo_ejercicio}`,
      hist.ev_frecuencia && `Frecuencia: ${hist.ev_frecuencia} días/semana`,
      hist.ev_duracion && `Duración: ${hist.ev_duracion} min`,
      hist.ev_intensidad && `Intensidad: ${hist.ev_intensidad}`,
    ].filter(Boolean).join("   ·   ") || "Sí");
  }
  kv("Rutina semanal", hist.ev_rutina_semanal);
  kv("Hábitos de sueño", hist.ev_habitos_sueno);
  kv("Nivel de estrés", hist.ev_nivel_estres);
  kv("Alcohol", hist.ev_alcohol);
  kv("Tabaco", hist.ev_tabaco);
  kv("Café", hist.ev_cafe);
  kv("Drogas", hist.ev_drogas);
  kv("Vasos de agua potable al día", hist.ev_vasos_agua);
  kv("Vasos de bebidas al día (refrescos, jugos, aguas)", hist.ev_vasos_bebidas);
  kv("Nota", hist.nota_estilo_vida);

  // ── Indicadores bioquímicos ──────────────────────────────
  sectionTitle("Indicadores bioquímicos");
  kv("Última fecha de estudios", hist.ib_ultima_fecha ? fechaLarga(hist.ib_ultima_fecha) : null);
  kv("¿Se solicitaron análisis?", yn(hist.ib_se_solicitaron));
  kv("Cuáles", hist.ib_cuales);
  kv("Nota", hist.nota_indicadores_bioquimicos);

  // ── Indicadores dietéticos ───────────────────────────────
  sectionTitle("Indicadores dietéticos");
  kv("Cuántas comidas hace al día", hist.id_comidas_dia);
  kv("Quién prepara sus alimentos", hist.id_quien_prepara);
  kv("Grasa utilizada en casa", hist.id_grasa_casa);
  kv("Presupuesto para alimentos", hist.id_presupuesto);
  kv("R24 — Desayuno", hist.id_r24_desayuno);
  kv("R24 — Colación (entre desayuno y comida)", hist.id_r24_colacion_am);
  kv("R24 — Comida", hist.id_r24_comida);
  kv("R24 — Colación (entre comida y cena)", hist.id_r24_colacion_pm);
  kv("R24 — Cena", hist.id_r24_cena);
  kv("Apetito", hist.id_apetito);
  kv("¿Agrega sal a la comida ya preparada?", yn(hist.id_agrega_sal));
  kv("Alimentos preferidos", hist.id_alimentos_preferidos);
  kv("Alimentos que no le agradan / no acostumbra", hist.id_no_agradan);
  kv("Alergia / Intolerancia", hist.id_alergias);
  kv("Alimentos que le causan malestar", hist.id_malestar);
  if (hist.id_dieta_anterior) {
    kv("Dieta anterior", [
      hist.id_dieta_tipo && `Tipo: ${hist.id_dieta_tipo}`,
      hist.id_dieta_hace_cuanto && `Hace cuánto: ${hist.id_dieta_hace_cuanto}`,
      hist.id_dieta_tiempo && `Por cuánto tiempo: ${hist.id_dieta_tiempo}`,
      hist.id_dieta_razon && `Razón: ${hist.id_dieta_razon}`,
      hist.id_dieta_apego && `Apego: ${hist.id_dieta_apego}`,
      hist.id_dieta_resultados && `Resultados: ${hist.id_dieta_resultados}`,
    ].filter(Boolean).join("   ·   ") || "Sí");
  }
  if (hist.id_medicamentos_peso) {
    kv("Medicamentos para bajar de peso", hist.id_medicamentos_cuales || "Sí");
  }
  kv("Nota", hist.nota_indicadores_dieteticos);

  // ── Entrenamiento ─────────────────────────────────────────
  sectionTitle("Entrenamiento");
  kv("Antecedentes de lesiones", hist.ent_lesiones);
  kv("Experiencia con ejercicio", hist.ent_experiencia);
  kv("¿Realiza otro tipo de ejercicio?", hist.ent_otro_ejercicio);
  kv("Días que destinará al entrenamiento", hist.ent_dias);
  kv("Distribución", hist.ent_distribucion);
  kv("Nota", hist.nota_entrenamiento);

  // ── Comentarios / Plan de intervención ───────────────────
  sectionTitle("Comentarios / Plan de intervención");
  kv("Comentarios y plan de intervención", hist.comentarios_plan);

  // ── Seguimientos ──────────────────────────────────────────
  const seguimientos = hist.seguimientos ?? [];
  if (seguimientos.length > 0) {
    sectionTitle(`Seguimientos (${seguimientos.length})`);
    for (const seg of seguimientos) {
      subheading(`Consulta — ${fechaLarga(seg.fecha)}`, PDF_PRIMARY);
      kv("¿Cómo se sintió?", seg.como_se_sintio);
      kv("Cambios notados", seg.cambios_notados);
      kv("¿Qué le pareció el menú?", seg.menu_parecio);
      kv("Síntomas GI", seg.sintomas_gi);
      kv("Propuesta de intervención", seg.propuesta_intervencion);
      kv("Estrés", seg.estres);
      kv("Ciclos menstruales", seg.ciclos_menstruales);
      kv("¿Utilizó equivalentes?", seg.utilizo_equivalentes);
      kv("Rutina", seg.rutina);
      kv("Suplementos / medicamentos", seg.suplementos_medicamentos);
      kv("¿Consumo de agua?", seg.consumo_agua);
      kv("Tiempos de comida", seg.seguir_4_tiempos);
      kv("Alimentos por quitar", seg.alimentos_quitar);
      kv("Alimentos por incluir", seg.alimentos_incluir);
      kv("¿Qué tal sintió la rutina?", seg.rutina_sintio);
      kv("¿Logró progresar?", seg.logro_progresar);
      kv("¿Dolor muscular?", seg.dolor_muscular);
      kv("¿Días de entrenamiento?", seg.continuar_5_dias);
      kv("¿Realizó cardio?", seg.realizo_cardio);
      kv("Intervención", seg.intervencion);
    }
  }

  const fechaArchivo = new Date().toISOString().slice(0, 10);
  finish(`historial_clinico_${slugArchivo(nombreCompleto || "paciente")}_${fechaArchivo}.pdf`);
}
