import type { RadarEstado } from "@/app/_data/radar";

type EstadoConfig = {
  emoji: string;
  label: string;
  bg: string;
  text: string;
  dot: string;
};

// Reutiliza los tokens semánticos ya existentes del panel (success/warning/
// error + neutrales de texto/superficie) — no se inventa paleta nueva.
// "naranja" comparte los tokens de warning con "amarillo" (el sistema de
// diseño actual no tiene un 5º color semántico) pero se distingue por el
// emoji y el texto — nunca se confunden en el copy.
const ESTADO_CONFIG: Record<RadarEstado, EstadoConfig> = {
  rojo: { emoji: "🔴", label: "Necesita atención", bg: "bg-error-soft", text: "text-error", dot: "bg-error" },
  naranja: { emoji: "🟠", label: "Acción pendiente", bg: "bg-warning-soft", text: "text-warning", dot: "bg-warning" },
  amarillo: { emoji: "🟡", label: "Falta información", bg: "bg-warning-soft", text: "text-warning", dot: "bg-warning" },
  verde: { emoji: "🟢", label: "En buen camino", bg: "bg-success-soft", text: "text-success", dot: "bg-success" },
  blanco: { emoji: "⚪", label: "Sin historial suficiente", bg: "bg-surface-muted", text: "text-secondary", dot: "bg-text-muted" },
};

export function estadoConfig(estado: RadarEstado): EstadoConfig {
  return ESTADO_CONFIG[estado];
}

export default function EstadoBadge({
  estado,
  size = "md",
}: {
  estado: RadarEstado;
  size?: "sm" | "md";
}) {
  const c = ESTADO_CONFIG[estado];
  const sizeClasses = size === "sm" ? "text-[10px] px-2 py-0.5 gap-1" : "text-xs px-2.5 py-1 gap-1.5";
  return (
    <span className={`rounded-full font-semibold inline-flex items-center ${sizeClasses} ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} inline-block shrink-0`} />
      {c.label}
    </span>
  );
}
