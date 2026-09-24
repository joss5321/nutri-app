"use client";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createServicio,
  deleteServicio,
  updateServicio,
  type Modalidad,
  type NutriologoServicio,
  type NutriologoServicioInput,
} from "@/app/_data/nutriologo_perfiles";
import ConfirmModal from "@/app/_components/ConfirmModal";
import { EmptyListState, FieldLabel, inputCls } from "./shared";

const MODALIDADES: { value: Modalidad; label: string }[] = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "En línea" },
  { value: "ambas", label: "Ambas" },
];

const BLANK: NutriologoServicioInput = {
  nombre: "", descripcion: null, precio: 0, moneda: "MXN", duracion_min: null,
  modalidad: "ambas", incluye: [], activo: true, orden: 0,
};

function formatMXN(precio: number, moneda: string): string {
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda || "MXN" }).format(precio);
  } catch {
    return `$${precio.toFixed(2)} ${moneda}`;
  }
}

function ServicioForm({ value, onChange }: { value: NutriologoServicioInput; onChange: (v: NutriologoServicioInput) => void }) {
  const [incluyeInput, setIncluyeInput] = useState("");
  const addIncluye = () => {
    const v = incluyeInput.trim();
    if (!v) return;
    onChange({ ...value, incluye: [...value.incluye, v] });
    setIncluyeInput("");
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Nombre del servicio *</FieldLabel>
          <input value={value.nombre} onChange={(e) => onChange({ ...value, nombre: e.target.value })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Modalidad</FieldLabel>
          <select value={value.modalidad} onChange={(e) => onChange({ ...value, modalidad: e.target.value as Modalidad })} className={inputCls}>
            {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Precio (MXN)</FieldLabel>
          <input type="number" min={0} step="0.01" value={value.precio} onChange={(e) => onChange({ ...value, precio: Number(e.target.value) || 0 })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Duración (min)</FieldLabel>
          <input type="number" min={1} value={value.duracion_min ?? ""} onChange={(e) => onChange({ ...value, duracion_min: e.target.value ? Number(e.target.value) : null })} className={inputCls} />
        </div>
      </div>
      <div>
        <FieldLabel>Descripción</FieldLabel>
        <textarea value={value.descripcion ?? ""} onChange={(e) => onChange({ ...value, descripcion: e.target.value || null })}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:border-primary" />
      </div>
      <div>
        <FieldLabel>Qué incluye</FieldLabel>
        <div className="flex flex-wrap gap-1.5 border border-border rounded-xl px-3 py-2 min-h-10">
          {value.incluye.map((item, i) => (
            <span key={i} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
              {item}
              <button type="button" onClick={() => onChange({ ...value, incluye: value.incluye.filter((_, idx) => idx !== i) })}><X size={11} /></button>
            </span>
          ))}
          <input value={incluyeInput} onChange={(e) => setIncluyeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addIncluye(); } }}
            placeholder="Agregar y Enter..." className="text-xs focus:outline-none bg-transparent flex-1 min-w-24" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-text-primary">
        <input type="checkbox" checked={value.activo} onChange={(e) => onChange({ ...value, activo: e.target.checked })} className="w-4 h-4 accent-primary" />
        Servicio activo (visible en directorio)
      </label>
    </div>
  );
}

export default function ServiciosTab({
  nutriologoId,
  items,
  onChange,
  canEdit,
}: {
  nutriologoId: string;
  items: NutriologoServicio[];
  onChange: (next: NutriologoServicio[]) => void;
  canEdit: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NutriologoServicioInput>(BLANK);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<NutriologoServicio | null>(null);

  const startEdit = (item: NutriologoServicio) => {
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
    if (!draft.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await updateServicio(editingId, draft);
        onChange(items.map((i) => (i.id === editingId ? updated : i)));
      } else {
        const created = await createServicio(nutriologoId, { ...draft, orden: items.length });
        onChange([...items, created]);
      }
      setEditingId(null);
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el servicio.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: NutriologoServicio) => {
    setConfirmDelete(null);
    try {
      await deleteServicio(item.id);
      onChange(items.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el servicio.");
    }
  };

  return (
    <div className="space-y-4">
      {items.length === 0 && !creating && <EmptyListState text="Sin servicios registrados todavía." />}

      {items.map((item) =>
        editingId === item.id ? (
          <div key={item.id} className="border border-primary/30 bg-primary/5 rounded-xl p-4">
            <ServicioForm value={draft} onChange={setDraft} />
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
              <div className="flex items-center gap-2">
                <p className="font-bold text-text-primary text-sm">{item.nombre}</p>
                {!item.activo && <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-muted text-muted font-semibold">Inactivo</span>}
              </div>
              <p className="text-sm text-primary font-semibold mt-0.5">{formatMXN(item.precio, item.moneda)}{item.duracion_min ? ` · ${item.duracion_min} min` : ""} · <span className="capitalize">{item.modalidad}</span></p>
              {item.descripcion && <p className="text-xs text-secondary mt-1">{item.descripcion}</p>}
              {item.incluye.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.incluye.map((inc, i) => <span key={i} className="text-[11px] bg-surface-muted text-secondary px-2 py-0.5 rounded-full">{inc}</span>)}
                </div>
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => startEdit(item)} aria-label="Editar servicio" className="w-8 h-8 rounded-lg border border-border hover:border-primary hover:bg-primary/5 flex items-center justify-center text-secondary hover:text-primary"><Pencil size={13} /></button>
                <button onClick={() => setConfirmDelete(item)} aria-label="Eliminar servicio" className="w-8 h-8 rounded-lg border border-error/30 hover:bg-error-soft flex items-center justify-center text-error"><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        )
      )}

      {creating && (
        <div className="border border-primary/30 bg-primary/5 rounded-xl p-4">
          <ServicioForm value={draft} onChange={setDraft} />
          {error && <p className="text-xs text-error mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={cancel} className="px-3 h-8 rounded-lg border border-border text-xs text-secondary hover:bg-background-secondary">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark disabled:opacity-50">
              <Check size={13} /> {saving ? "Guardando..." : "Agregar servicio"}
            </button>
          </div>
        </div>
      )}

      {canEdit && !creating && (
        <button onClick={startCreate} className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
          <Plus size={15} /> Agregar servicio
        </button>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar servicio"
          message={`¿Eliminar el servicio "${confirmDelete.nombre}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
