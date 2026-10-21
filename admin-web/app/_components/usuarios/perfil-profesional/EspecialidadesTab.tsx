"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  addNutriologoEspecialidad,
  fetchEspecialidadesCatalogo,
  removeNutriologoEspecialidad,
  type Especialidad,
} from "@/app/_data/nutriologo_perfiles";
import { EmptyListState } from "./shared";

export default function EspecialidadesTab({
  nutriologoId,
  seleccionadas,
  onChange,
  canEdit,
}: {
  nutriologoId: string;
  seleccionadas: Especialidad[];
  onChange: (next: Especialidad[]) => void;
  canEdit: boolean;
}) {
  const [catalogo, setCatalogo] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCatalogo = () => {
    setLoading(true);
    setLoadError(null);
    fetchEspecialidadesCatalogo()
      .then(setCatalogo)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "No se pudo cargar el catálogo de especialidades."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Se difiere a un microtask porque `loadCatalogo` llama a setState de
    // forma síncrona al iniciar (setLoading/setLoadError), y la regla
    // react-hooks/set-state-in-effect exige que esas llamadas ocurran
    // dentro de un callback, no directamente en el cuerpo del efecto.
    queueMicrotask(loadCatalogo);
  }, []);

  const seleccionadasIds = new Set(seleccionadas.map((e) => e.id));

  const handleAdd = async (esp: Especialidad) => {
    setBusy(esp.id);
    setError(null);
    try {
      await addNutriologoEspecialidad(nutriologoId, esp.id);
      onChange([...seleccionadas, esp].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar la especialidad.");
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (esp: Especialidad) => {
    setBusy(esp.id);
    setError(null);
    try {
      await removeNutriologoEspecialidad(nutriologoId, esp.id);
      onChange(seleccionadas.filter((e) => e.id !== esp.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la especialidad.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-sm text-muted text-center py-10">Cargando catálogo...</p>;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <p className="text-sm text-error">{loadError}</p>
        <button type="button" onClick={loadCatalogo} className="text-sm text-primary font-semibold hover:underline">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-bold text-text-primary mb-2">Especialidades seleccionadas</p>
        {seleccionadas.length === 0 ? (
          <EmptyListState text="Este nutriólogo aún no tiene especialidades asignadas." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {seleccionadas.map((e) => (
              <span key={e.id} className="flex items-center gap-1.5 bg-primary/10 text-primary text-sm px-3 py-1.5 rounded-full font-medium">
                {e.nombre}
                {canEdit && (
                  <button type="button" onClick={() => handleRemove(e)} disabled={busy === e.id} aria-label={`Quitar ${e.nombre}`}
                    className="hover:text-primary-dark disabled:opacity-40">
                    <X size={13} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </section>

      {canEdit && (
        <section>
          <p className="text-sm font-bold text-text-primary mb-2">Catálogo disponible</p>
          <div className="flex flex-wrap gap-2">
            {catalogo.filter((e) => !seleccionadasIds.has(e.id)).map((e) => (
              <button key={e.id} type="button" onClick={() => handleAdd(e)} disabled={busy === e.id}
                className="text-sm text-secondary bg-surface-muted hover:bg-primary/10 hover:text-primary px-3 py-1.5 rounded-full disabled:opacity-40">
                + {e.nombre}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <p className="text-xs text-error">{error}</p>}
      <p className="text-xs text-muted">Los cambios aquí se guardan de inmediato, no hace falta un botón adicional.</p>
    </div>
  );
}
