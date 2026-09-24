import type { AdherenceCalidad } from "@/app/_data/radar";

// Cierre de consistencia de R4A/R4B: adherence_global_calidad NO es
// decorativo — cuando el dominio con menor confianza es <20%
// ("incompleto") o está entre 20-49% ("parcial"), el número NO se
// presenta como si fuera una conclusión firme. Nunca "Adherencia: 90%"
// desnudo si los datos detrás son escasos.
export default function AdherenciaValor({
  valor,
  calidad,
}: {
  valor: number | null;
  calidad: AdherenceCalidad;
}) {
  if (valor === null) {
    return <span className="text-muted text-sm">Sin datos suficientes</span>;
  }
  if (calidad === "incompleto") {
    return (
      <span className="text-muted text-sm" title={`Valor calculado: ${Math.round(valor)}% — información insuficiente para mostrarlo con confianza`}>
        — <span className="italic">datos insuficientes</span>
      </span>
    );
  }
  if (calidad === "parcial") {
    return (
      <span className="inline-flex items-baseline gap-1.5">
        <span className="font-bold">{Math.round(valor)}%</span>
        <span className="text-warning text-xs font-medium">información parcial</span>
      </span>
    );
  }
  return <span className="font-bold">{Math.round(valor)}%</span>;
}
