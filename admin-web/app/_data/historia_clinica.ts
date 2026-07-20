import { supabase } from "@/lib/supabase";

export type Seguimiento = {
  id: string;
  fecha: string;
  como_se_sintio: string;
  cambios_notados: string;
  menu_parecio: string;
  sintomas_gi: string;
  propuesta_intervencion: string;
  intento_jugo_verde: string;
  estres: string;
  ciclos_menstruales: string;
  utilizo_equivalentes: string;
  rutina: string;
  suplementos_medicamentos: string;
  consumo_agua: string;
  seguir_4_tiempos: string;
  alimentos_quitar: string;
  alimentos_incluir: string;
  rutina_sintio: string;
  logro_progresar: string;
  dolor_muscular: string;
  continuar_5_dias: string;
  realizo_cardio: string;
  intervencion: string;
};

export type HistoriaClinicaDatos = {
  // Datos personales extra
  ocupacion: string;
  nacionalidad: string;
  motivo_consulta: string;
  nota_datos_personales: string;
  // Antecedentes personales
  ap_diarrea: boolean; ap_vomito: boolean; ap_nauseas: boolean;
  ap_reflujo: boolean; ap_gastritis: boolean; ap_estrenimiento: boolean; ap_colitis: boolean;
  ap_enfermedad_dx: string;
  ap_toma_medicamento: boolean;
  ap_medicamento_cual: string; ap_medicamento_dosis: string; ap_medicamento_desde: string;
  ap_ciclos_menstruales: string;
  nota_antecedentes_personales: string;
  // Antecedentes familiares
  af_obesidad: boolean; af_diabetes: boolean; af_hta: boolean; af_cancer: boolean;
  af_hipercolesterolemia: boolean; af_hipertrigliceridemia: boolean; af_trastornos_mentales: boolean;
  af_otros: string;
  nota_antecedentes_familiares: string;
  // Estilo de vida
  ev_hace_ejercicio: boolean;
  ev_frecuencia: string; ev_duracion: string; ev_intensidad: string;
  ev_rutina_semanal: string; ev_habitos_sueno: string;
  ev_alcohol: string; ev_tabaco: string; ev_cafe: string; ev_drogas: string;
  ev_vasos_agua: string; ev_vasos_bebidas: string;
  nota_estilo_vida: string;
  // Indicadores bioquímicos
  ib_ultima_fecha: string; ib_se_solicitaron: boolean | null; ib_cuales: string;
  nota_indicadores_bioquimicos: string;
  // Indicadores dietéticos
  id_comidas_dia: string; id_quien_prepara: string; id_grasa_casa: string; id_presupuesto: string;
  id_r24_desayuno: string; id_r24_comida: string; id_r24_cena: string;
  id_apetito: string;
  id_alimentos_preferidos: string; id_no_agradan: string;
  id_alergias: string; id_malestar: string;
  id_agrega_sal: boolean | null;
  id_dieta_anterior: boolean | null;
  id_dieta_tipo: string; id_dieta_hace_cuanto: string; id_dieta_tiempo: string;
  id_dieta_razon: string; id_dieta_apego: string; id_dieta_resultados: string;
  id_medicamentos_peso: boolean | null; id_medicamentos_cuales: string;
  nota_indicadores_dieteticos: string;
  // Entrenamiento
  ent_lesiones: string; ent_experiencia: string; ent_otro_ejercicio: string;
  ent_dias: string; ent_distribucion: string;
  nota_entrenamiento: string;
  // Plan
  comentarios_plan: string;
  // Seguimientos
  seguimientos: Seguimiento[];
};

export function emptyHistoria(): HistoriaClinicaDatos {
  return {
    ocupacion: "", nacionalidad: "", motivo_consulta: "", nota_datos_personales: "",
    ap_diarrea: false, ap_vomito: false, ap_nauseas: false, ap_reflujo: false,
    ap_gastritis: false, ap_estrenimiento: false, ap_colitis: false,
    ap_enfermedad_dx: "", ap_toma_medicamento: false,
    ap_medicamento_cual: "", ap_medicamento_dosis: "", ap_medicamento_desde: "",
    ap_ciclos_menstruales: "", nota_antecedentes_personales: "",
    af_obesidad: false, af_diabetes: false, af_hta: false, af_cancer: false,
    af_hipercolesterolemia: false, af_hipertrigliceridemia: false,
    af_trastornos_mentales: false, af_otros: "", nota_antecedentes_familiares: "",
    ev_hace_ejercicio: false, ev_frecuencia: "", ev_duracion: "", ev_intensidad: "",
    ev_rutina_semanal: "", ev_habitos_sueno: "",
    ev_alcohol: "", ev_tabaco: "", ev_cafe: "", ev_drogas: "",
    ev_vasos_agua: "", ev_vasos_bebidas: "", nota_estilo_vida: "",
    ib_ultima_fecha: "", ib_se_solicitaron: null, ib_cuales: "",
    nota_indicadores_bioquimicos: "",
    id_comidas_dia: "", id_quien_prepara: "", id_grasa_casa: "", id_presupuesto: "",
    id_r24_desayuno: "", id_r24_comida: "", id_r24_cena: "",
    id_apetito: "", id_alimentos_preferidos: "", id_no_agradan: "",
    id_alergias: "", id_malestar: "", id_agrega_sal: null,
    id_dieta_anterior: null, id_dieta_tipo: "", id_dieta_hace_cuanto: "",
    id_dieta_tiempo: "", id_dieta_razon: "", id_dieta_apego: "",
    id_dieta_resultados: "", id_medicamentos_peso: null, id_medicamentos_cuales: "",
    nota_indicadores_dieteticos: "",
    ent_lesiones: "", ent_experiencia: "", ent_otro_ejercicio: "",
    ent_dias: "", ent_distribucion: "", nota_entrenamiento: "",
    comentarios_plan: "",
    seguimientos: [],
  };
}

export async function fetchHistoriaClinica(userId: string): Promise<HistoriaClinicaDatos | null> {
  const { data, error } = await supabase
    .from("historia_clinica")
    .select("datos")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.datos as HistoriaClinicaDatos) ?? null;
}

export async function saveHistoriaClinica(userId: string, datos: HistoriaClinicaDatos): Promise<void> {
  const { error } = await supabase
    .from("historia_clinica")
    .upsert(
      { user_id: userId, datos, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) throw error;
}
