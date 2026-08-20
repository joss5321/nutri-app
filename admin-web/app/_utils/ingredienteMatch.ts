import type { Alimento } from "@/app/_data/alimentos";

const UNIDAD_WORDS = [
  "pzas?", "piezas?", "tza", "cdas?", "cditas?", "rebanadas?",
  "dientes?", "latas?", "paquetes?", "sobres?", "g", "ml",
];
const LEADING_QTY_RE = new RegExp(
  `^[\\s]*[\\d.,/½¼¾⅓⅔⅛]+\\s*(${UNIDAD_WORDS.join("|")})?\\s*(\\([^)]*\\))?\\s*(de\\s+)?`,
  "i"
);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrae el nombre "núcleo" de un ingrediente a partir de su descripción libre,
 * quitando la cantidad/unidad inicial y cualquier paréntesis final.
 * Es una heurística para sugerir una coincidencia, no una fuente de verdad —
 * el usuario siempre confirma o corrige la sugerencia.
 */
export function extractCoreName(descripcion: string): string {
  return descripcion
    .replace(LEADING_QTY_RE, "")
    .replace(/\([^)]*\)/g, "")
    .split(/[,+]| al gusto| opcional/i)[0]
    .trim();
}

/**
 * Sugiere el alimento del catálogo más parecido al núcleo del ingrediente,
 * por coincidencia de palabras (normalizadas, sin acentos). Devuelve null si
 * ningún alimento comparte al menos una palabra — mejor no sugerir nada que
 * sugerir algo irrelevante.
 */
export function suggestAlimento(descripcion: string, alimentos: Alimento[]): Alimento | null {
  const core = normalize(extractCoreName(descripcion));
  if (!core) return null;
  const coreWords = core.split(" ").filter((w) => w.length > 2);
  if (coreWords.length === 0) return null;

  let best: Alimento | null = null;
  let bestScore = 0;
  for (const al of alimentos) {
    const nombre = normalize(al.nombre);
    const score = coreWords.filter((w) => nombre.includes(w)).length;
    if (score > bestScore || (score === bestScore && best && al.nombre.length < best.nombre.length)) {
      best = al;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}
