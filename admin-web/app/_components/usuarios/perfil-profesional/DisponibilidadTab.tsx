"use client";
import { useEffect, useState } from "react";
import { upsertDisponibilidadDia, type NutriologoDisponibilidad } from "@/app/_data/nutriologo_perfiles";
import { SectionSaveBar, type SaveState } from "./shared";

const DIAS = [
  { n: 1, label: "Lunes" }, { n: 2, label: "Martes" }, { n: 3, label: "Miércoles" },
  { n: 4, label: "Jueves" }, { n: 5, label: "Viernes" }, { n: 6, label: "Sábado" }, { n: 7, label: "Domingo" },
] as const;

type DiaDraft = { disponible: boolean; hora_inicio: string | null; hora_fin: string | null };

function buildDraft(items: NutriologoDisponibilidad[]): Record<number, DiaDraft> {
  const byDia = new Map(items.map((i) => [i.dia_semana, i]));
  const draft: Record<number, DiaDraft> = {};
  for (const d of DIAS) {
    const existing = byDia.get(d.n);
    draft[d.n] = existing
      ? { disponible: existing.disponible, hora_inicio: existing.hora_inicio, hora_fin: existing.hora_fin }
      : { disponible: false, hora_inicio: "09:00", hora_fin: "18:00" };
  }
  return draft;
}

export default function DisponibilidadTab({
  nutriologoId,
  items,
  onChange,
  canEdit,
  onDirtyChange,
}: {
  nutriologoId: string;
  items: NutriologoDisponibilidad[];
  onChange: (next: NutriologoDisponibilidad[]) => void;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState(() => buildDraft(items));
  const [draft, setDraft] = useState(() => buildDraft(items));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const setDia = (n: number, patch: Partial<DiaDraft>) =>
    setDraft((prev) => ({ ...prev, [n]: { ...prev[n], ...patch } }));

  const handleSave = async () => {
    for (const d of DIAS) {
      const v = draft[d.n];
      if (v.disponible && (!v.hora_inicio || !v.hora_fin || v.hora_inicio >= v.hora_fin)) {
        setError(`${d.label}: la hora de inicio debe ser anterior a la hora de fin.`);
        setSaveState("error");
        return;
      }
    }
    setSaveState("saving");
    setError(null);
    try {
      const results: NutriologoDisponibilidad[] = [];
      for (const d of DIAS) {
        const v = draft[d.n];
        const saved = await upsertDisponibilidadDia(nutriologoId, d.n, {
          disponible: v.disponible,
          hora_inicio: v.disponible ? v.hora_inicio : null,
          hora_fin: v.disponible ? v.hora_fin : null,
        });
        results.push(saved);
      }
      onChange(results);
      setSaved(draft);
      setSaveState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la disponibilidad.");
      setSaveState("error");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Disponibilidad general por día de la semana — todavía no es una agenda de citas real.</p>
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-divider">
        {DIAS.map((d) => {
          const v = draft[d.n];
          return (
            <div key={d.n} className="flex items-center gap-4 px-4 py-3">
              <label className="flex items-center gap-2 w-32 shrink-0">
                <input disabled={!canEdit} type="checkbox" checked={v.disponible} onChange={(e) => setDia(d.n, { disponible: e.target.checked })} className="w-4 h-4 accent-primary" />
                <span className="text-sm font-semibold text-text-primary">{d.label}</span>
              </label>
              {v.disponible ? (
                <div className="flex items-center gap-2">
                  <input disabled={!canEdit} type="time" value={v.hora_inicio ?? ""} onChange={(e) => setDia(d.n, { hora_inicio: e.target.value })}
                    className="h-9 border border-border rounded-lg px-2 text-sm focus:outline-none focus:border-primary disabled:bg-background-secondary" />
                  <span className="text-muted text-sm">—</span>
                  <input disabled={!canEdit} type="time" value={v.hora_fin ?? ""} onChange={(e) => setDia(d.n, { hora_fin: e.target.value })}
                    className="h-9 border border-border rounded-lg px-2 text-sm focus:outline-none focus:border-primary disabled:bg-background-secondary" />
                </div>
              ) : (
                <span className="text-sm text-muted">No disponible</span>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && <SectionSaveBar dirty={dirty} state={saveState} errorMessage={error} onSave={handleSave} />}
    </div>
  );
}
