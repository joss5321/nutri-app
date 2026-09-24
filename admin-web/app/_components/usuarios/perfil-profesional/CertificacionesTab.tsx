"use client";
import { useState } from "react";
import { Award, Check, ExternalLink, FileText, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  createCertificacion,
  deleteCertificacion,
  getCertificacionSignedUrl,
  updateCertificacion,
  type NutriologoCertificacion,
  type NutriologoCertificacionInput,
} from "@/app/_data/nutriologo_perfiles";
import ConfirmModal from "@/app/_components/ConfirmModal";
import { EmptyListState, FieldLabel, inputCls } from "./shared";

const BLANK: NutriologoCertificacionInput = { nombre: "", institucion: "", anio: null, descripcion: null, orden: 0 };

function CertificacionForm({
  value, onChange, file, onFileChange, existingPath,
}: {
  value: NutriologoCertificacionInput;
  onChange: (v: NutriologoCertificacionInput) => void;
  file: File | null;
  onFileChange: (f: File | null) => void;
  existingPath: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Nombre *</FieldLabel>
          <input value={value.nombre} onChange={(e) => onChange({ ...value, nombre: e.target.value })} placeholder="Ej. Diplomado en Nutrición Deportiva" className={inputCls} />
        </div>
        <div>
          <FieldLabel>Institución *</FieldLabel>
          <input value={value.institucion} onChange={(e) => onChange({ ...value, institucion: e.target.value })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Año</FieldLabel>
          <input type="number" value={value.anio ?? ""} onChange={(e) => onChange({ ...value, anio: e.target.value ? Number(e.target.value) : null })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Documento {existingPath && !file && <span className="text-muted">(ya hay uno cargado)</span>}</FieldLabel>
          <label className="flex items-center gap-1.5 h-10 border border-border rounded-xl px-3 text-xs font-semibold text-text-primary hover:bg-background-secondary cursor-pointer">
            <Upload size={13} /> {file ? file.name : existingPath ? "Reemplazar documento" : "Subir documento (PDF/imagen)"}
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </div>
      <div>
        <FieldLabel>Descripción</FieldLabel>
        <textarea value={value.descripcion ?? ""} onChange={(e) => onChange({ ...value, descripcion: e.target.value || null })}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:border-primary" />
      </div>
      <p className="text-xs text-muted">El documento se guarda en un bucket privado — nunca es público. Solo tú o superAdmin pueden verlo, mediante un enlace temporal.</p>
    </div>
  );
}

export default function CertificacionesTab({
  nutriologoId,
  items,
  onChange,
  canEdit,
}: {
  nutriologoId: string;
  items: NutriologoCertificacion[];
  onChange: (next: NutriologoCertificacion[]) => void;
  canEdit: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NutriologoCertificacionInput>(BLANK);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<NutriologoCertificacion | null>(null);
  const [loadingUrlId, setLoadingUrlId] = useState<string | null>(null);

  const startEdit = (item: NutriologoCertificacion) => {
    setEditingId(item.id);
    setCreating(false);
    setDraft({ nombre: item.nombre, institucion: item.institucion, anio: item.anio, descripcion: item.descripcion, orden: item.orden });
    setDraftFile(null);
    setError(null);
  };
  const startCreate = () => { setCreating(true); setEditingId(null); setDraft(BLANK); setDraftFile(null); setError(null); };
  const cancel = () => { setEditingId(null); setCreating(false); setDraftFile(null); setError(null); };

  const save = async () => {
    if (!draft.nombre.trim() || !draft.institucion.trim()) { setError("Nombre e institución son obligatorios."); return; }
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      if (editingId) {
        const current = items.find((i) => i.id === editingId)!;
        const { certificacion, cleanupWarning } = await updateCertificacion(current, draft, draftFile);
        onChange(items.map((i) => (i.id === editingId ? certificacion : i)));
        if (cleanupWarning) setWarning(`Se guardó correctamente, pero no se pudo eliminar el documento anterior: ${cleanupWarning}`);
      } else {
        const created = await createCertificacion(nutriologoId, { ...draft, orden: items.length }, draftFile);
        onChange([...items, created]);
      }
      setEditingId(null);
      setCreating(false);
      setDraftFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la certificación.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: NutriologoCertificacion) => {
    setConfirmDelete(null);
    try {
      await deleteCertificacion(item);
      onChange(items.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la certificación.");
    }
  };

  const handleViewDocumento = async (item: NutriologoCertificacion) => {
    if (!item.documento_storage_path) return;
    setLoadingUrlId(item.id);
    try {
      const url = await getCertificacionSignedUrl(item.documento_storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el enlace del documento.");
    } finally {
      setLoadingUrlId(null);
    }
  };

  return (
    <div className="space-y-4">
      {warning && <p className="text-xs text-warning bg-warning-soft border border-warning/30 rounded-xl px-3 py-2">{warning}</p>}
      {items.length === 0 && !creating && <EmptyListState text="Sin certificaciones registradas todavía." />}

      {items.map((item) =>
        editingId === item.id ? (
          <div key={item.id} className="border border-primary/30 bg-primary/5 rounded-xl p-4">
            <CertificacionForm value={draft} onChange={setDraft} file={draftFile} onFileChange={setDraftFile} existingPath={item.documento_storage_path} />
            {error && <p className="text-xs text-error mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={cancel} className="px-3 h-8 rounded-lg border border-border text-xs text-secondary hover:bg-background-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        ) : (
          <div key={item.id} className="border border-border rounded-xl p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><Award size={16} /></div>
              <div>
                <p className="font-bold text-text-primary text-sm">{item.nombre}</p>
                <p className="text-xs text-secondary">{item.institucion}{item.anio ? ` · ${item.anio}` : ""}</p>
                {item.descripcion && <p className="text-xs text-muted mt-1">{item.descripcion}</p>}
                {item.documento_storage_path && (
                  <button onClick={() => handleViewDocumento(item)} disabled={loadingUrlId === item.id}
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline mt-1.5 disabled:opacity-50">
                    {loadingUrlId === item.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                    Ver documento <ExternalLink size={10} />
                  </button>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => startEdit(item)} aria-label="Editar certificación" className="w-8 h-8 rounded-lg border border-border hover:border-primary hover:bg-primary/5 flex items-center justify-center text-secondary hover:text-primary"><Pencil size={13} /></button>
                <button onClick={() => setConfirmDelete(item)} aria-label="Eliminar certificación" className="w-8 h-8 rounded-lg border border-error/30 hover:bg-error-soft flex items-center justify-center text-error"><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        )
      )}

      {creating && (
        <div className="border border-primary/30 bg-primary/5 rounded-xl p-4">
          <CertificacionForm value={draft} onChange={setDraft} file={draftFile} onFileChange={setDraftFile} existingPath={null} />
          {error && <p className="text-xs text-error mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={cancel} className="px-3 h-8 rounded-lg border border-border text-xs text-secondary hover:bg-background-secondary">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {saving ? "Guardando..." : "Agregar certificación"}
            </button>
          </div>
        </div>
      )}

      {canEdit && !creating && (
        <button onClick={startCreate} className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
          <Plus size={15} /> Agregar certificación
        </button>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar certificación"
          message={`¿Eliminar "${confirmDelete.nombre}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
