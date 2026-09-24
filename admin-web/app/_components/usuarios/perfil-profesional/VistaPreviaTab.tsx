"use client";
import Image from "next/image";
import {
  AtSign, BadgeCheck, Clock, Globe, GraduationCap, Languages, MapPin, Music2, ThumbsUp, TriangleAlert,
} from "lucide-react";
import type { Perfil } from "@/app/_data/perfiles";
import type {
  Especialidad, NutriologoCertificacion, NutriologoConsultorio, NutriologoDisponibilidad,
  NutriologoExperiencia, NutriologoPerfil, NutriologoServicio,
} from "@/app/_data/nutriologo_perfiles";

const DIA_LABEL: Record<number, string> = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 7: "Dom" };

function formatMXN(precio: number, moneda: string): string {
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda || "MXN" }).format(precio);
  } catch {
    return `$${precio.toFixed(2)} ${moneda}`;
  }
}

function formatFecha(fecha: string | null): string {
  if (!fecha) return "";
  const [y, m] = fecha.split("-");
  return `${m}/${y}`;
}

export default function VistaPreviaTab({
  perfil, np, especialidades, servicios, experiencia, consultorios, disponibilidad, certificaciones, hasUnsavedChanges,
}: {
  perfil: Perfil;
  np: NutriologoPerfil;
  especialidades: Especialidad[];
  servicios: NutriologoServicio[];
  experiencia: NutriologoExperiencia[];
  consultorios: NutriologoConsultorio[];
  disponibilidad: NutriologoDisponibilidad[];
  certificaciones: NutriologoCertificacion[];
  hasUnsavedChanges: boolean;
}) {
  const initials = (perfil.nombre_completo || "N").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const serviciosActivos = servicios.filter((s) => s.activo);
  const diasDisponibles = disponibilidad.filter((d) => d.disponible);

  return (
    <div className="space-y-3">
      {!np.perfil_visible && (
        <div className="flex items-center gap-2 bg-warning-soft border border-warning/30 text-warning text-xs rounded-xl px-4 py-2.5">
          <TriangleAlert size={14} className="shrink-0" />
          Este perfil está marcado como <strong>no visible</strong> — los pacientes no lo verán en el directorio aunque se muestre aquí.
        </div>
      )}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-2 bg-info-soft border border-info/20 text-info text-xs rounded-xl px-4 py-2.5">
          <TriangleAlert size={14} className="shrink-0" />
          Estás viendo cambios sin guardar todavía. Así se vería con la información actual del formulario.
        </div>
      )}

      {/* Marco tipo móvil */}
      <div className="mx-auto w-full max-w-[380px] bg-white rounded-[2rem] border-8 border-ink shadow-xl overflow-hidden">
        <div className="h-36 bg-surface-muted relative">
          {np.foto_portada_url ? (
            <Image src={np.foto_portada_url} alt="" fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
          )}
        </div>
        <div className="px-4 pb-5 -mt-8">
          <div className="flex items-end gap-3">
            {perfil.avatar_url ? (
              <Image src={perfil.avatar_url} alt="" width={64} height={64} className="w-16 h-16 rounded-full object-cover border-4 border-white shadow" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold border-4 border-white shadow">{initials}</div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-text-primary text-base">{perfil.nombre_completo}</p>
            {np.verificado && <BadgeCheck size={16} className="text-primary" />}
          </div>
          {np.titulo_profesional && <p className="text-sm text-secondary">{np.titulo_profesional}</p>}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {np.modalidad && <span className="text-[11px] bg-surface-muted text-secondary px-2 py-0.5 rounded-full capitalize">{np.modalidad}</span>}
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${np.aceptando_pacientes ? "bg-success-soft text-success" : "bg-surface-muted text-muted"}`}>
              {np.aceptando_pacientes ? "Aceptando pacientes" : "Sin cupo"}
            </span>
            {serviciosActivos.length > 0 && (
              <span className="text-[11px] bg-brand-soft text-primary px-2 py-0.5 rounded-full font-semibold">
                Desde {formatMXN(Math.min(...serviciosActivos.map((s) => s.precio)), serviciosActivos[0].moneda)}
              </span>
            )}
          </div>

          {np.descripcion_corta && <p className="text-sm text-text-primary mt-3">{np.descripcion_corta}</p>}

          {especialidades.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {especialidades.map((e) => <span key={e.id} className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{e.nombre}</span>)}
            </div>
          )}

          {np.biografia && (
            <section className="mt-4">
              <p className="text-xs font-bold text-text-primary mb-1">Sobre mí</p>
              <p className="text-xs text-secondary leading-relaxed">{np.biografia}</p>
            </section>
          )}

          {serviciosActivos.length > 0 && (
            <section className="mt-4">
              <p className="text-xs font-bold text-text-primary mb-1.5">Servicios</p>
              <div className="space-y-1.5">
                {serviciosActivos.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs bg-background-secondary rounded-lg px-2.5 py-1.5">
                    <span className="text-text-primary font-medium">{s.nombre}</span>
                    <span className="text-primary font-semibold">{formatMXN(s.precio, s.moneda)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {experiencia.length > 0 && (
            <section className="mt-4">
              <p className="text-xs font-bold text-text-primary mb-1.5">Experiencia</p>
              <div className="space-y-1.5">
                {experiencia.map((e) => (
                  <div key={e.id} className="text-xs">
                    <p className="text-text-primary font-medium">{e.puesto} · {e.institucion}</p>
                    <p className="text-muted">{formatFecha(e.fecha_inicio)} — {e.actualidad ? "Actualidad" : formatFecha(e.fecha_fin)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {certificaciones.length > 0 && (
            <section className="mt-4">
              <p className="text-xs font-bold text-text-primary mb-1.5 inline-flex items-center gap-1"><GraduationCap size={12} /> Formación</p>
              <div className="space-y-1">
                {certificaciones.map((c) => (
                  <p key={c.id} className="text-xs text-secondary">{c.nombre} — {c.institucion}{c.anio ? ` (${c.anio})` : ""}</p>
                ))}
              </div>
            </section>
          )}

          {consultorios.length > 0 && (
            <section className="mt-4">
              <p className="text-xs font-bold text-text-primary mb-1.5 inline-flex items-center gap-1"><MapPin size={12} /> Consultorios</p>
              <div className="space-y-1">
                {consultorios.map((c) => (
                  <p key={c.id} className="text-xs text-secondary">{c.nombre || "Consultorio"} — {[c.ciudad, c.estado].filter(Boolean).join(", ")}</p>
                ))}
              </div>
            </section>
          )}

          {diasDisponibles.length > 0 && (
            <section className="mt-4">
              <p className="text-xs font-bold text-text-primary mb-1.5 inline-flex items-center gap-1"><Clock size={12} /> Disponibilidad</p>
              <div className="flex flex-wrap gap-1">
                {diasDisponibles.map((d) => (
                  <span key={d.id} className="text-[10px] bg-surface-muted text-secondary px-2 py-0.5 rounded-full">
                    {DIA_LABEL[d.dia_semana]} {d.hora_inicio?.slice(0, 5)}–{d.hora_fin?.slice(0, 5)}
                  </span>
                ))}
              </div>
            </section>
          )}

          {np.idiomas.length > 0 && (
            <p className="text-xs text-muted mt-4 inline-flex items-center gap-1"><Languages size={12} /> {np.idiomas.join(", ")}</p>
          )}

          {(np.instagram_url || np.facebook_url || np.tiktok_url || np.sitio_web_url) && (
            <div className="flex items-center gap-3 mt-3 text-secondary">
              {np.instagram_url && <AtSign size={15} />}
              {np.facebook_url && <ThumbsUp size={15} />}
              {np.tiktok_url && <Music2 size={15} />}
              {np.sitio_web_url && <Globe size={15} />}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted text-center">Vista aproximada — no incluye reseñas todavía (el módulo de reviews no existe aún).</p>
    </div>
  );
}
