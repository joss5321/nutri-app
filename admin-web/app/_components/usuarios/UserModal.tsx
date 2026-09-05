"use client";
import { useEffect, useState } from "react";
import type { Perfil } from "@/app/_data/perfiles";
import { fetchMedidasHistorial, type Medida } from "@/app/_data/medidas";
import { fetchRutinaActiva, type Rutina } from "@/app/_data/rutinas";
import { fetchEjercicioLogsByUser, type EjercicioLog } from "@/app/_data/ejercicio_logs";
import InformacionPersonalForm from "./InformacionPersonalForm";
import CitasManager from "./CitasManager";
import { X, Crown, Lock, Cake, Stethoscope, BarChart3, Dumbbell, CalendarDays, Trophy } from "lucide-react";

type LucideIcon = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

// ── Círculo de progreso SVG ─────────────────────────────────
function CircleProgress({ value, label, sub }: { value: number; label: string; sub: string }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#E5E7EB" strokeWidth="7" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="#2EBD8C" strokeWidth="7"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            transform="rotate(-90 40 40)" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">{value}%</span>
      </div>
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      <p className="text-xs text-primary">{sub}</p>
    </div>
  );
}

// ── Mini gráfica de línea ────────────────────────────────────
function LineChart({ data, unit = "" }: { data: { label: string; value: number }[]; unit?: string }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const W = 260, H = 90, PX = 24, PY = 12;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const gx = (i: number) => PX + (i / (data.length - 1)) * (W - PX * 2);
  const gy = (v: number) => H - PY - ((v - min) / range) * (H - PY * 2);
  const pts = data.map((d, i) => `${gx(i)},${gy(d.value)}`).join(" ");
  const area = `M${gx(0)},${gy(data[0].value)} ` +
    data.slice(1).map((d, i) => `L${gx(i + 1)},${gy(d.value)}`).join(" ") +
    ` L${gx(data.length - 1)},${H - PY} L${gx(0)},${H - PY} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ overflow: "visible" }}>
      <path d={area} fill="#2EBD8C" fillOpacity="0.1" />
      <polyline points={pts} fill="none" stroke="#2EBD8C" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const cx = gx(i);
        const cy = gy(d.value);
        const isLast = i === data.length - 1;
        const isHovered = hoveredIdx === i;
        const label = unit ? `${d.value} ${unit}` : String(d.value);
        // Ajustar ancho del tooltip según longitud del texto
        const tipW = label.length * 6 + 12;
        // Centrar horizontalmente, clampear a los bordes del viewBox
        const tipX = Math.min(W - tipW, Math.max(0, cx - tipW / 2));
        // Mostrar arriba del punto; si está muy cerca del top, mostrar abajo
        const tipAbove = cy - 22 >= 4;
        const tipY = tipAbove ? cy - 22 : cy + 10;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={isHovered ? 5 : 4} fill="#2EBD8C"
              style={{ transition: "r 0.1s" }} />
            <text x={cx} y={H - 2} textAnchor="middle" fontSize="8" fill="#9CA3AF">{d.label}</text>
            {/* Badge persistente en el último punto */}
            {isLast && !isHovered && (
              <>
                <rect x={cx - 16} y={cy - 18} width="32" height="14" rx="4" fill="#2EBD8C" />
                <text x={cx} y={cy - 8} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">{d.value}</text>
              </>
            )}
            {/* Tooltip on hover */}
            {isHovered && (
              <g style={{ pointerEvents: "none" }}>
                <rect x={tipX} y={tipY} width={tipW} height="15" rx="4" fill="#111827" opacity="0.88" />
                {/* pequeña flecha */}
                {tipAbove && (
                  <polygon
                    points={`${cx - 4},${tipY + 15} ${cx + 4},${tipY + 15} ${cx},${tipY + 20}`}
                    fill="#111827" opacity="0.88"
                  />
                )}
                <text x={tipX + tipW / 2} y={tipY + 10} textAnchor="middle" fontSize="8.5"
                  fill="white" fontWeight="bold" style={{ fontFamily: "system-ui, sans-serif" }}>
                  {label}
                </text>
              </g>
            )}
            {/* Área invisible de captura (más grande que el círculo) */}
            <circle cx={cx} cy={cy} r="12" fill="transparent" style={{ cursor: "crosshair" }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ── Tab: Progreso Medidas ────────────────────────────────────
const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function buildChartData(medidas: Medida[], key: "peso_kg" | "cintura_cm" | "cadera_cm" | "brazo_cm" | "pantorrilla_cm") {
  return medidas
    .filter((m) => m[key] != null)
    .map((m) => {
      const [, month] = m.fecha.split("-").map(Number);
      return { label: MONTH_SHORT[month - 1], value: m[key] as number };
    });
}

type MedidaKey = "peso_kg" | "cintura_cm" | "cadera_cm" | "brazo_cm" | "pantorrilla_cm" | "imc" | "grasa_pct" | "masa_muscular_pct";
type ChartDef = { title: string; key: MedidaKey; unit: string; color: string };
type Period = "all" | "3m" | "6m" | "1y";

const CHARTS: ChartDef[] = [
  { title: "Evolución de peso", key: "peso_kg", unit: "kg", color: "#2EBD8C" },
  { title: "Cintura", key: "cintura_cm", unit: "cm", color: "#60A5FA" },
  { title: "Cadera", key: "cadera_cm", unit: "cm", color: "#F472B6" },
  { title: "Brazo", key: "brazo_cm", unit: "cm", color: "#A78BFA" },
  { title: "Pantorrilla", key: "pantorrilla_cm", unit: "cm", color: "#FBBF24" },
  { title: "IMC", key: "imc", unit: "", color: "#F59E0B" },
  { title: "% Grasa", key: "grasa_pct", unit: "%", color: "#EF4444" },
  { title: "% Masa muscular", key: "masa_muscular_pct", unit: "%", color: "#8B5CF6" },
];

const PERIOD_LABELS: Record<Period, string> = { all: "Todo", "3m": "3 meses", "6m": "6 meses", "1y": "1 año" };

function filterByPeriod(medidas: Medida[], period: Period): Medida[] {
  if (period === "all") return medidas;
  const now = new Date();
  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return medidas.filter((m) => new Date(m.fecha) >= cutoff);
}

function buildChartDataFull(medidas: Medida[], key: MedidaKey) {
  return medidas
    .filter((m) => m[key] != null)
    .map((m) => {
      const [, month, day] = m.fecha.split("-").map(Number);
      return { label: `${day}/${MONTH_SHORT[month - 1]}`, value: m[key] as number, fecha: m.fecha };
    });
}

function ChartDetailModal({ chart, medidas, onClose }: { chart: ChartDef; medidas: Medida[]; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("all");
  const filtered = filterByPeriod(medidas, period);
  const data = buildChartDataFull(filtered, chart.key);
  const best = data.length > 0 ? Math.max(...data.map((d) => d.value)) : null;
  const worst = data.length > 0 ? Math.min(...data.map((d) => d.value)) : null;
  const latest = data.length > 0 ? data[data.length - 1] : null;
  const first = data.length > 0 ? data[0] : null;
  const delta = latest && first ? latest.value - first.value : null;
  const avg = data.length > 0 ? data.reduce((a, d) => a + d.value, 0) / data.length : null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{chart.title}</h3>
            <p className="text-sm text-gray-500">{data.length} registros</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Período */}
          <div className="flex gap-2">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  period === p ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Actual", value: latest ? `${latest.value.toFixed(1)} ${chart.unit}` : "—" },
              { label: "Cambio", value: delta != null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} ${chart.unit}` : "—", color: delta != null ? (delta <= 0 ? "text-green-600" : "text-red-500") : "" },
              { label: "Promedio", value: avg != null ? `${avg.toFixed(1)} ${chart.unit}` : "—" },
              { label: "Máximo", value: best != null ? `${best.toFixed(1)} ${chart.unit}` : "—" },
              { label: "Mínimo", value: worst != null ? `${worst.toFixed(1)} ${chart.unit}` : "—" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`font-bold text-sm mt-0.5 ${("color" in s && s.color) || "text-gray-900"}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Gráfica grande */}
          {data.length >= 2 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <LineChart data={data} />
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Se necesitan al menos 2 registros en este período.</p>
          )}

          {/* Tabla de datos */}
          {data.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Fecha</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Valor</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((d, i, arr) => {
                    const prev = i < arr.length - 1 ? arr[i + 1] : null;
                    const change = prev ? d.value - prev.value : null;
                    return (
                      <tr key={`${d.fecha}-${i}`} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-xs text-gray-700">{d.label}</td>
                        <td className="px-4 py-2 text-xs text-right font-semibold text-gray-900">{d.value.toFixed(1)} {chart.unit}</td>
                        <td className="px-4 py-2 text-xs text-right">
                          {change != null ? (
                            <span className={change <= 0 ? "text-green-600" : "text-red-500"}>
                              {change > 0 ? "+" : ""}{change.toFixed(1)}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgresoMedidas({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [medidas, setMedidas] = useState<Medida[]>([]);
  const [detailChart, setDetailChart] = useState<ChartDef | null>(null);

  useEffect(() => {
    fetchMedidasHistorial(userId)
      .then(setMedidas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Cargando medidas...</p>;
  if (medidas.length === 0) return <p className="text-sm text-gray-400 text-center py-10">Sin registros de medidas aún.</p>;

  const latest = medidas[medidas.length - 1];
  const first = medidas[0];
  const pesoDelta = latest?.peso_kg != null && first?.peso_kg != null ? (latest.peso_kg - first.peso_kg) : null;
  const masaDelta = latest?.masa_muscular_pct != null && first?.masa_muscular_pct != null ? (latest.masa_muscular_pct - first.masa_muscular_pct) : null;

  return (
    <div className="space-y-4 text-sm">
      {/* Resumen */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Peso actual", value: latest?.peso_kg != null ? `${latest.peso_kg} kg` : "—" },
          { label: "IMC actual", value: latest?.imc != null ? latest.imc.toFixed(1) : "—" },
          { label: "Cambio peso", value: pesoDelta != null ? `${pesoDelta > 0 ? "+" : ""}${pesoDelta.toFixed(1)} kg` : "—" },
          { label: "Cambio masa", value: masaDelta != null ? `${masaDelta > 0 ? "+" : ""}${masaDelta.toFixed(1)} %` : "—" },
          { label: "Cintura", value: latest?.cintura_cm != null ? `${latest.cintura_cm} cm` : "—" },
          { label: "Cadera", value: latest?.cadera_cm != null ? `${latest.cadera_cm} cm` : "—" },
          { label: "% Grasa", value: latest?.grasa_pct != null ? `${latest.grasa_pct} %` : "—" },
          { label: "Registros", value: String(medidas.length) },
        ].map((s) => (
          <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="font-bold text-gray-900 text-xs mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Gráficas */}
      <p className="text-xs text-gray-400">Haz clic en una gráfica para ver más detalles</p>
      <div className="grid grid-cols-2 gap-4">
        {CHARTS.map((c) => {
          const data = buildChartData(medidas, c.key as Parameters<typeof buildChartData>[1]);
          if (data.length < 2) return null;
          const last = data[data.length - 1].value;
          const firstV = data[0].value;
          const delta = last - firstV;
          return (
            <div key={c.key} onClick={() => setDetailChart(c)}
              className="bg-white rounded-xl border border-gray-200 p-3 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all">
              <div className="flex justify-between items-center mb-2">
                <p className="font-bold text-gray-900 text-xs">{c.title}</p>
                <span className={`text-xs font-semibold ${delta <= 0 ? "text-green-600" : "text-red-500"}`}>
                  {delta > 0 ? "+" : ""}{delta.toFixed(1)} {c.unit}
                </span>
              </div>
              <LineChart data={data} />
              <p className="text-[10px] text-gray-400 text-right mt-1">Clic para ampliar</p>
            </div>
          );
        })}
      </div>

      {detailChart && <ChartDetailModal chart={detailChart} medidas={medidas} onClose={() => setDetailChart(null)} />}
    </div>
  );
}

// ── Modal detalle de ejercicio ───────────────────────────────
type EjExercise = { id: string; nombre: string; emoji: string; logs: EjercicioLog[]; best: number | null };

type Session = {
  sesionId: string;
  fecha: string;
  series: { numeroSerie: number; pesoKg: number; id: string }[];
};

function buildSessions(logs: EjercicioLog[]): Session[] {
  const map = new Map<string, Session>();
  const order: string[] = [];
  for (const log of logs) {
    if (!map.has(log.sesion_id)) {
      map.set(log.sesion_id, { sesionId: log.sesion_id, fecha: log.fecha, series: [] });
      order.push(log.sesion_id);
    }
    map.get(log.sesion_id)!.series.push({
      numeroSerie: log.numero_serie,
      pesoKg: log.peso_kg,
      id: log.id,
    });
  }
  const sessions = order.map((id) => map.get(id)!);
  // sort series within each session by numero_serie
  for (const s of sessions) s.series.sort((a, b) => a.numeroSerie - b.numeroSerie);
  // sort sessions newest first; same fecha keeps insertion order (most recent sesion_id last in order array = newest)
  sessions.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return sessions;
}

function EjercicioDetailModal({ ej, onClose }: { ej: EjExercise; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("all");
  const allLogs = ej.logs;
  const filtered = period === "all" ? allLogs : (() => {
    const now = new Date();
    const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    return allLogs.filter((l) => new Date(l.fecha) >= cutoff);
  })();

  const sessions = buildSessions(filtered);

  // Stats based on max peso per session
  const sessionMaxPesos = sessions.map((s) => Math.max(...s.series.map((sr) => sr.pesoKg)));
  const best    = sessionMaxPesos.length > 0 ? Math.max(...sessionMaxPesos) : null;
  const worst   = sessionMaxPesos.length > 0 ? Math.min(...sessionMaxPesos) : null;
  const latestMax = sessions.length > 0 ? sessionMaxPesos[0] : null;           // sessions[0] = newest
  const firstMax  = sessions.length > 0 ? sessionMaxPesos[sessions.length - 1] : null;
  const delta   = latestMax != null && firstMax != null ? latestMax - firstMax : null;
  const avg     = sessionMaxPesos.length > 0
    ? sessionMaxPesos.reduce((a, b) => a + b, 0) / sessionMaxPesos.length
    : null;

  // Line chart: one point per session (max peso), oldest→newest
  const chartData = [...sessions].reverse().map((s) => {
    const [, m, d] = s.fecha.split("-").map(Number);
    return { label: `${d}/${MONTH_SHORT[m - 1]}`, value: Math.max(...s.series.map((sr) => sr.pesoKg)) };
  });

  // Trophy: most recent session+serie that holds the best peso
  let trophySesionId: string | null = null;
  let trophyNumSerie: number | null = null;
  if (best != null) {
    outer: for (const session of sessions) {         // sessions sorted newest first
      for (const serie of session.series) {
        if (serie.pesoKg === best) {
          trophySesionId = session.sesionId;
          trophyNumSerie = serie.numeroSerie;
          break outer;
        }
      }
    }
  }

  // Max series count across all sessions
  const maxSeries = sessions.length > 0 ? Math.max(...sessions.map((s) => s.series.length)) : 0;
  const serieColumns = Array.from({ length: maxSeries }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{ej.emoji} {ej.nombre}</h3>
            <p className="text-sm text-gray-500">{sessions.length} sesión{sessions.length !== 1 ? "es" : ""} · {maxSeries} serie{maxSeries !== 1 ? "s" : ""} máx.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Período */}
          <div className="flex gap-2">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  period === p ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Actual",    value: latestMax != null ? `${latestMax} kg` : "—" },
              { label: "Cambio",    value: delta != null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg` : "—", color: delta != null ? (delta >= 0 ? "text-green-600" : "text-red-500") : "" },
              { label: "Promedio",  value: avg   != null ? `${avg.toFixed(1)} kg` : "—" },
              { label: "Máximo", value: best  != null ? `${best} kg` : "—" },
              { label: "Mínimo",   value: worst  != null ? `${worst} kg` : "—" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`font-bold text-sm mt-0.5 ${("color" in s && s.color) || "text-gray-900"}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Gráfica de línea (max peso por sesión) */}
          {chartData.length >= 2 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <LineChart data={chartData} unit="kg" />
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Se necesitan al menos 2 sesiones en este período.</p>
          )}

          {/* Tabla por sesión × series */}
          {sessions.length > 0 && maxSeries > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 200 + maxSeries * 90 }}>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="sticky left-0 bg-gray-50 text-left px-4 py-2.5 text-xs font-semibold text-gray-500 border-r border-gray-200 whitespace-nowrap z-10">
                        Fecha
                      </th>
                      {serieColumns.map((n) => (
                        <th key={n} className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">
                          Serie {n}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => {
                      const [y, m, d] = session.fecha.split("-").map(Number);
                      const serieMap = new Map(session.series.map((sr) => [sr.numeroSerie, sr]));
                      return (
                        <tr key={session.sesionId} className="border-t border-gray-100 hover:bg-gray-50/50">
                          <td className="sticky left-0 bg-white hover:bg-gray-50/50 px-4 py-2.5 text-xs font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap z-10">
                            {d}/{MONTH_SHORT[m - 1]}/{String(y).slice(2)}
                          </td>
                          {serieColumns.map((n) => {
                            const serie = serieMap.get(n);
                            const isTrophy = session.sesionId === trophySesionId && n === trophyNumSerie;
                            return (
                              <td key={n} className="px-4 py-2.5 text-xs text-right font-semibold whitespace-nowrap">
                                {serie != null ? (
                                  <span className={`inline-flex items-center gap-1 ${isTrophy ? "text-primary" : "text-gray-800"}`}>
                                    {serie.pesoKg} kg{isTrophy && <Trophy size={11} className="text-primary" />}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Sin registros en este período.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Progreso Ejercicios ────────────────────────────────
function ProgresoEjercicios({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [ejLogs, setEjLogs] = useState<EjercicioLog[]>([]);
  const [rutina, setRutina] = useState<Rutina | null>(null);
  const [detailEj, setDetailEj] = useState<EjExercise | null>(null);

  useEffect(() => {
    Promise.all([fetchEjercicioLogsByUser(userId), fetchRutinaActiva(userId)])
      .then(([logs, r]) => { setEjLogs(logs); setRutina(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Cargando ejercicios...</p>;

  const loggedIds = [...new Set(ejLogs.map((l) => l.ejercicio_id))];
  const exercisesWithLogs: EjExercise[] = loggedIds
    .map((ejId) => {
      const logs = ejLogs.filter((l) => l.ejercicio_id === ejId);
      const best = logs.length > 0 ? Math.max(...logs.map((l) => l.peso_kg)) : null;
      const nombre = logs[0]?.ejercicios?.nombre ?? "Ejercicio";
      const emoji = logs[0]?.ejercicios?.emoji ?? "🏋️";
      return { id: ejId, nombre, emoji, logs, best };
    })
    .filter((ej) => ej.logs.length > 0);

  const rutinaDias = rutina?.rutina_dias ?? [];
  const workoutDays = rutinaDias.filter((d) => !d.es_descanso);
  const totalEjercicios = workoutDays.reduce((acc, d) => acc + d.rutina_ejercicios.length, 0);

  return (
    <div className="space-y-4 text-sm">
      {/* Rutina resumen */}
      {rutina && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="font-bold text-gray-900">{rutina.nombre}</p>
              <p className="text-xs text-gray-500">{workoutDays.length} días de entrenamiento · {totalEjercicios} ejercicios</p>
            </div>
          </div>
          <div className="flex gap-2">
            {rutinaDias.map((d) => (
              <div key={d.numero_dia} className="flex flex-col items-center gap-1 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  d.es_descanso ? "bg-gray-100 text-gray-400" : "bg-primary text-white"
                }`}>
                  {d.es_descanso ? "—" : d.rutina_ejercicios.length}
                </div>
                <span className="text-[9px] text-gray-500">{d.nombre_dia.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráficas de ejercicios */}
      {exercisesWithLogs.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-10">El usuario no ha registrado pesos en ejercicios aún.</p>
      ) : (
        <>
          <p className="text-xs text-gray-400">Haz clic en una gráfica para ver más detalles</p>
          <div className="grid grid-cols-2 gap-4">
            {exercisesWithLogs.map((ej) => {
              const recentLogs = ej.logs.slice(-10);
              const firstPeso = recentLogs[0].peso_kg;
              const lastPeso = recentLogs[recentLogs.length - 1].peso_kg;
              const delta = lastPeso - firstPeso;
              return (
                <div key={ej.id} onClick={() => setDetailEj(ej)}
                  className="bg-white rounded-xl border border-gray-200 p-3 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-bold text-gray-800 truncate">{ej.emoji} {ej.nombre}</p>
                    {ej.best != null && (
                      <span className="text-xs font-bold text-primary shrink-0 inline-flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-ink flex items-center justify-center shrink-0">
                          <Trophy size={9} className="text-highlight" />
                        </span>
                        {ej.best} kg
                      </span>
                    )}
                  </div>
                  {recentLogs.length >= 2 && (
                    <p className={`text-[10px] font-semibold mb-2 ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)} kg desde el primer registro
                    </p>
                  )}
                  <div className="flex items-end gap-1 h-16">
                    {recentLogs.map((log, i) => {
                      const maxV = Math.max(...recentLogs.map((l) => l.peso_kg));
                      const barH = Math.max(4, Math.round((log.peso_kg / maxV) * 40));
                      const isLast = i === recentLogs.length - 1;
                      const [, m, d] = log.fecha.split("-").map(Number);
                      return (
                        <div key={log.id} className="flex flex-col items-center flex-1" title={`${log.peso_kg} kg — ${d}/${m}`}>
                          <span className={`text-[8px] mb-0.5 ${isLast ? "text-primary font-bold" : "text-gray-400"}`}>
                            {log.peso_kg}
                          </span>
                          <div className={`w-3 rounded-sm ${isLast ? "bg-primary" : "bg-gray-300"}`} style={{ height: barH }} />
                          <span className="text-[7px] text-gray-400 mt-0.5">{d}/{m}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 text-right mt-1">Clic para ampliar</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {detailEj && <EjercicioDetailModal ej={detailEj} onClose={() => setDetailEj(null)} />}
    </div>
  );
}

function formatFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

// ── Modal principal ──────────────────────────────────────────
type Tab = "historial" | "progresoMedidas" | "progresoEjercicios" | "citas";

export default function UserModal({ perfil: perfilInicial, onClose }: { perfil: Perfil; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("historial");
  const [perfil, setPerfil] = useState<Perfil>(perfilInicial);

  const refreshPerfil = () => {
    import("@/app/_data/perfiles").then(({ fetchPerfil }) =>
      fetchPerfil(perfil.id).then(setPerfil).catch(() => {})
    );
  };

  const TABS: { key: Tab; label: string; Icon: LucideIcon }[] = [
    { key: "historial",          label: "Historial Clínico",   Icon: Stethoscope },
    { key: "progresoMedidas",    label: "Progreso Medidas",    Icon: BarChart3 },
    { key: "progresoEjercicios", label: "Progreso Ejercicios", Icon: Dumbbell },
    { key: "citas",              label: "Próximas Citas",      Icon: CalendarDays },
  ];

  const nombre = perfil.nombre_completo || "Usuario sin nombre";
  const initials = nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const isPremium = perfil.plan_membresia === "premium";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xl">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-900 text-xl">{nombre}</h2>
                <span className={`text-xs px-3 py-1 rounded-full font-semibold inline-flex items-center gap-1 ${
                  isPremium ? "bg-brand-soft text-primary" : "bg-gray-100 text-gray-600"
                }`}>
                  {isPremium ? <Crown size={11} /> : <Lock size={11} />}
                  {isPremium ? "Premium" : "Básico"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                <span className="capitalize">{perfil.sexo || "—"}</span>
                <span>|</span>
                <span className="inline-flex items-center gap-1"><Cake size={13} /> {formatFecha(perfil.fecha_nacimiento)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-6">
            <div className="text-right">
              <p className="text-xs text-gray-500">Registrado</p>
              <p className="text-sm font-semibold text-gray-700 mt-1">
                {perfil.created_at ? new Date(perfil.created_at).toLocaleDateString("es-MX") : "—"}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xl">
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <t.Icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {tab === "historial"          && <InformacionPersonalForm userId={perfil.id} onPerfilUpdated={refreshPerfil} />}
          {tab === "progresoMedidas"    && <ProgresoMedidas userId={perfil.id} />}
          {tab === "progresoEjercicios" && <ProgresoEjercicios userId={perfil.id} />}
          {tab === "citas"              && <CitasManager userId={perfil.id} />}
        </div>
      </div>
    </div>
  );
}
