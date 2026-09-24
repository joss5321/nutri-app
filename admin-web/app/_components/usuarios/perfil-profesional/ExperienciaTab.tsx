"use client";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createExperiencia,
  deleteExperiencia,
  updateExperiencia,
  type NutriologoExperiencia,
  type NutriologoExperienciaInput,
} from "@/app/_data/nutriologo_perfiles";
import ConfirmModal from "@/app/_components/ConfirmModal";
import { EmptyListState, FieldLabel, inputCls } from "./shared";

const BLANK: NutriologoExperienciaInput = {
  puesto: "", institucion: "", fecha_inicio: null, fecha_fin: null, actualidad: false, descripcion: null, orden: 0,
};

function formatFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

function ExperienciaForm({ value, onChange }: { value: NutriologoExperienciaInput; onChange: (v: NutriologoExperienciaInput) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Puesto *</FieldLabel>
          <input value={value.puesto} onChange={(e) => onChange({ ...value, puesto: e.target.value })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Institución *</FieldLabel>
          <input value={value.institucion} onChange={(e) => onChange({ ...value, institucion: e.target.value })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Fecha de inicio</FieldLabel>
          <input type="date" value={value.fecha_inicio ?? ""} onChange={(e) => onChange({ ...value, fecha_inicio: e.target.value || null })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Fecha de fin</FieldLabel>
          <input type="date" disabled={value.actualidad} value={value.fecha_fin ?? ""} onChange={(e) => onChange({ ...value, fecha_fin: e.target.value || null })} className={inputCls} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-text-primary">
        <input type="checkbox" checked={value.actualidad}
          onChange={(e) => onChange({ ...value, actualidad: e.target.checked, fecha_fin: e.target.checked ? null : value.fecha_fin })}
          className="w-4 h-4 accent-primary" />
        Actualmente trabaja aquí
      </label>
      <div>
        <FieldLabel>Descripción</FieldLabel>
        <textarea value={value.descripcion ?? ""} onChange={(e) => onChange({ ...value, descripcion: e.target.value || null })}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:border-primary" />
      </div>
    </div>
  );
}

export default function ExperienciaTab({
  nutriologoId,
  items,
  onChange,
  canEdit,
}: {
  nutriologoId: string;
  items: NutriologoExperiencia[];
  onChange: (next: NutriologoExperiencia[]) => void;
  canEdit: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NutriologoExperienciaInput>(BLANK);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<NutriologoExperiencia | null>(null);

  const startEdit = (item: NutriologoExperiencia) => {
    setEditingId(item.id);
    setCreating(false);
    const { id, nutriologo_id, created_at, ...input } = item;
    void id; void nutriologo_id; void created_at;
    setDraft(input);
    setError(null);
  };
  const startCreate = () => { setCreating(true); setEditingId(null); setDraft(BLANK); setError(null); };
  const cancel = () => { setEditingId(null); setCreating(false); setError(null); };

  const save = async () => {
    if (!draft.puesto.trim() || !draft.institucion.trim()) { setError("Puesto e institución son obligatorios."); return; }
    if (draft.fecha_fin && draft.fecha_inicio && draft.fecha_fin < draft.fecha_inicio) { setError("La fecha de fin no puede ser anterior a la de inicio."); return; }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await updateExperiencia(editingId, draft);
        onChange(items.map((i) => (i.id === editingId ? updated : i)));
      } else {
        const created = await createExperiencia(nutriologoId, { ...draft, orden: items.length });
        onChange([...items, created]);
      }
      setEditingId(null);
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la experiencia.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: NutriologoExperiencia) => {
    setConfirmDelete(null);
    try {
      await deleteExperiencia(item.id);
      onChange(items.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la experiencia.");
    }
  };

  return (
    <div className="space-y-4">
      {items.length === 0 && !creating && <EmptyListState text="Sin experiencia laboral registrada todavía." />}

      {items.map((item) =>
        editingId === item.id ? (
          <div key={item.id} className="border border-primary/30 bg-primary/5 rounded-xl p-4">
            <ExperienciaForm value={draft} onChange={setDraft} />
            {error && <p className="text-xs text-error mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={cancel} className="px-3 h-8 rounded-lg border border-border text-xs text-secondary hover:bg-background-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark disabled:opacity-50">
                <Check size={13} /> {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        ) : (
          <div key={item.id} className="border border-border rounded-xl p-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-text-primary text-sm">{item.puesto}</p>
              <p className="text-sm text-secondary">{item.institucion}</p>
              <p className="text-xs text-muted mt-1">
                {formatFecha(item.fecha_inicio)} — {item.actualidad ? "Actualidad" : formatFecha(item.fecha_fin)}
              </p>
              {item.descripcion && <p className="text-xs text-secondary mt-1">{item.descripcion}</p>}
            </div>
            {canEdit && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => startEdit(item)} aria-label="Editar experiencia" className="w-8 h-8 rounded-lg border border-border hover:border-primary hover:bg-primary/5 flex items-center justify-center text-secondary hover:text-primary"><Pencil size={13} /></button>
                <button onClick={() => setConfirmDelete(item)} aria-label="Eliminar experiencia" className="w-8 h-8 rounded-lg border border-error/30 hover:bg-error-soft flex items-center justify-center text-error"><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        )
      )}

      {creating && (
        <div className="border border-primary/30 bg-primary/5 rounded-xl p-4">
          <ExperienciaForm value={draft} onChange={setDraft} />
          {error && <p className="text-xs text-error mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={cancel} className="px-3 h-8 rounded-lg border border-border text-xs text-secondary hover:bg-background-secondary">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark disabled:opacity-50">
              <Check size={13} /> {saving ? "Guardando..." : "Agregar experiencia"}
            </button>
          </div>
        </div>
      )}

      {canEdit && !creating && (
        <button onClick={startCreate} className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
          <Plus size={15} /> Agregar experiencia
        </button>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar experiencia"
          message={`¿Eliminar "${confirmDelete.puesto}" en ${confirmDelete.institucion}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
