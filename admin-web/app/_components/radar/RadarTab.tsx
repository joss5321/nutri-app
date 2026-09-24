"use client";
import { useCallback, useEffect, useState } from "react";
import { ClipboardPlus } from "lucide-react";
import {
  fetchHistorialSnapshots,
  fetchHistorialAlertas,
  fetchHistorialIntervenciones,
  etiquetaRegla,
  etiquetaMotivoResolucion,
  etiquetaTipoIntervencion,
  etiquetaSubtipo,
  etiquetaMotivoSinAccion,
  etiquetaResultado,
  type RadarSnapshot,
  type RadarAlerta,
  type Intervencion,
  type ResultadoEstado,
} from "@/app/_data/radar";
import EstadoBadge from "./EstadoBadge";
import AdherenciaValor from "./AdherenciaValor";
import Sparkline from "./Sparkline";
import IntervencionModal from "./IntervencionModal";

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Reutiliza los mismos tokens semánticos que el resto del panel (nunca una
// paleta nueva) — mejoro/empeoro son los únicos casos con lectura
// inequívocamente positiva/negativa; el resto queda neutro a propósito
// (inconcluso/confundido NO son "malas noticias", son falta de certeza).
function resultadoBadgeClases(estado: ResultadoEstado): string {
  if (estado === "mejoro") return "bg-success-soft text-success";
  if (estado === "empeoro") return "bg-error-soft text-error";
  return "bg-surface-muted text-secondary";
}

export default function RadarTab({ userId }: { userId: string }) {
  const [snapshots, setSnapshots] = useState<RadarSnapshot[] | null>(null);
  const [alertas, setAlertas] = useState<RadarAlerta[] | null>(null);
  const [intervenciones, setIntervenciones] = useState<Intervencion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);

  const cargar = useCallback(() => {
    return Promise.all([
      fetchHistorialSnapshots(userId),
      fetchHistorialAlertas(userId),
      fetchHistorialIntervenciones(userId),
    ]).then(([s, a, i]) => {
      setSnapshots(s);
      setAlertas(a);
      setIntervenciones(i);
    });
  }, [userId]);

  useEffect(() => {
    // userId es estable durante la vida de este componente (UserModal se
    // remonta por completo al cambiar de paciente, nunca reutiliza esta
    // instancia con un userId distinto), así que no hace falta resetear
    // estado sincrónicamente aquí — el estado inicial ya es null/sin error.
    let cancelado = false;
    cargar().catch((err) => {
      if (cancelado) return;
      setError(err instanceof Error ? err.message : "No se pudo cargar la información de Radar.");
    });
    return () => {
      cancelado = true;
    };
  }, [cargar]);

  if (error) {
    return (
      <div className="bg-error-soft text-error text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    );
  }

  if (snapshots === null || alertas === null || intervenciones === null) {
    return <p className="text-sm text-muted">Cargando información de Radar…</p>;
  }

  const actual = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setMostrarModal(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark px-3.5 py-2 rounded-lg transition-colors"
        >
          <ClipboardPlus size={15} /> Registrar intervención
        </button>
      </div>

      {mostrarModal && (
        <IntervencionModal
          pacienteId={userId}
          onClose={() => setMostrarModal(false)}
          onGuardada={() => {
            setMostrarModal(false);
            cargar().catch(() => {});
          }}
        />
      )}

      {!actual ? (
        <div className="bg-surface-muted text-secondary text-sm rounded-lg px-4 py-6 text-center">
          Radar todavía no ha evaluado a este paciente.
        </div>
      ) : (
        <>
          {/* Estado actual */}
          <section>
            <h3 className="text-sm font-bold text-text-primary mb-3">Estado actual</h3>
            <div className="bg-surface-muted rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <EstadoBadge estado={actual.estado} />
                <p className="text-xs text-muted">Snapshot del {formatFecha(actual.snapshot_date)}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted font-semibold">Adherencia</p>
                  <AdherenciaValor valor={actual.adherence_global} calidad={actual.adherence_global_calidad} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted font-semibold">Señales de riesgo</p>
                  <p className="font-bold text-text-primary">{actual.riesgo_confirmado_puntos} pts</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted font-semibold">Confianza</p>
                  <p className="font-bold text-text-primary">{Math.round(actual.data_confidence_global)}%</p>
                </div>
              </div>
            </div>
          </section>

          {/* Tendencia */}
          <section>
            <h3 className="text-sm font-bold text-text-primary mb-3">Tendencia de adherencia</h3>
            <div className="bg-surface-muted rounded-xl p-4">
              <Sparkline valores={snapshots.map((s) => s.adherence_global)} width={320} height={56} />
            </div>
          </section>

          {/* Qué detectamos */}
          {actual.explicaciones.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-text-primary mb-3">Qué detectamos</h3>
              <ul className="text-sm text-text-primary space-y-1 list-disc list-inside bg-surface-muted rounded-xl p-4">
                {actual.explicaciones.map((linea, i) => (
                  <li key={i}>{linea}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Acción sugerida */}
          {actual.accion_sugerida && (
            <section>
              <h3 className="text-sm font-bold text-text-primary mb-3">Acción sugerida</h3>
              <div className="bg-brand-soft rounded-xl p-4 text-sm text-text-primary">{actual.accion_sugerida}</div>
            </section>
          )}
        </>
      )}

      {/* Historial de alertas */}
      <section>
        <h3 className="text-sm font-bold text-text-primary mb-3">Historial de alertas</h3>
        {alertas.length === 0 ? (
          <p className="text-sm text-muted">Este paciente no tiene alertas registradas todavía.</p>
        ) : (
          <div className="border border-divider rounded-xl divide-y divide-divider overflow-hidden">
            {alertas.map((a) => (
              <div key={a.id} className="p-3 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary">{etiquetaRegla(a.regla_principal)}</p>
                  <p className="text-xs text-muted mt-0.5">
                    Abierta el {formatFecha(a.fecha_apertura)}
                    {a.fecha_resolucion && ` · Resuelta el ${formatFecha(a.fecha_resolucion)}`}
                  </p>
                  {a.recurrence_of && (
                    <p className="text-[11px] text-warning font-medium mt-0.5">↻ Reincidencia de un problema anterior</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold inline-block ${
                      a.estado_alerta === "abierta" ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
                    }`}
                  >
                    {a.estado_alerta === "abierta" ? "Abierta" : "Resuelta"}
                  </span>
                  {a.motivo_resolucion && (
                    <p className="text-[10px] text-muted mt-1">{etiquetaMotivoResolucion(a.motivo_resolucion)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historial de intervenciones (R6/R7) */}
      <section>
        <h3 className="text-sm font-bold text-text-primary mb-3">Historial de intervenciones</h3>
        {intervenciones.length === 0 ? (
          <p className="text-sm text-muted">Todavía no se ha registrado ninguna intervención para este paciente.</p>
        ) : (
          <div className="border border-divider rounded-xl divide-y divide-divider overflow-hidden">
            {intervenciones.map((i) => {
              const resultado = etiquetaResultado(i);
              return (
                <div key={i.id} className="p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary">
                        {etiquetaTipoIntervencion(i.tipo)}
                        {etiquetaSubtipo(i.subtipo) ? ` · ${etiquetaSubtipo(i.subtipo)}` : ""}
                      </p>
                      <p className="text-xs text-muted mt-0.5">{formatFechaHora(i.created_at)}</p>
                      {i.alerta_id && (
                        <p className="text-[11px] text-muted mt-0.5">
                          Alerta relacionada: {etiquetaRegla(alertas.find((a) => a.id === i.alerta_id)?.regla_principal ?? "")}
                        </p>
                      )}
                      {i.motivo_sin_accion && (
                        <p className="text-xs text-secondary mt-1">Motivo: {etiquetaMotivoSinAccion(i.motivo_sin_accion)}</p>
                      )}
                      {i.nota && <p className="text-xs text-secondary mt-1 italic">&ldquo;{i.nota}&rdquo;</p>}
                    </div>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${resultadoBadgeClases(i.resultado_estado)}`}>
                      {resultado.titulo}
                    </span>
                  </div>
                  <p className="text-xs text-secondary mt-2">{resultado.detalle}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
