"use client";
import { useState } from "react";

type User = {
  id: number; name: string; email: string; phone: string;
  plan: string; objetivo: string; lastAccess: string; status: string;
};

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

// ── Tab: Historial Clínico ───────────────────────────────────
function HistorialClinico({ user }: { user: User }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold text-gray-900">Historial Clínico</p>
        <p className="text-sm text-gray-500">Registra y consulta la información clínica del usuario.</p>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Fecha de registro", value: "23/11/2024", type: "text" },
          { label: "Peso actual (kg)",  value: "78.5",       type: "number" },
          { label: "Altura (cm)",       value: "175",        type: "number" },
          { label: "Edad",              value: "32",         type: "number" },
        ].map((f) => (
          <div key={f.label}>
            <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
            <input defaultValue={f.value} type={f.type}
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
          </div>
        ))}
        {[
          { label: "Circunferencia cintura (cm)", value: "88"   },
          { label: "Circunferencia cadera (cm)",  value: "102"  },
          { label: "% Grasa corporal",            value: "22.5" },
          { label: "% Masa muscular",             value: "38.3" },
        ].map((f) => (
          <div key={f.label}>
            <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
            <input defaultValue={f.value} type="number"
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
          </div>
        ))}
        {[
          { label: "Alergias",     value: "Ninguna"  },
          { label: "Padecimientos", value: "Ninguno" },
        ].map((f) => (
          <div key={f.label} className="col-span-2">
            <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
            <div className="flex items-center gap-2 h-10 border border-gray-200 rounded-xl px-3">
              <span className="text-gray-400 text-sm">⚕</span>
              <input defaultValue={f.value}
                className="flex-1 text-sm focus:outline-none text-gray-700" />
            </div>
          </div>
        ))}
        <div className="col-span-2">
          <label className="text-xs text-gray-500 font-medium block mb-1">Medicamentos</label>
          <div className="flex items-center gap-2 h-10 border border-gray-200 rounded-xl px-3">
            <span className="text-gray-400 text-sm">💊</span>
            <input defaultValue="Ninguno"
              className="flex-1 text-sm focus:outline-none text-gray-700" />
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 font-medium block mb-1">Observaciones</label>
          <div className="flex items-start gap-2 border border-gray-200 rounded-xl px-3 py-2">
            <span className="text-gray-400 text-sm mt-0.5">📋</span>
            <textarea placeholder="Observaciones generales del usuario..."
              className="flex-1 text-sm focus:outline-none text-gray-700 resize-none h-14" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button className="flex items-center gap-2 px-4 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
          ✕ Cancelar
        </button>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark">
            💾 Guardar
          </button>
          <button className="flex items-center gap-2 px-4 h-10 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/5">
            📄 Exportar PDF
          </button>
          <button className="flex items-center gap-2 px-4 h-10 rounded-xl border border-green-600 text-green-700 text-sm font-semibold hover:bg-green-50">
            📊 Exportar Excel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Progreso ────────────────────────────────────────────
function Progreso() {
  const weightData = [
    { label: "Dic", value: 82.7 }, { label: "Ene", value: 81.4 },
    { label: "Feb", value: 80.1 }, { label: "Mar", value: 78.9 },
    { label: "Abr", value: 77.5 }, { label: "May", value: 78.5 },
  ];
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const dayStatus = ["done", "done", "done", "in-progress", "pending", "pending", "pending"];

  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      {/* Resumen general */}
      <div className="flex flex-col gap-3">
        <p className="font-bold text-gray-900">Resumen general</p>
        <div className="flex gap-3 justify-between">
          <CircleProgress value={82} label="Dieta"        sub="Excelente"   />
          <CircleProgress value={67} label="Entrenamiento" sub="Bueno"      />
          <CircleProgress value={91} label="Hidratación"  sub="Excelente"   />
        </div>
        <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
          <p className="text-xs text-gray-500">🔥 Racha actual</p>
          <p className="font-extrabold text-xl text-gray-900">28 días seguidos</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Peso perdido",    value: "-4.2 kg"        },
            { label: "Masa muscular",   value: "+2.1 %"         },
            { label: "Adherencia",      value: "87 %"           },
            { label: "Evaluación",      value: "Muy buen progreso" },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="font-bold text-gray-900 text-xs mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Evolución de peso + entrenamiento */}
      <div className="flex flex-col gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex justify-between items-center mb-2">
            <p className="font-bold text-gray-900 text-xs">Evolución de peso</p>
            <select className="text-xs border border-gray-200 rounded-lg px-2 py-1">
              <option>6 meses</option>
            </select>
          </div>
          <LineChart data={weightData} />
          <p className="text-xs text-primary font-medium mt-1">↓ 4.2 kg perdidos en 6 meses</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex justify-between items-center mb-3">
            <p className="font-bold text-gray-900 text-xs">Progreso de entrenamiento</p>
            <select className="text-xs border border-gray-200 rounded-lg px-2 py-1">
              <option>Esta semana</option>
            </select>
          </div>
          <div className="flex justify-between">
            {days.map((d, i) => (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                  dayStatus[i] === "done"        ? "bg-primary text-white" :
                  dayStatus[i] === "in-progress" ? "bg-yellow-400 text-white" :
                                                   "bg-gray-100 text-gray-400"
                }`}>
                  {dayStatus[i] === "done" ? "✓" : dayStatus[i] === "in-progress" ? "●" : "○"}
                </div>
                <span className="text-[9px] text-gray-500">{d}</span>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>3 de 7 entrenamientos completados</span>
              <span>43%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full">
              <div className="h-full bg-primary rounded-full" style={{ width: "43%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Progreso nutricional + enfoque */}
      <div className="flex flex-col gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="font-bold text-gray-900 text-xs mb-2">Progreso nutricional</p>
          <p className="text-xs text-gray-500 mb-3">Equivalentes diarios promedio</p>
          {[
            { label: "Cereales sin grasa", actual: 2, total: 2 },
            { label: "Frutas",             actual: 3, total: 3 },
            { label: "Verduras",           actual: 5, total: 5 },
            { label: "Leche descremada",   actual: 1, total: 1 },
            { label: "POA bajo aporte",    actual: 2, total: 2 },
          ].map((n) => (
            <div key={n.label} className="mb-2">
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-600">{n.label}</span>
                <span className="font-semibold text-gray-800">{n.actual} / {n.total}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(n.actual / n.total) * 100}%` }} />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2 text-xs text-primary font-medium">
            ✅ Excelente cumplimiento nutricional
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex justify-between items-center mb-2">
            <p className="font-bold text-gray-900 text-xs">Enfoque actual</p>
            <span className="text-xs text-primary">Semana 4 de 8</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-3xl">🏋️</div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Espalda y Bíceps</p>
              {["Dominadas", "Remo con barra", "Curl de bíceps", "Face pull"].map((e) => (
                <p key={e} className="text-xs text-gray-500">• {e}</p>
              ))}
            </div>
          </div>
          <button className="mt-2 text-xs text-primary font-semibold hover:underline">🏋️ Ver rutina completa</button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Próximas Citas ──────────────────────────────────────
function ProximasCitas() {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const upcomingAppointments = [
    { date: "MAY 15", time: "10:30 AM", type: "Nutrición",     pro: "Lic. Ana Torres",  modal: "Presencial", status: "Confirmada" },
    { date: "MAY 22", time: "04:00 PM", type: "Entrenamiento", pro: "Lic. Carlos Vega", modal: "Presencial", status: "Confirmada" },
    { date: "MAY 30", time: "05:00 PM", type: "Seguimiento",   pro: "Lic. Ana Torres",  modal: "En línea",   status: "Pendiente"  },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Calendario */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <button className="text-gray-400 hover:text-gray-600">‹</button>
          <p className="font-bold text-gray-900 text-sm">Mayo 2024</p>
          <button className="text-gray-400 hover:text-gray-600">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d) => (
            <span key={d} className="text-xs text-gray-400 font-medium py-1">{d}</span>
          ))}
          {days.map((d) => (
            <button key={d} className={`text-xs h-7 w-7 mx-auto rounded-full flex items-center justify-center transition-colors ${
              d === 15 ? "bg-primary text-white font-bold" :
              d === 22 || d === 30 ? "bg-primary/10 text-primary font-semibold" :
              "text-gray-700 hover:bg-gray-100"
            }`}>{d}</button>
          ))}
        </div>
        <div className="mt-3 p-2.5 bg-primary/5 rounded-xl border border-primary/20">
          <p className="text-xs font-semibold text-primary">📅 Miércoles 15 de mayo</p>
          <p className="text-xs text-gray-500 mt-0.5">• 1 cita programada</p>
        </div>
      </div>

      {/* Formulario nueva cita */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="font-bold text-gray-900 text-sm mb-3">📋 Registrar nueva cita</p>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha</label>
              <input type="date" defaultValue="2024-05-15"
                className="w-full h-9 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Hora</label>
              <input type="time" defaultValue="10:30"
                className="w-full h-9 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none focus:border-primary" />
            </div>
          </div>
          {[
            { label: "Tipo de cita",  options: ["Nutrición", "Entrenamiento", "Seguimiento"] },
            { label: "Profesional",   options: ["Lic. Ana Torres", "Lic. Carlos Vega"] },
            { label: "Modalidad",     options: ["Presencial", "En línea"] },
          ].map((f) => (
            <div key={f.label}>
              <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
              <select className="w-full h-9 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none focus:border-primary">
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
            <textarea placeholder="Escribe alguna nota adicional..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary resize-none h-16" />
          </div>
          <button className="w-full h-10 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark">
            📅 Guardar cita
          </button>
        </div>
      </div>

      {/* Lista de próximas citas */}
      <div className="flex flex-col gap-3">
        <p className="font-bold text-gray-900 text-sm">Próximas citas</p>
        {upcomingAppointments.map((a, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 flex gap-3">
            <div className="flex flex-col items-center bg-primary text-white rounded-xl px-3 py-2 text-center shrink-0">
              <span className="text-xs font-bold opacity-80">{a.date.split(" ")[0]}</span>
              <span className="text-lg font-extrabold">{a.date.split(" ")[1]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-gray-900 text-xs">{a.time}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  a.status === "Confirmada" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}>{a.status}</span>
              </div>
              <p className="font-bold text-gray-800 text-sm mt-0.5">{a.type}</p>
              <p className="text-xs text-gray-500">{a.pro}</p>
              <p className="text-xs text-gray-400">📍 {a.modal}</p>
            </div>
          </div>
        ))}
        <div className="mt-1 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
          <p className="text-xs font-bold text-yellow-800 mb-1">💡 Recomendaciones</p>
          {[
            "Llega 10 minutos antes de tu cita.",
            "Si no puedes asistir, cancela con anticipación.",
            "Mantén tus datos de salud actualizados.",
          ].map((r, i) => (
            <p key={i} className="text-xs text-yellow-700">• {r}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modal principal ──────────────────────────────────────────
type Tab = "historial" | "progreso" | "citas";

export default function UserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("historial");

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "historial", label: "Historial Clínico", icon: "🩺" },
    { key: "progreso",  label: "Progreso",          icon: "📈" },
    { key: "citas",     label: "Próximas Citas",    icon: "📅" },
  ];

  const initials = user.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

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
                <h2 className="font-bold text-gray-900 text-xl">{user.name}</h2>
                <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Activo
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                <span>✉ {user.email}</span>
                <span>|</span>
                <span>📱 {user.phone}</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-6">
            <div className="text-right">
              <p className="text-xs text-gray-500">Plan actual</p>
              <span className={`text-sm font-bold px-3 py-1 rounded-full inline-block mt-1 ${
                user.plan === "Premium" ? "bg-green-100 text-green-700" :
                user.plan === "Pro"     ? "bg-teal-100 text-teal-700"   :
                                          "bg-gray-100 text-gray-600"
              }`}>
                {user.plan === "Premium" ? "👑 " : "🔒 "}{user.plan}
              </span>
              <p className="text-xs text-gray-400 mt-1">📅 Renovación: 23/12/2024</p>
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
          {tab === "historial" && <HistorialClinico user={user} />}
          {tab === "progreso"  && <Progreso />}
          {tab === "citas"     && <ProximasCitas />}
        </div>
      </div>
    </div>
  );
}
