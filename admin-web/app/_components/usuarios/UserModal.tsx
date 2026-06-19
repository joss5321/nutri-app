"use client";
import { useEffect, useState } from "react";
import type { Perfil } from "@/app/_data/perfiles";
import { fetchMedidasHistorial, type Medida } from "@/app/_data/medidas";
import { fetchEquivalentes, FOOD_GROUPS, MEAL_KEYS, type Equivalente } from "@/app/_data/nutricion";
import { fetchRutinaActiva, type Rutina } from "@/app/_data/rutinas";
import InformacionPersonalForm from "./InformacionPersonalForm";
import CitasManager from "./CitasManager";

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
function LineChart({ data }: { data: { label: string; value: number }[] }) {
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <path d={area} fill="#2EBD8C" fillOpacity="0.1" />
      <polyline points={pts} fill="none" stroke="#2EBD8C" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={gx(i)} cy={gy(d.value)} r="4" fill="#2EBD8C" />
          <text x={gx(i)} y={H - 2} textAnchor="middle" fontSize="8" fill="#9CA3AF">{d.label}</text>
          {i === data.length - 1 && (
            <rect x={gx(i) - 16} y={gy(d.value) - 18} width="32" height="14" rx="4" fill="#2EBD8C" />
          )}
          {i === data.length - 1 && (
            <text x={gx(i)} y={gy(d.value) - 8} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">{d.value}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ── Tab: Progreso ────────────────────────────────────────────
const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function Progreso({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [medidas, setMedidas] = useState<Medida[]>([]);
  const [equivalentes, setEquivalentes] = useState<Equivalente[]>([]);
  const [rutina, setRutina] = useState<Rutina | null>(null);

  useEffect(() => {
    Promise.all([
      fetchMedidasHistorial(userId),
      fetchEquivalentes(userId).then((r) => r.equivalentes).catch(() => [] as Equivalente[]),
      fetchRutinaActiva(userId),
    ])
      .then(([m, eq, r]) => { setMedidas(m); setEquivalentes(eq); setRutina(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-10">Cargando progreso...</p>;
  }

  const weightData = medidas
    .filter((m) => m.peso_kg != null)
    .map((m) => {
      const [, month] = m.fecha.split("-").map(Number);
      return { label: MONTH_SHORT[month - 1], value: m.peso_kg! };
    });

  const latest = medidas.length > 0 ? medidas[medidas.length - 1] : null;
  const first = medidas.length > 0 ? medidas[0] : null;
  const pesoDelta = latest?.peso_kg != null && first?.peso_kg != null
    ? (latest.peso_kg - first.peso_kg) : null;
  const masaDelta = latest?.masa_muscular_pct != null && first?.masa_muscular_pct != null
    ? (latest.masa_muscular_pct - first.masa_muscular_pct) : null;

  const eqRows = FOOD_GROUPS.map((fg) => {
    const row = equivalentes.find((e) => e.grupo === fg.grupo);
    const total = row ? MEAL_KEYS.reduce((acc, k) => acc + row[k], 0) : 0;
    return { grupo: fg.grupo, icono: fg.icono, total };
  }).filter((r) => r.total > 0);

  const rutinaDias = rutina?.rutina_dias ?? [];
  const workoutDays = rutinaDias.filter((d) => !d.es_descanso);
  const totalEjercicios = workoutDays.reduce((acc, d) => acc + d.rutina_ejercicios.length, 0);

  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      {/* Resumen general */}
      <div className="flex flex-col gap-3">
        <p className="font-bold text-gray-900">Resumen de medidas</p>
        {medidas.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Sin registros de medidas aún.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Peso actual", value: latest?.peso_kg != null ? `${latest.peso_kg} kg` : "—" },
                { label: "IMC actual", value: latest?.imc != null ? latest.imc.toFixed(1) : "—" },
                { label: "Cambio de peso", value: pesoDelta != null ? `${pesoDelta > 0 ? "+" : ""}${pesoDelta.toFixed(1)} kg` : "—" },
                { label: "Cambio masa muscular", value: masaDelta != null ? `${masaDelta > 0 ? "+" : ""}${masaDelta.toFixed(1)} %` : "—" },
                { label: "Cintura", value: latest?.cintura_cm != null ? `${latest.cintura_cm} cm` : "—" },
                { label: "Cadera", value: latest?.cadera_cm != null ? `${latest.cadera_cm} cm` : "—" },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="font-bold text-gray-900 text-xs mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
              <p className="text-xs text-gray-500">📊 Total de registros</p>
              <p className="font-extrabold text-xl text-gray-900">{medidas.length} medidas</p>
            </div>
          </>
        )}
      </div>

      {/* Evolución de peso */}
      <div className="flex flex-col gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="font-bold text-gray-900 text-xs mb-2">Evolución de peso</p>
          {weightData.length >= 2 ? (
            <>
              <LineChart data={weightData} />
              {pesoDelta != null && (
                <p className={`text-xs font-medium mt-1 ${pesoDelta <= 0 ? "text-primary" : "text-red-500"}`}>
                  {pesoDelta <= 0 ? "↓" : "↑"} {Math.abs(pesoDelta).toFixed(1)} kg en {medidas.length} registros
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-8">Se necesitan al menos 2 registros para la gráfica.</p>
          )}
        </div>

        {/* Rutina actual */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="font-bold text-gray-900 text-xs mb-2">Rutina asignada</p>
          {rutina ? (
            <>
              <p className="text-xs text-primary font-semibold mb-2">{rutina.nombre}</p>
              <div className="flex justify-between">
                {rutinaDias.map((d) => (
                  <div key={d.numero_dia} className="flex flex-col items-center gap-1.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                      d.es_descanso ? "bg-gray-100 text-gray-400" : "bg-primary text-white"
                    }`}>
                      {d.es_descanso ? "○" : d.rutina_ejercicios.length}
                    </div>
                    <span className="text-[9px] text-gray-500">{d.nombre_dia.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{workoutDays.length} días de entrenamiento</span>
                  <span>{totalEjercicios} ejercicios</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(workoutDays.length / 7) * 100}%` }} />
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">Sin rutina asignada.</p>
          )}
        </div>
      </div>

      {/* Progreso nutricional */}
      <div className="flex flex-col gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="font-bold text-gray-900 text-xs mb-2">Plan de equivalentes</p>
          {eqRows.length > 0 ? (
            <>
              <p className="text-xs text-gray-500 mb-3">Equivalentes diarios asignados</p>
              {eqRows.map((n) => (
                <div key={n.grupo} className="mb-2">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-600">{n.icono} {n.grupo}</span>
                    <span className="font-semibold text-gray-800">{n.total}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, n.total * 10)}%` }} />
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">Sin plan de equivalentes asignado.</p>
          )}
        </div>

        {/* Resumen de rutina: ejercicios */}
        {rutina && workoutDays.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="font-bold text-gray-900 text-xs mb-2">Ejercicios principales</p>
            {workoutDays.slice(0, 2).map((d) => (
              <div key={d.id} className="mb-2">
                <p className="text-xs text-primary font-semibold">{d.nombre_dia}</p>
                {d.rutina_ejercicios.slice(0, 3).map((ej) => (
                  <p key={ej.id} className="text-xs text-gray-500">
                    • {ej.series != null ? `${ej.series}×` : ""}{ej.repeticiones ?? ""} {ej.peso_sugerido_kg != null ? `(${ej.peso_sugerido_kg} kg)` : ""}
                  </p>
                ))}
                {d.rutina_ejercicios.length > 3 && (
                  <p className="text-xs text-gray-400">+{d.rutina_ejercicios.length - 3} más</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

// ── Modal principal ──────────────────────────────────────────
type Tab = "historial" | "progreso" | "citas";

export default function UserModal({ perfil, onClose }: { perfil: Perfil; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("historial");

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "historial", label: "Historial Clínico", icon: "🩺" },
    { key: "progreso",  label: "Progreso",          icon: "📈" },
    { key: "citas",     label: "Próximas Citas",    icon: "📅" },
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
                  isPremium ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {isPremium ? "👑 Premium" : "🔒 Básico"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                <span className="capitalize">{perfil.sexo || "—"}</span>
                <span>|</span>
                <span>🎂 {formatFecha(perfil.fecha_nacimiento)}</span>
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
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {tab === "historial" && <InformacionPersonalForm userId={perfil.id} />}
          {tab === "progreso"  && <Progreso userId={perfil.id} />}
          {tab === "citas"     && <CitasManager userId={perfil.id} />}
        </div>
      </div>
    </div>
  );
}
