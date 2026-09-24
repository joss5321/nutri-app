import {
  etiquetaRegla,
  etiquetaTipoIntervencion,
  etiquetaSubtipo,
  etiquetaMotivoSinAccion,
  etiquetaResultado,
} from "@/app/_data/radar";
import type { PacienteEnSeguimiento } from "@/app/_data/radar";

// "En seguimiento" (R6 punto 11 / R7 punto 16): mientras resultado_estado
// siga en 'pendiente', muestra la fecha estimada de evaluación — nunca un
// resultado inventado. En cuanto el backend cierra el resultado, esta
// intervención deja de aparecer aquí (fetchEnSeguimiento solo trae
// pendientes) y vive únicamente en el historial de RadarTab.
export default function SeguimientoCard({ item }: { item: PacienteEnSeguimiento }) {
  const { alerta, intervencion } = item;
  const nombre = item.nombreCompleto || "Paciente sin nombre";
  const resultado = etiquetaResultado(intervencion);

  return (
    <div className="bg-white rounded-xl border border-divider p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-text-primary truncate">{nombre}</p>
          <p className="text-xs text-muted mt-0.5">{alerta ? etiquetaRegla(alerta.regla_principal) : "Sin alerta específica"}</p>
        </div>
        <span className="shrink-0 text-[10px] px-2.5 py-1 rounded-full font-semibold bg-surface-muted text-secondary">
          {resultado.titulo}
        </span>
      </div>

      <div className="mt-3 bg-surface-muted rounded-lg px-3 py-2 text-sm">
        <p className="font-semibold text-text-primary">
          {etiquetaTipoIntervencion(intervencion.tipo)}
          {etiquetaSubtipo(intervencion.subtipo) ? ` · ${etiquetaSubtipo(intervencion.subtipo)}` : ""}
        </p>
        {intervencion.motivo_sin_accion && (
          <p className="text-xs text-secondary mt-0.5">Motivo: {etiquetaMotivoSinAccion(intervencion.motivo_sin_accion)}</p>
        )}
        {intervencion.nota && <p className="text-xs text-secondary mt-0.5 italic">&ldquo;{intervencion.nota}&rdquo;</p>}
      </div>

      <p className="mt-3 text-[11px] text-muted">{resultado.detalle}</p>
    </div>
  );
}
