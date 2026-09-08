"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { fetchGifCatalog, searchGifCatalog, type CatalogGifItem } from "@/app/_data/exercise-gifs-catalog";
import { MUSCLE_ES, EQUIPMENT_ES, tx } from "@/app/_data/workoutx-i18n";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 20;

export default function GifCatalogModal({
  onSelect,
  onClose,
}: {
  onSelect: (item: CatalogGifItem) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<CatalogGifItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    fetchGifCatalog()
      .then(setItems)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const results = useMemo(() => {
    if (!items || debouncedQuery.trim().length < MIN_QUERY_LENGTH) return [];
    return searchGifCatalog(items, debouncedQuery, MAX_RESULTS);
  }, [items, debouncedQuery]);

  const showHint = debouncedQuery.trim().length < MIN_QUERY_LENGTH;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-divider">
          <div>
            <h3 className="font-bold text-text-primary text-base">Buscar GIF en catálogo</h3>
            <p className="text-xs text-secondary mt-0.5">ExerciseGymGifsDB — 1,323 ejercicios</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-muted flex items-center justify-center text-muted">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 border-b border-divider">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ejercicio..."
              className="w-full h-10 border border-border rounded-xl pl-9 pr-3 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loadError ? (
            <div className="text-center py-8">
              <p className="text-sm text-error font-medium">No fue posible cargar el catálogo de GIFs.</p>
              <p className="text-xs text-muted mt-1">Puedes subir un GIF manualmente.</p>
            </div>
          ) : !items ? (
            <p className="text-sm text-muted text-center py-8">Cargando catálogo...</p>
          ) : showHint ? (
            <p className="text-sm text-muted text-center py-8">Escribe al menos {MIN_QUERY_LENGTH} caracteres para buscar.</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">Sin resultados para &quot;{debouncedQuery}&quot;.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((item) => (
                <div key={item.id} className="flex items-center gap-3 border border-border rounded-xl p-2">
                  <div className="w-14 h-14 rounded-lg bg-ink overflow-hidden shrink-0 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.gifUrl} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary truncate">{item.name}</p>
                    <p className="text-xs text-muted truncate">
                      {tx(MUSCLE_ES, item.muscle)} · {tx(EQUIPMENT_ES, item.equipment)}
                    </p>
                  </div>
                  <button
                    onClick={() => onSelect(item)}
                    className="shrink-0 px-3 h-8 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark"
                  >
                    Seleccionar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
