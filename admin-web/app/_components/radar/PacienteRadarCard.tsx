"use client";
import { useState } from "react";
import { ChevronRight, ClipboardPlus } from "lucide-react";
import EstadoBadge from "./EstadoBadge";
import AdherenciaValor from "./AdherenciaValor";
import IntervencionModal from "./IntervencionModal";
import type { PacienteRadar } from "@/app/_data/radar";

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

function esHoy(fecha: string): boolean {
  const hoy = new Date();
  const iso = hoy.toISOString().slice(0, 10);
  return fecha === iso;
}

export default function PacienteRadarCard({
  paciente,
  onVerPaciente,
  onIntervencionRegistrada,
}: {
  paciente: PacienteRadar;
  onVerPaciente: (pacienteId: string) => void;
  onIntervencionRegistrada?: (pacienteId: string, alertaResueltaId: string | null) => void;
}) {
  const { snapshot, alertasAbiertas } = paciente;
  const estado = snapshot?.estado ?? "blanco";
  const nombre = paciente.nombreCompleto || "Paciente sin nombre";
  const initials = nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const [mostrarModal, setMostrarModal] = useState(false);

  // El motor ya escribe el texto correcto — nunca se reconstruye aquí.
  const explicaciones = snapshot?.explicaciones ?? [];
  const accion = snapshot?.accion_sugerida ?? null;

  return (
    <div className="bg-white rounded-xl border border-divider p-4 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-text-primary truncate">{nombre}</p>
            <EstadoBadge estado={estado} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setMostrarModal(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:text-primary px-2.5 py-1.5 rounded-lg hover:bg-surface-muted transition-colors"
          >
            <ClipboardPlus size={14} /> Registrar intervención
          </button>
          <button
            onClick={() => onVerPaciente(paciente.pacienteId)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark px-2.5 py-1.5 rounded-lg hover:bg-primary-light transition-colors"
          >
            Ver paciente <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {mostrarModal && (
        <IntervencionModal
          pacienteId={paciente.pacienteId}
          alertasDisponibles={alertasAbiertas}
          onClose={() => setMostrarModal(false)}
          onGuardada={(intervencion) => {
            setMostrarModal(false);
            onIntervencionRegistrada?.(paciente.pacienteId, intervencion.alerta_id);
          }}
        />
      )}

      {!snapshot ? (
        <p className="mt-3 text-sm text-muted italic">Radar todavía no ha evaluado a este paciente.</p>
      ) : (
        <>
          {estado === "amarillo" && (
            <div className="mt-3 text-xs bg-warning-soft text-warning rounded-lg px-3 py-2">
              Tenemos poca información reciente para evaluar correctamente — esto no significa que el paciente esté incumpliendo.
            </div>
          )}
          {estado === "blanco" && (
            <div className="mt-3 text-xs bg-surface-muted text-secondary rounded-lg px-3 py-2">
              Radar todavía está aprendiendo el patrón de este paciente.
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted font-semibold">Señales de riesgo</p>
              <p className="font-bold text-text-primary">{snapshot.riesgo_confirmado_puntos} pts</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted font-semibold">Adherencia</p>
              <AdherenciaValor valor={snapshot.adherence_global} calidad={snapshot.adherence_global_calidad} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted font-semibold">Confianza</p>
              <p className="font-bold text-text-primary">{Math.round(snapshot.data_confidence_global)}%</p>
            </div>
          </div>

          {explicaciones.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-secondary mb-1">¿Por qué?</p>
              <ul className="text-sm text-text-primary space-y-0.5 list-disc list-inside">
                {explicaciones.map((linea, i) => (
                  <li key={i}>{linea}</li>
                ))}
              </ul>
            </div>
          )}

          {accion && (
            <div className="mt-3 bg-brand-soft rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-primary font-semibold mb-0.5">Acción sugerida</p>
              <p className="text-sm text-text-primary">{accion}</p>
            </div>
          )}

          {alertasAbiertas.some((a) => a.recurrence_of !== null) && (
            <p className="mt-2 text-[11px] text-warning font-medium">↻ Este problema ya había ocurrido antes (reincidencia)</p>
          )}

          <p className="mt-3 text-[11px] text-muted">
            {esHoy(snapshot.snapshot_date)
              ? `Evaluación de hoy (${formatFecha(snapshot.snapshot_date)})`
              : `Última evaluación: ${formatFecha(snapshot.snapshot_date)} — Radar no ha vuelto a evaluar a este paciente desde entonces`}
          </p>
        </>
      )}
    </div>
  );
}
