"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImageIcon, X } from "lucide-react";
import type { Modalidad, NutriologoPerfil } from "@/app/_data/nutriologo_perfiles";
import { deletePortada, uploadPortada } from "@/app/_data/nutriologo_perfiles";
import { AdminOnlyBadge, FieldLabel, inputCls, textareaCls, SectionSaveBar, type SaveState } from "./shared";

const MODALIDADES: { value: Modalidad; label: string }[] = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "En línea" },
  { value: "ambas", label: "Ambas" },
];

const IDIOMAS_SUGERIDOS = ["Español", "Inglés", "Francés", "Portugués"];

export default function InfoProfesionalTab({
  perfilId,
  np,
  onChange,
  dirty,
  saveState,
  errorMessage,
  onSave,
  canEdit,
  isSuperAdmin,
  onPortadaUpdated,
}: {
  perfilId: string;
  np: NutriologoPerfil;
  onChange: (patch: Partial<NutriologoPerfil>) => void;
  dirty: boolean;
  saveState: SaveState;
  errorMessage: string | null;
  onSave: () => void;
  canEdit: boolean;
  isSuperAdmin: boolean;
  onPortadaUpdated: (url: string | null, path: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingPortada, setUploadingPortada] = useState(false);
  const [portadaError, setPortadaError] = useState<string | null>(null);
  const [idiomaInput, setIdiomaInput] = useState("");

  const handlePortadaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPortada(true);
    setPortadaError(null);
    const previousPath = np.foto_portada_storage_path;
    try {
      const { url, path } = await uploadPortada(perfilId, file);
      onPortadaUpdated(url, path);
      if (previousPath && previousPath !== path) {
        await deletePortada(previousPath).catch(() => {});
      }
    } catch (err) {
      setPortadaError(err instanceof Error ? err.message : "No se pudo subir la portada.");
    } finally {
      setUploadingPortada(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addIdioma = (value: string) => {
    const v = value.trim();
    if (!v || np.idiomas.includes(v)) return;
    onChange({ idiomas: [...np.idiomas, v] });
    setIdiomaInput("");
  };
  const removeIdioma = (value: string) => onChange({ idiomas: np.idiomas.filter((i) => i !== value) });

  return (
    <div className="space-y-5">
      {/* Portada */}
      <section>
        <FieldLabel>Foto de portada</FieldLabel>
        <div className="relative h-36 rounded-xl overflow-hidden bg-surface-muted flex items-center justify-center border border-border">
          {np.foto_portada_url ? (
            <Image src={np.foto_portada_url} alt="Portada" fill className="object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted">
              <ImageIcon size={28} />
              <p className="text-xs">Sin portada todavía</p>
            </div>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingPortada}
              aria-label="Cambiar foto de portada"
              className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 h-8 rounded-lg bg-black/60 text-white text-xs font-semibold hover:bg-black/75 disabled:opacity-60"
            >
              <Camera size={13} /> {uploadingPortada ? "Subiendo..." : np.foto_portada_url ? "Cambiar" : "Subir portada"}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePortadaChange} />
        </div>
        {portadaError && <p className="text-xs text-error mt-1">{portadaError}</p>}
      </section>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Título profesional</FieldLabel>
          <input disabled={!canEdit} value={np.titulo_profesional ?? ""} onChange={(e) => onChange({ titulo_profesional: e.target.value || null })}
            placeholder="Ej. Lic. en Nutrición" className={inputCls} />
        </div>
        <div>
          <FieldLabel>Cédula profesional</FieldLabel>
          <input disabled={!canEdit} value={np.cedula_profesional ?? ""} onChange={(e) => onChange({ cedula_profesional: e.target.value || null })}
            placeholder="Ej. 12345678" className={inputCls} />
        </div>
        <div>
          <FieldLabel>Universidad</FieldLabel>
          <input disabled={!canEdit} value={np.universidad ?? ""} onChange={(e) => onChange({ universidad: e.target.value || null })}
            className={inputCls} />
        </div>
        <div>
          <FieldLabel>Año de egreso</FieldLabel>
          <input disabled={!canEdit} type="number" value={np.anio_egreso ?? ""} onChange={(e) => onChange({ anio_egreso: e.target.value ? Number(e.target.value) : null })}
            className={inputCls} />
        </div>
        <div>
          <FieldLabel>Años de experiencia</FieldLabel>
          <input disabled={!canEdit} type="number" min={0} value={np.anos_experiencia ?? ""} onChange={(e) => onChange({ anos_experiencia: e.target.value ? Number(e.target.value) : null })}
            className={inputCls} />
        </div>
        <div>
          <FieldLabel>Modalidad</FieldLabel>
          <select disabled={!canEdit} value={np.modalidad ?? ""} onChange={(e) => onChange({ modalidad: (e.target.value || null) as Modalidad | null })}
            className={inputCls}>
            <option value="">Sin definir</option>
            {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Teléfono profesional <span className="text-muted">(distinto del de cuenta)</span></FieldLabel>
          <input disabled={!canEdit} value={np.telefono_profesional ?? ""} onChange={(e) => onChange({ telefono_profesional: e.target.value || null })}
            className={inputCls} />
        </div>
        <div>
          <FieldLabel>Correo profesional <span className="text-muted">(distinto del de cuenta)</span></FieldLabel>
          <input disabled={!canEdit} type="email" value={np.correo_profesional ?? ""} onChange={(e) => onChange({ correo_profesional: e.target.value || null })}
            placeholder="dra.andrea@consultorio.com" className={inputCls} />
        </div>
      </div>

      <div>
        <FieldLabel>Descripción corta <span className="text-muted">(para tarjetas del directorio)</span></FieldLabel>
        <textarea disabled={!canEdit} value={np.descripcion_corta ?? ""} onChange={(e) => onChange({ descripcion_corta: e.target.value || null })}
          maxLength={200} className={`${textareaCls} h-16`} />
        <p className="text-xs text-muted text-right mt-0.5">{(np.descripcion_corta ?? "").length}/200</p>
      </div>

      <div>
        <FieldLabel>Biografía</FieldLabel>
        <textarea disabled={!canEdit} value={np.biografia ?? ""} onChange={(e) => onChange({ biografia: e.target.value || null })}
          maxLength={1500} className={`${textareaCls} h-28`} />
      </div>

      <div>
        <FieldLabel>Idiomas</FieldLabel>
        <div className="flex flex-wrap gap-1.5 border border-border rounded-xl px-3 py-2 min-h-10">
          {np.idiomas.map((idioma) => (
            <span key={idioma} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
              {idioma}
              {canEdit && (
                <button type="button" onClick={() => removeIdioma(idioma)} aria-label={`Quitar ${idioma}`} className="hover:text-primary-dark">
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
          {canEdit && (
            <input
              value={idiomaInput}
              onChange={(e) => setIdiomaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addIdioma(idiomaInput); } }}
              placeholder="Agregar idioma y Enter..."
              className="text-xs text-text-primary focus:outline-none bg-transparent flex-1 min-w-24"
            />
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {IDIOMAS_SUGERIDOS.filter((i) => !np.idiomas.includes(i)).map((i) => (
              <button key={i} type="button" onClick={() => addIdioma(i)}
                className="text-xs text-secondary bg-surface-muted hover:bg-primary/10 hover:text-primary px-2 py-0.5 rounded-full">
                + {i}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center justify-between bg-background-secondary rounded-xl border border-divider px-4 h-11 cursor-pointer">
          <span className="text-sm font-medium text-text-primary">Perfil visible en el directorio</span>
          <input disabled={!canEdit} type="checkbox" checked={np.perfil_visible} onChange={(e) => onChange({ perfil_visible: e.target.checked })}
            className="w-4 h-4 accent-primary" />
        </label>
        <label className="flex items-center justify-between bg-background-secondary rounded-xl border border-divider px-4 h-11 cursor-pointer">
          <span className="text-sm font-medium text-text-primary">Aceptando pacientes</span>
          <input disabled={!canEdit} type="checkbox" checked={np.aceptando_pacientes} onChange={(e) => onChange({ aceptando_pacientes: e.target.checked })}
            className="w-4 h-4 accent-primary" />
        </label>
      </div>

      {/* Campos reservados a superAdmin */}
      <section className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-text-primary">Controles administrativos</p>
          <AdminOnlyBadge />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-primary">Verificado</span>
            <input disabled={!isSuperAdmin} type="checkbox" checked={np.verificado} onChange={(e) => onChange({ verificado: e.target.checked })}
              className="w-4 h-4 accent-purple-600" />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-primary">Destacado</span>
            <input disabled={!isSuperAdmin} type="checkbox" checked={np.destacado} onChange={(e) => onChange({ destacado: e.target.checked })}
              className="w-4 h-4 accent-purple-600" />
          </label>
          <div>
            <label className="text-xs font-medium text-text-primary block mb-1">Orden en directorio</label>
            <input disabled={!isSuperAdmin} type="number" value={np.orden_directorio ?? ""} onChange={(e) => onChange({ orden_directorio: e.target.value ? Number(e.target.value) : null })}
              className="w-full h-8 border border-border rounded-lg px-2 text-xs focus:outline-none focus:border-primary disabled:bg-background-secondary disabled:text-muted" />
          </div>
        </div>
        {!isSuperAdmin && <p className="text-xs text-muted">Solo un superAdmin puede modificar estos campos. Están protegidos también a nivel de base de datos.</p>}
      </section>

      {canEdit && <SectionSaveBar dirty={dirty} state={saveState} errorMessage={errorMessage} onSave={onSave} />}
    </div>
  );
}
