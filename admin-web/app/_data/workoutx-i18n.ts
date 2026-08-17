/**
 * Traducciones para el vocabulario fijo de WorkoutX.
 * Los valores en la BD están en inglés (tal como los devuelve la API).
 * Estas tablas se usan solo en la UI — no modifican los datos almacenados.
 */

export const DIFFICULTY_ES: Record<string, string> = {
  beginner:     "Principiante",
  intermediate: "Intermedio",
  advanced:     "Avanzado",
};

export const BODY_PART_ES: Record<string, string> = {
  back:         "Espalda",
  cardio:       "Cardio",
  chest:        "Pecho",
  "lower arms": "Antebrazos",
  "lower legs": "Pantorrillas",
  neck:         "Cuello",
  shoulders:    "Hombros",
  "upper arms": "Brazos",
  "upper legs": "Piernas",
  waist:        "Abdomen",
};

export const MUSCLE_ES: Record<string, string> = {
  abductors:                "Abductores",
  abs:                      "Abdominales",
  adductors:                "Aductores",
  biceps:                   "Bíceps",
  calves:                   "Pantorrillas",
  "cardiovascular system":  "Sistema cardiovascular",
  chest:                    "Pecho",
  delts:                    "Deltoides",
  forearms:                 "Antebrazos",
  glutes:                   "Glúteos",
  hamstrings:               "Isquiotibiales",
  lats:                     "Dorsales",
  "levator scapulae":       "Elevador escápula",
  "lower back":             "Lumbar",
  quads:                    "Cuádriceps",
  "serratus anterior":      "Serrato anterior",
  spine:                    "Columna",
  traps:                    "Trapecios",
  triceps:                  "Tríceps",
  "upper back":             "Espalda alta",
};

export const EQUIPMENT_ES: Record<string, string> = {
  assisted:               "Asistido",
  band:                   "Banda",
  barbell:                "Barra",
  "body weight":          "Peso corporal",
  "bosu ball":            "Bosu",
  cable:                  "Cable",
  dumbbell:               "Mancuernas",
  "elliptical machine":   "Elíptica",
  "ez barbell":           "Barra EZ",
  kettlebell:             "Kettlebell",
  "leverage machine":     "Máquina",
  "medicine ball":        "Balón medicinal",
  "olympic barbell":      "Barra olímpica",
  "resistance band":      "Banda elástica",
  roller:                 "Rodillo",
  rope:                   "Cuerda",
  "skierg machine":       "Ski Erg",
  sled:                   "Trineo",
  "smith machine":        "Máquina Smith",
  "stability ball":       "Balón de estabilidad",
  "stationary bike":      "Bicicleta estática",
  "stepmill machine":     "Escaladora",
  tire:                   "Neumático",
  "trap bar":             "Barra trap",
  "upper body ergometer": "Ergómetro",
  weighted:               "Con peso",
  "wheel roller":         "Rueda abdominal",
};

export const CATEGORY_ES: Record<string, string> = {
  cardio:                    "Cardio",
  "olympic weightlifting":   "Levantamiento olímpico",
  plyometrics:               "Pliométrico",
  powerlifting:              "Powerlifting",
  strength:                  "Fuerza",
  stretching:                "Estiramiento",
};

export const MECHANIC_ES: Record<string, string> = {
  compound:  "Compuesto",
  isolation: "Aislamiento",
};

export const FORCE_ES: Record<string, string> = {
  pull:   "Jalón",
  push:   "Empuje",
  static: "Estático",
};

/**
 * Traduce un valor usando el mapa dado.
 * Si no hay traducción, devuelve el valor original capitalizado.
 * Acepta null/undefined y devuelve cadena vacía.
 */
export function tx(
  map: Record<string, string>,
  value: string | null | undefined,
): string {
  if (!value) return "";
  const key = value.toLowerCase();
  return map[key] ?? (value.charAt(0).toUpperCase() + value.slice(1));
}
