"use client";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { fetchTodasRecetasCatalogo, vincularIngrediente, type Receta, type RecetaIngrediente } from "@/app/_data/recetas";
import { fetchAlimentos, type Alimento } from "@/app/_data/alimentos";
import { suggestAlimento } from "@/app/_utils/ingredienteMatch";

type PendingRow = {
  ingrediente: RecetaIngrediente;
  recetaNombre: string;
  recetaEmoji: string | null;
};

function IngredienteRow({
  row,
  alimentos,
  onLinked,
  onSkip,
}: {
  row: PendingRow;
  alimentos: Alimento[];
  onLinked: (ingredienteId: string) => void;
  onSkip: (ingredienteId: string) => void;
}) {
  const sugerido = useMemo(
    () => suggestAlimento(row.ingrediente.descripcion, alimentos),
    [row.ingrediente.descripcion, alimentos]
  );
  const [query, setQuery] = useState(sugerido?.nombre ?? "");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Alimento | null>(sugerido);
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return alimentos.filter((a) => a.nombre.toLowerCase().includes(q)).slice(0, 8);
  }, [query, alimentos]);

  const handlePick = (al: Alimento) => {
    setSelected(al);
    setQuery(al.nombre);
    setOpen(false);
  };

  const handleVincular = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await vincularIngrediente(row.ingrediente.id, selected.id);
      onLinked(row.ingrediente.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo vincular.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-[1fr_minmax(0,300px)_auto] gap-3 items-center px-4 py-2.5 border-b border-divider hover:bg-background-secondary/50">
      <div className="min-w-0">
        <p className="text-[11px] text-muted truncate">{row.recetaEmoji} {row.recetaNombre}</p>
        <p className="text-sm text-text-primary truncate" title={row.ingrediente.descripcion}>{row.ingrediente.descripcion}</p>
        <p className="text-[10px] text-muted">{row.ingrediente.cantidad} {row.ingrediente.unidad}</p>
      </div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar alimento..."
          className={`w-full h-9 border rounded-xl px-3 text-sm focus:outline-none ${
            selected ? "border-success/40 bg-success-soft text-success" : "border-border focus:border-primary"
          }`}
        />
        {open && suggestions.length > 0 && (
          <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((al) => (
              <button
                key={al.id}
                onMouseDown={() => handlePick(al)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 hover:text-primary flex items-center justify-between gap-2"
              >
                <span className="truncate">{al.nombre}</span>
                <span className="text-xs text-muted shrink-0">{al.kcal != null ? `${al.kcal} kcal` : ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleVincular}
          disabled={!selected || saving}
          className="h-9 px-3 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-dark disabled:opacity-40"
        >
          {saving ? "..." : "Vincular"}
        </button>
        <button
          onClick={() => onSkip(row.ingrediente.id)}
          className="h-9 px-2 rounded-xl border border-border text-muted text-xs hover:bg-background-secondary"
        >
          Omitir
        </button>
      </div>
    </div>
  );
}

export default function VincularIngredientesModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([fetchTodasRecetasCatalogo(), fetchAlimentos()])
      .then(([r, a]) => { setRecetas(r); setAlimentos(a); })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar."))
      .finally(() => setLoading(false));
  }, []);

  const pending: PendingRow[] = useMemo(() => {
    const rows: PendingRow[] = [];
    for (const r of recetas) {
      for (const ing of r.ingredientes) {
        if (ing.cantidad == null || ing.alimento_id || resolvedIds.has(ing.id)) continue;
        rows.push({ ingrediente: ing, recetaNombre: r.nombre, recetaEmoji: r.emoji });
      }
    }
    return rows;
  }, [recetas, resolvedIds]);

  const filtered = pending.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return row.recetaNombre.toLowerCase().includes(q) || row.ingrediente.descripcion.toLowerCase().includes(q);
  });

  const markResolved = (ingredienteId: string) => {
    setResolvedIds((prev) => new Set(prev).add(ingredienteId));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-divider">
          <div>
            <h2 className="font-bold text-text-primary text-xl">Vincular ingredientes al catálogo</h2>
            <p className="text-secondary text-sm mt-1">
              {loading
                ? "Cargando..."
                : `${pending.length} ingrediente${pending.length !== 1 ? "s" : ""} con cantidad definida, sin vincular todavía.`}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-surface-muted flex items-center justify-center text-muted"><X size={18} /></button>
        </div>

        {!loading && !error && (
          <div className="px-6 py-3 border-b border-divider">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por receta o ingrediente..."
              className="w-full h-9 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-sm text-muted text-center py-10">Cargando ingredientes...</p>}
          {error && <p className="text-sm text-error text-center py-10">{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="text-sm text-muted text-center py-10">
              {pending.length === 0
                ? "¡Todos los ingredientes con cantidad ya están vinculados!"
                : "Sin resultados para ese filtro."}
            </p>
          )}
          {!loading && !error && filtered.map((row) => (
            <IngredienteRow
              key={row.ingrediente.id}
              row={row}
              alimentos={alimentos}
              onLinked={markResolved}
              onSkip={markResolved}
            />
          ))}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-divider">
          <p className="text-xs text-muted">
            Al vincular, recuerda correr &ldquo;Recalcular calorías&rdquo; para aplicar los cambios.
          </p>
          <button onClick={onClose} className="px-5 h-10 rounded-xl border border-border text-secondary text-sm hover:bg-background-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
