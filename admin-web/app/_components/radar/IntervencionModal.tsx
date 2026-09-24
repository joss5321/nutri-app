"use client";
import { useState } from "react";
import { X, ChevronLeft } from "lucide-react";
import {
  registrarIntervencion,
  etiquetaRegla,
  CATALOGO_TIPOS,
  CATALOGO_MOTIVOS_SIN_ACCION,
  type TipoIntervencion,
  type MotivoSinAccion,
  type RadarAlerta,
  type Intervencion,
} from "@/app/_data/radar";

// Modal de registro rápido de intervención (R6). Objetivo explícito del
// producto: camino normal <10 segundos. Por eso cada tap avanza solo
// (nunca hay que tocar "Siguiente"), y la nota final es siempre opcional.
//
// Origen del alerta_id (decisión de la especificación, sección 5):
// - Si viene de PacienteRadarCard con exactamente 1 alerta abierta, se liga
//   automáticamente a esa alerta (sin tap extra).
// - Si hay más de 1 alerta abierta, se pregunta a cuál corresponde (paso
//   previo, único caso en que agregamos un tap).
// - Si viene de RadarTab (alertasDisponibles=[]) o el nutriólogo elige
//   "Ninguna en particular", alerta_id queda NULL — nunca se fuerza una
//   alerta ficticia.

type Paso = "alerta" | "tipo" | "paso2" | "nota";

export default function IntervencionModal({
  pacienteId,
  alertasDisponibles = [],
  onClose,
  onGuardada,
}: {
  pacienteId: string;
  alertasDisponibles?: RadarAlerta[];
  onClose: () => void;
  onGuardada: (intervencion: Intervencion) => void;
}) {
  const [paso, setPaso] = useState<Paso>(alertasDisponibles.length > 1 ? "alerta" : "tipo");
  const [alertaId, setAlertaId] = useState<string | null>(
    alertasDisponibles.length === 1 ? alertasDisponibles[0].id : null
  );
  const [tipo, setTipo] = useState<TipoIntervencion | null>(null);
  const [subtipo, setSubtipo] = useState<string | null>(null);
  const [motivoSinAccion, setMotivoSinAccion] = useState<MotivoSinAccion | null>(null);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipoConfig = CATALOGO_TIPOS.find((t) => t.value === tipo) ?? null;

  function elegirAlerta(id: string | null) {
    setAlertaId(id);
    setPaso("tipo");
  }

  function elegirTipo(t: TipoIntervencion) {
    setTipo(t);
    setSubtipo(null);
    setMotivoSinAccion(null);
    if (t === "sin_accion" || (CATALOGO_TIPOS.find((c) => c.value === t)?.subtipos?.length ?? 0) > 0) {
      setPaso("paso2");
    } else {
      setPaso("nota");
    }
  }

  function elegirSubtipo(s: string | null) {
    setSubtipo(s);
    setPaso("nota");
  }

  function elegirMotivo(m: MotivoSinAccion) {
    setMotivoSinAccion(m);
    setPaso("nota");
  }

  async function guardar() {
    if (!tipo) return;
    if (tipo === "sin_accion" && !motivoSinAccion) {
      setError("Elige por qué no vas a actuar todavía.");
      setPaso("paso2");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const intervencion = await registrarIntervencion({
        pacienteId,
        alertaId,
        tipo,
        subtipo,
        nota,
        motivoSinAccion,
      });
      onGuardada(intervencion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la intervención.");
      setGuardando(false);
    }
  }

  function atras() {
    if (paso === "nota") {
      setPaso(tipoConfig?.subtipos?.length || tipo === "sin_accion" ? "paso2" : "tipo");
    } else if (paso === "paso2") {
      setPaso("tipo");
    } else if (paso === "tipo" && alertasDisponibles.length > 1) {
      setPaso("alerta");
    }
  }

  const puedeVolver =
    paso === "nota" || paso === "paso2" || (paso === "tipo" && alertasDisponibles.length > 1);

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
          <div className="flex items-center gap-2 min-w-0">
            {puedeVolver && (
              <button onClick={atras} className="text-muted hover:text-secondary shrink-0" aria-label="Atrás">
                <ChevronLeft size={18} />
              </button>
            )}
            <h3 className="font-bold text-text-primary truncate">Registrar intervención</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-surface-muted flex items-center justify-center text-muted shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {paso === "alerta" && (
            <>
              <p className="text-sm font-semibold text-secondary mb-3">¿Sobre qué alerta es esta intervención?</p>
              <div className="flex flex-col gap-2">
                {alertasDisponibles.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => elegirAlerta(a.id)}
                    className="text-left px-4 py-3 rounded-xl border border-divider hover:border-primary hover:bg-brand-soft transition-colors text-sm font-medium text-text-primary"
                  >
                    {etiquetaRegla(a.regla_principal)}
                  </button>
                ))}
                <button
                  onClick={() => elegirAlerta(null)}
                  className="text-left px-4 py-3 rounded-xl border border-dashed border-divider hover:border-primary text-sm text-secondary"
                >
                  Ninguna en particular
                </button>
              </div>
            </>
          )}

          {paso === "tipo" && (
            <>
              <p className="text-sm font-semibold text-secondary mb-3">¿Qué hiciste?</p>
              <div className="grid grid-cols-2 gap-2">
                {CATALOGO_TIPOS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => elegirTipo(t.value)}
                    className="px-3 py-3 rounded-xl border border-divider hover:border-primary hover:bg-brand-soft transition-colors text-sm font-medium text-text-primary text-center"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {paso === "paso2" && tipo === "sin_accion" && (
            <>
              <p className="text-sm font-semibold text-secondary mb-3">¿Por qué?</p>
              <div className="flex flex-col gap-2">
                {CATALOGO_MOTIVOS_SIN_ACCION.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => elegirMotivo(m.value)}
                    className="text-left px-4 py-3 rounded-xl border border-divider hover:border-primary hover:bg-brand-soft transition-colors text-sm font-medium text-text-primary"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {paso === "paso2" && tipo !== "sin_accion" && tipoConfig?.subtipos && (
            <>
              <p className="text-sm font-semibold text-secondary mb-3">{tipoConfig.label} — ¿cómo?</p>
              <div className="grid grid-cols-2 gap-2">
                {tipoConfig.subtipos.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => elegirSubtipo(s.value)}
                    className="px-3 py-3 rounded-xl border border-divider hover:border-primary hover:bg-brand-soft transition-colors text-sm font-medium text-text-primary text-center"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => elegirSubtipo(null)}
                className="mt-2 text-xs text-muted hover:text-secondary underline"
              >
                Omitir este paso
              </button>
            </>
          )}

          {paso === "nota" && (
            <>
              <p className="text-sm font-semibold text-secondary mb-1">Nota (opcional)</p>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                placeholder="Cualquier detalle que quieras recordar después…"
                className="w-full rounded-xl border border-divider px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
              {error && (
                <div className="mt-3 bg-error-soft text-error text-sm rounded-lg px-3 py-2">{error}</div>
              )}
              <button
                onClick={guardar}
                disabled={guardando}
                className="mt-4 w-full h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
