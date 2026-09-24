"use client";
import type { GrupoResumen } from "@/app/_data/radar";

// R5.1: 5 cards, una por estado real del motor — rojo (deterioro
// confirmado) y naranja (acción operativa pendiente) se muestran
// separados a propósito, nunca como si fueran lo mismo.
const CONFIG: { key: GrupoResumen; emoji: string; label: string; bg: string; text: string; ring: string }[] = [
  { key: "rojo", emoji: "🔴", label: "Necesitan atención", bg: "bg-error-soft", text: "text-error", ring: "ring-error/30" },
  { key: "naranja", emoji: "🟠", label: "Acción pendiente", bg: "bg-warning-soft", text: "text-warning", ring: "ring-warning/30" },
  { key: "amarillo", emoji: "🟡", label: "Falta información", bg: "bg-warning-soft", text: "text-warning", ring: "ring-warning/30" },
  { key: "verde", emoji: "🟢", label: "En buen camino", bg: "bg-success-soft", text: "text-success", ring: "ring-success/30" },
  { key: "blanco", emoji: "⚪", label: "Sin historial suficiente", bg: "bg-surface-muted", text: "text-secondary", ring: "ring-border" },
];

export default function ResumenEstados({
  conteos,
  filtroActivo,
  onFiltrar,
}: {
  conteos: Record<GrupoResumen, number>;
  filtroActivo: GrupoResumen | null;
  onFiltrar: (grupo: GrupoResumen | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {CONFIG.map((c) => {
        const activo = filtroActivo === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onFiltrar(activo ? null : c.key)}
            className={`
              text-left rounded-xl border p-4 transition-all
              ${activo ? `border-transparent ring-2 ${c.ring} bg-white shadow-sm` : "border-divider bg-white hover:border-primary/30"}
            `}
          >
            <p className="text-2xl font-bold text-text-primary">{conteos[c.key]}</p>
            <p className={`text-xs font-semibold mt-1 inline-flex items-center gap-1 ${c.text}`}>
              <span>{c.emoji}</span> {c.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
