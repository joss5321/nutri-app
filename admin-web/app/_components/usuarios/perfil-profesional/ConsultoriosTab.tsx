"use client";
import { useState } from "react";
import { Check, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createConsultorio,
  deleteConsultorio,
  updateConsultorio,
  type NutriologoConsultorio,
  type NutriologoConsultorioInput,
} from "@/app/_data/nutriologo_perfiles";
import ConfirmModal from "@/app/_components/ConfirmModal";
import { EmptyListState, FieldLabel, inputCls } from "./shared";

const BLANK: NutriologoConsultorioInput = {
  nombre: null, direccion: null, colonia: null, alcaldia_municipio: null, ciudad: null, estado: null,
  codigo_postal: null, latitud: null, longitud: null, instrucciones_adicionales: null, orden: 0,
};

function ConsultorioForm({ value, onChange, error }: { value: NutriologoConsultorioInput; onChange: (v: NutriologoConsultorioInput) => void; error: string | null }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Nombre del consultorio</FieldLabel>
          <input value={value.nombre ?? ""} onChange={(e) => onChange({ ...value, nombre: e.target.value || null })} placeholder="Ej. Consultorio Centro" className={inputCls} />
        </div>
        <div>
          <FieldLabel>Dirección</FieldLabel>
          <input value={value.direccion ?? ""} onChange={(e) => onChange({ ...value, direccion: e.target.value || null })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Colonia</FieldLabel>
          <input value={value.colonia ?? ""} onChange={(e) => onChange({ ...value, colonia: e.target.value || null })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Alcaldía / Municipio</FieldLabel>
          <input value={value.alcaldia_municipio ?? ""} onChange={(e) => onChange({ ...value, alcaldia_municipio: e.target.value || null })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Ciudad</FieldLabel>
          <input value={value.ciudad ?? ""} onChange={(e) => onChange({ ...value, ciudad: e.target.value || null })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Estado</FieldLabel>
          <input value={value.estado ?? ""} onChange={(e) => onChange({ ...value, estado: e.target.value || null })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Código postal</FieldLabel>
          <input value={value.codigo_postal ?? ""} onChange={(e) => onChange({ ...value, codigo_postal: e.target.value || null })} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Latitud</FieldLabel>
            <input type="number" step="0.000001" value={value.latitud ?? ""} onChange={(e) => onChange({ ...value, latitud: e.target.value ? Number(e.target.value) : null })} className={inputCls} />
          </div>
          <div>
            <FieldLabel>Longitud</FieldLabel>
            <input type="number" step="0.000001" value={value.longitud ?? ""} onChange={(e) => onChange({ ...value, longitud: e.target.value ? Number(e.target.value) : null })} className={inputCls} />
          </div>
        </div>
      </div>
      <div>
        <FieldLabel>Instrucciones adicionales</FieldLabel>
        <textarea value={value.instrucciones_adicionales ?? ""} onChange={(e) => onChange({ ...value, instrucciones_adicionales: e.target.value || null })}
          placeholder="Ej. Piso 3, consultorio 302, estacionamiento disponible..."
          className="w-full border border-border rounded-xl px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:border-primary" />
      </div>
      <p className="text-xs text-muted">Por ahora solo se almacena esta información — sin integración de mapas todavía.</p>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

export default function ConsultoriosTab({
  nutriologoId,
  items,
  onChange,
  canEdit,
}: {
  nutriologoId: string;
  items: NutriologoConsultorio[];
  onChange: (next: NutriologoConsultorio[]) => void;
  canEdit: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NutriologoConsultorioInput>(BLANK);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<NutriologoConsultorio | null>(null);

  const startEdit = (item: NutriologoConsultorio) => {
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
    if (draft.latitud != null && (draft.latitud < -90 || draft.latitud > 90)) { setError("La latitud debe estar entre -90 y 90."); return; }
    if (draft.longitud != null && (draft.longitud < -180 || draft.longitud > 180)) { setError("La longitud debe estar entre -180 y 180."); return; }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await updateConsultorio(editingId, draft);
        onChange(items.map((i) => (i.id === editingId ? updated : i)));
      } else {
        const created = await createConsultorio(nutriologoId, { ...draft, orden: items.length });
        onChange([...items, created]);
      }
      setEditingId(null);
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el consultorio.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: NutriologoConsultorio) => {
    setConfirmDelete(null);
    try {
      await deleteConsultorio(item.id);
      onChange(items.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el consultorio.");
    }
  };

  return (
    <div className="space-y-4">
      {items.length === 0 && !creating && <EmptyListState text="Sin consultorios registrados todavía." />}

      {items.map((item) =>
        editingId === item.id ? (
          <div key={item.id} className="border border-primary/30 bg-primary/5 rounded-xl p-4">
            <ConsultorioForm value={draft} onChange={setDraft} error={error} />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={cancel} className="px-3 h-8 rounded-lg border border-border text-xs text-secondary hover:bg-background-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark disabled:opacity-50">
                <Check size={13} /> {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        ) : (
          <div key={item.id} className="border border-border rounded-xl p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><MapPin size={16} /></div>
              <div>
                <p className="font-bold text-text-primary text-sm">{item.nombre || "Consultorio"}</p>
                <p className="text-xs text-secondary mt-0.5">
                  {[item.direccion, item.colonia, item.ciudad, item.estado].filter(Boolean).join(", ") || "Sin dirección registrada"}
                </p>
                {item.instrucciones_adicionales && <p className="text-xs text-muted mt-1">{item.instrucciones_adicionales}</p>}
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => startEdit(item)} aria-label="Editar consultorio" className="w-8 h-8 rounded-lg border border-border hover:border-primary hover:bg-primary/5 flex items-center justify-center text-secondary hover:text-primary"><Pencil size={13} /></button>
                <button onClick={() => setConfirmDelete(item)} aria-label="Eliminar consultorio" className="w-8 h-8 rounded-lg border border-error/30 hover:bg-error-soft flex items-center justify-center text-error"><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        )
      )}

      {creating && (
        <div className="border border-primary/30 bg-primary/5 rounded-xl p-4">
          <ConsultorioForm value={draft} onChange={setDraft} error={error} />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={cancel} className="px-3 h-8 rounded-lg border border-border text-xs text-secondary hover:bg-background-secondary">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark disabled:opacity-50">
              <Check size={13} /> {saving ? "Guardando..." : "Agregar consultorio"}
            </button>
          </div>
        </div>
      )}

      {canEdit && !creating && (
        <button onClick={startCreate} className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
          <Plus size={15} /> Agregar consultorio
        </button>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar consultorio"
          message={`¿Eliminar "${confirmDelete.nombre || "este consultorio"}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
