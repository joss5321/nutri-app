"use client";
import { useEffect, useMemo, useState } from "react";
import {
  User, IdCard, Tags, DollarSign, GraduationCap, Briefcase, MapPin, Clock, Share2, Eye,
  X, UserRoundPlus, Loader2,
} from "lucide-react";
import { fetchPerfil, type Perfil } from "@/app/_data/perfiles";
import {
  createNutriologoPerfil,
  fetchConsultorios,
  fetchCertificaciones,
  fetchDisponibilidad,
  fetchExperiencia,
  fetchNutriologoEspecialidades,
  fetchNutriologoPerfil,
  fetchServicios,
  updateNutriologoPerfil,
  type Especialidad,
  type NutriologoCertificacion,
  type NutriologoConsultorio,
  type NutriologoDisponibilidad,
  type NutriologoExperiencia,
  type NutriologoPerfil,
  type NutriologoServicio,
} from "@/app/_data/nutriologo_perfiles";
import ConfirmModal from "@/app/_components/ConfirmModal";
import GeneralTab from "./GeneralTab";
import InfoProfesionalTab from "./InfoProfesionalTab";
import EspecialidadesTab from "./EspecialidadesTab";
import ServiciosTab from "./ServiciosTab";
import CertificacionesTab from "./CertificacionesTab";
import ExperienciaTab from "./ExperienciaTab";
import ConsultoriosTab from "./ConsultoriosTab";
import DisponibilidadTab from "./DisponibilidadTab";
import RedesTab from "./RedesTab";
import VistaPreviaTab from "./VistaPreviaTab";
import { calcularCompletitud } from "./completeness";
import type { SaveState } from "./shared";

type TabKey =
  | "general" | "profesional" | "especialidades" | "servicios" | "certificaciones"
  | "experiencia" | "consultorios" | "disponibilidad" | "redes" | "preview";

const TABS: { key: TabKey; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: "general", label: "General", Icon: User },
  { key: "profesional", label: "Perfil profesional", Icon: IdCard },
  { key: "especialidades", label: "Especialidades", Icon: Tags },
  { key: "servicios", label: "Servicios y precios", Icon: DollarSign },
  { key: "certificaciones", label: "Formación y certificaciones", Icon: GraduationCap },
  { key: "experiencia", label: "Experiencia", Icon: Briefcase },
  { key: "consultorios", label: "Consultorios", Icon: MapPin },
  { key: "disponibilidad", label: "Disponibilidad", Icon: Clock },
  { key: "redes", label: "Redes", Icon: Share2 },
  { key: "preview", label: "Vista previa", Icon: Eye },
];

const INFO_FIELDS = [
  "titulo_profesional", "foto_portada_url", "foto_portada_storage_path", "telefono_profesional",
  "correo_profesional", "cedula_profesional", "universidad", "anio_egreso", "anos_experiencia",
  "descripcion_corta", "biografia", "idiomas", "modalidad", "perfil_visible", "aceptando_pacientes",
  "verificado", "destacado", "orden_directorio",
] as const;

const REDES_FIELDS = ["instagram_url", "facebook_url", "tiktok_url", "sitio_web_url"] as const;

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}

export default function PerfilProfesionalModal({
  adminId,
  currentUserId,
  currentUserRol,
  onClose,
}: {
  adminId: string;
  currentUserId: string;
  currentUserRol: "admin" | "superadmin";
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [np, setNp] = useState<NutriologoPerfil | null>(null);
  const [npSavedInfo, setNpSavedInfo] = useState<Pick<NutriologoPerfil, typeof INFO_FIELDS[number]> | null>(null);
  const [npSavedRedes, setNpSavedRedes] = useState<Pick<NutriologoPerfil, typeof REDES_FIELDS[number]> | null>(null);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [servicios, setServicios] = useState<NutriologoServicio[]>([]);
  const [certificaciones, setCertificaciones] = useState<NutriologoCertificacion[]>([]);
  const [experiencia, setExperiencia] = useState<NutriologoExperiencia[]>([]);
  const [consultorios, setConsultorios] = useState<NutriologoConsultorio[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<NutriologoDisponibilidad[]>([]);
  const [creatingPerfil, setCreatingPerfil] = useState(false);

  const [tab, setTab] = useState<TabKey>("general");
  const [infoSaveState, setInfoSaveState] = useState<SaveState>("idle");
  const [infoError, setInfoError] = useState<string | null>(null);
  const [redesSaveState, setRedesSaveState] = useState<SaveState>("idle");
  const [redesError, setRedesError] = useState<string | null>(null);
  const [dispDirty, setDispDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const isSuperAdmin = currentUserRol === "superadmin";
  const isOwnProfile = currentUserId === adminId;
  const canEdit = isSuperAdmin || isOwnProfile;

  const load = () => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      fetchPerfil(adminId),
      fetchNutriologoPerfil(adminId),
    ])
      .then(async ([perfilData, npData]) => {
        setPerfil(perfilData);
        setNp(npData);
        if (npData) {
          setNpSavedInfo(pick(npData, INFO_FIELDS));
          setNpSavedRedes(pick(npData, REDES_FIELDS));
          const [esp, serv, cert, exp, cons, disp] = await Promise.all([
            fetchNutriologoEspecialidades(adminId),
            fetchServicios(adminId),
            fetchCertificaciones(adminId),
            fetchExperiencia(adminId),
            fetchConsultorios(adminId),
            fetchDisponibilidad(adminId),
          ]);
          setEspecialidades(esp);
          setServicios(serv);
          setCertificaciones(cert);
          setExperiencia(exp);
          setConsultorios(cons);
          setDisponibilidad(disp);
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "No se pudo cargar el perfil profesional."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Se difiere a un microtask: `load()` llama a setState de forma
    // síncrona al iniciar (setLoading/setLoadError), y la regla
    // react-hooks/set-state-in-effect exige que esas llamadas ocurran
    // dentro de un callback, no directamente en el cuerpo del efecto.
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

  const handleCreatePerfil = async () => {
    setCreatingPerfil(true);
    try {
      const created = await createNutriologoPerfil(adminId);
      setNp(created);
      setNpSavedInfo(pick(created, INFO_FIELDS));
      setNpSavedRedes(pick(created, REDES_FIELDS));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo crear el perfil profesional.");
    } finally {
      setCreatingPerfil(false);
    }
  };

  const onNpChange = (patch: Partial<NutriologoPerfil>) => setNp((prev) => (prev ? { ...prev, ...patch } : prev));

  const infoDirty = np && npSavedInfo ? JSON.stringify(pick(np, INFO_FIELDS)) !== JSON.stringify(npSavedInfo) : false;
  const redesDirty = np && npSavedRedes ? JSON.stringify(pick(np, REDES_FIELDS)) !== JSON.stringify(npSavedRedes) : false;
  const hasUnsavedChanges = infoDirty || redesDirty || dispDirty;

  const handleSaveInfo = async () => {
    if (!np) return;
    setInfoSaveState("saving");
    setInfoError(null);
    try {
      const patch = pick(np, INFO_FIELDS);
      const updated = await updateNutriologoPerfil(adminId, patch);
      setNp(updated);
      setNpSavedInfo(pick(updated, INFO_FIELDS));
      setInfoSaveState("saved");
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : "No se pudo guardar. Verifica los campos.");
      setInfoSaveState("error");
    }
  };

  const handleSaveRedes = async () => {
    if (!np) return;
    setRedesSaveState("saving");
    setRedesError(null);
    try {
      const patch = pick(np, REDES_FIELDS);
      const updated = await updateNutriologoPerfil(adminId, patch);
      setNp(updated);
      setNpSavedRedes(pick(updated, REDES_FIELDS));
      setRedesSaveState("saved");
    } catch (err) {
      setRedesError(err instanceof Error ? err.message : "No se pudo guardar. Verifica que las URLs comiencen con http:// o https://.");
      setRedesSaveState("error");
    }
  };

  const handlePortadaUpdated = (url: string | null, path: string | null) => {
    setNp((prev) => (prev ? { ...prev, foto_portada_url: url, foto_portada_storage_path: path } : prev));
    setNpSavedInfo((prev) => (prev ? { ...prev, foto_portada_url: url, foto_portada_storage_path: path } : prev));
  };

  const requestClose = () => {
    if (hasUnsavedChanges) setConfirmClose(true);
    else onClose();
  };

  const completitud = useMemo(() => {
    if (!perfil || !np) return null;
    return calcularCompletitud({ perfil, np, especialidades, servicios, experiencia, consultorios, disponibilidad });
  }, [perfil, np, especialidades, servicios, experiencia, consultorios, disponibilidad]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={requestClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-divider shrink-0">
          <div>
            <h2 className="font-bold text-text-primary text-xl">Perfil profesional</h2>
            <p className="text-secondary text-sm">
              {perfil?.nombre_completo || "Cargando..."}
              {completitud && <span className="ml-2 text-xs font-semibold text-primary">· Perfil {completitud.porcentaje}% completo</span>}
            </p>
          </div>
          <button onClick={requestClose} aria-label="Cerrar" className="w-9 h-9 rounded-full hover:bg-surface-muted flex items-center justify-center text-muted">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
            <p className="text-sm text-error">{loadError}</p>
            <button onClick={load} className="text-sm text-primary font-semibold hover:underline">Reintentar</button>
          </div>
        ) : !np || !perfil ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <UserRoundPlus size={28} />
            </div>
            <div>
              <p className="font-bold text-text-primary">Este nutriólogo todavía no tiene un perfil profesional.</p>
              <p className="text-sm text-secondary mt-1">Se creará con valores seguros: no visible y sin verificar hasta que lo publiques.</p>
            </div>
            {canEdit && (
              <button onClick={handleCreatePerfil} disabled={creatingPerfil}
                className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
                {creatingPerfil ? <Loader2 size={15} className="animate-spin" /> : <UserRoundPlus size={15} />}
                {creatingPerfil ? "Creando..." : "Crear perfil profesional"}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-divider px-6 shrink-0">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                    tab === t.key ? "border-primary text-primary" : "border-transparent text-secondary hover:text-text-primary"
                  }`}
                >
                  <t.Icon size={14} /> {t.label}
                </button>
              ))}
            </div>

            {/* Content — los tabs se mantienen montados (solo ocultos) al
                cambiar de pestaña, para no perder ediciones en curso
                (ej. disponibilidad sin guardar, o un formulario de "agregar"
                a medio llenar) que no viven en el estado del componente padre. */}
            <div className="p-6 overflow-y-auto flex-1">
              <div hidden={tab !== "general"}><GeneralTab perfil={perfil} /></div>
              <div hidden={tab !== "profesional"}>
                <InfoProfesionalTab
                  perfilId={adminId}
                  np={np}
                  onChange={onNpChange}
                  dirty={infoDirty}
                  saveState={infoSaveState}
                  errorMessage={infoError}
                  onSave={handleSaveInfo}
                  canEdit={canEdit}
                  isSuperAdmin={isSuperAdmin}
                  onPortadaUpdated={handlePortadaUpdated}
                />
              </div>
              <div hidden={tab !== "especialidades"}>
                <EspecialidadesTab nutriologoId={adminId} seleccionadas={especialidades} onChange={setEspecialidades} canEdit={canEdit} />
              </div>
              <div hidden={tab !== "servicios"}>
                <ServiciosTab nutriologoId={adminId} items={servicios} onChange={setServicios} canEdit={canEdit} />
              </div>
              <div hidden={tab !== "certificaciones"}>
                <CertificacionesTab nutriologoId={adminId} items={certificaciones} onChange={setCertificaciones} canEdit={canEdit} />
              </div>
              <div hidden={tab !== "experiencia"}>
                <ExperienciaTab nutriologoId={adminId} items={experiencia} onChange={setExperiencia} canEdit={canEdit} />
              </div>
              <div hidden={tab !== "consultorios"}>
                <ConsultoriosTab nutriologoId={adminId} items={consultorios} onChange={setConsultorios} canEdit={canEdit} />
              </div>
              <div hidden={tab !== "disponibilidad"}>
                <DisponibilidadTab nutriologoId={adminId} items={disponibilidad} onChange={setDisponibilidad} canEdit={canEdit} onDirtyChange={setDispDirty} />
              </div>
              <div hidden={tab !== "redes"}>
                <RedesTab np={np} onChange={onNpChange} dirty={redesDirty} saveState={redesSaveState} errorMessage={redesError} onSave={handleSaveRedes} canEdit={canEdit} />
              </div>
              <div hidden={tab !== "preview"}>
                <VistaPreviaTab
                  perfil={perfil} np={np} especialidades={especialidades} servicios={servicios} experiencia={experiencia}
                  consultorios={consultorios} disponibilidad={disponibilidad} certificaciones={certificaciones}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {confirmClose && (
        <ConfirmModal
          title="Cambios sin guardar"
          message="Tienes cambios sin guardar en este perfil profesional. Si cierras ahora, se perderán."
          confirmLabel="Cerrar sin guardar"
          variant="warning"
          onConfirm={onClose}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </div>
  );
}
