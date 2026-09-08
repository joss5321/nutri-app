/**
 * Catálogo externo de GIFs de ejercicios — ExerciseGymGifsDB.
 *
 * API estática (solo JSON + GIFs) servida vía jsDelivr desde
 * https://github.com/JahelCuadrado/ExerciseGymGifsDB. Fijamos el tag
 * v1.1.0 (no @main) para que una URL guardada en `ejercicios.gif_url` hoy
 * nunca deje de resolver si el repo cambia de archivos más adelante.
 *
 * Usamos el endpoint /api/es/search.json: 1323 ejercicios ya en español,
 * cada uno con su `gifUrl` embebido — no hace falta ningún fetch adicional
 * por resultado, ni descargar/rehospedar el GIF (se referencia tal cual).
 */

const CATALOG_BASE = "https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0";
const SEARCH_ENDPOINT = `${CATALOG_BASE}/api/es/search.json`;

export type CatalogGifItem = {
  id: string;
  slug: string;
  name: string;
  muscle: string;
  bodyPart: string;
  equipment: string;
  category: string;
  secondaryMuscles: string[];
  gifUrl: string;
  terms: string[];
};

type SearchIndex = {
  language: string;
  count: number;
  items: CatalogGifItem[];
};

// Cache a nivel de módulo — el índice (~1MB) se descarga una sola vez por
// carga de página, sin importar cuántas veces se abra el buscador o para
// cuántos ejercicios distintos se use.
let cachedPromise: Promise<CatalogGifItem[]> | null = null;

export function fetchGifCatalog(): Promise<CatalogGifItem[]> {
  if (!cachedPromise) {
    cachedPromise = fetch(SEARCH_ENDPOINT)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SearchIndex>;
      })
      .then((data) => data.items)
      .catch((err) => {
        // No cachear el fallo: un reintento posterior (reabrir el modal)
        // puede tener éxito si fue un problema de red pasajero.
        cachedPromise = null;
        throw err;
      });
  }
  return cachedPromise;
}

const DIACRITICS_RE = new RegExp("[̀-ͯ]", "g");

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_RE, "");
}

/** Texto de búsqueda de un ejercicio: nombre, slug/id, músculo, equipamiento + sinónimos ya generados por el catálogo. */
function haystack(item: CatalogGifItem): string {
  return normalize(
    [item.name, item.slug, item.id, item.muscle, item.bodyPart, item.equipment, item.category, ...item.terms].join(" ")
  );
}

/** Todas las palabras de la búsqueda deben aparecer en el texto del ejercicio (orden libre). */
export function searchGifCatalog(items: CatalogGifItem[], query: string, limit = 20): CatalogGifItem[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const results: CatalogGifItem[] = [];
  for (const item of items) {
    const text = haystack(item);
    if (words.every((w) => text.includes(w))) {
      results.push(item);
      if (results.length >= limit) break;
    }
  }
  return results;
}
