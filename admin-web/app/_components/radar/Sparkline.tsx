// Sparkline ligero, sin librería de gráficas — mismo criterio que el
// LineChart ya hecho a mano en UserModal.tsx. Solo dibuja una tendencia,
// no reinterpreta ni recalcula ningún valor: recibe los números ya
// calculados por el motor (adherence_global de cada snapshot).
export default function Sparkline({
  valores,
  width = 220,
  height = 48,
  color = "#2EBD8C",
}: {
  valores: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const puntos = valores
    .map((v, i) => ({ i, v }))
    .filter((p): p is { i: number; v: number } => p.v !== null);

  if (puntos.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted"
        style={{ width, height }}
      >
        Sin suficiente historial todavía
      </div>
    );
  }

  const max = Math.max(...puntos.map((p) => p.v), 100);
  const min = Math.min(...puntos.map((p) => p.v), 0);
  const rango = max - min || 1;
  const pad = 4;

  const coords = puntos.map((p) => {
    const x = pad + (p.i / (valores.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p.v - min) / rango) * (height - pad * 2);
    return { x, y };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const ultimo = coords[coords.length - 1];

  return (
    <svg width={width} height={height} role="img" aria-label="Tendencia de adherencia">
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ultimo.x} cy={ultimo.y} r={3} fill={color} />
    </svg>
  );
}
