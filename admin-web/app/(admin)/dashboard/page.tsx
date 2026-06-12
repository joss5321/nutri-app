export default function DashboardPage() {
  const stats = [
    { label: "Usuarios activos",    value: "320",  icon: "👥", delta: "+12 este mes",   color: "bg-blue-50 text-blue-600"    },
    { label: "Rutinas asignadas",   value: "148",  icon: "🏋️", delta: "+8 esta semana", color: "bg-green-50 text-green-600"  },
    { label: "Recetas disponibles", value: "64",   icon: "🥗", delta: "+3 nuevas",      color: "bg-orange-50 text-orange-600"},
    { label: "Planes premium",      value: "97",   icon: "👑", delta: "30% del total",  color: "bg-purple-50 text-purple-600"},
  ];

  const recent = [
    { name: "Valeria Hernández", action: "completó Día 3 — Piernas",    time: "Hace 5 min",  plan: "Premium" },
    { name: "Diego Martínez",    action: "registró nuevas medidas",      time: "Hace 18 min", plan: "Básico"  },
    { name: "Sofía Ramírez",     action: "guardó receta Avena con frutas", time: "Hace 32 min", plan: "Pro"  },
    { name: "Carlos López",      action: "completó semana 4 de rutina",  time: "Hace 1h",     plan: "Premium" },
    { name: "Fernanda Torres",   action: "inició sesión",                time: "Hace 1h 20min",plan: "Básico"},
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen general de la plataforma</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm text-gray-500 font-medium">{s.label}</span>
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${s.color}`}>
                {s.icon}
              </span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{s.value}</p>
            <p className="text-xs text-primary font-medium mt-1">{s.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Actividad reciente */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Actividad reciente</h2>
            <span className="text-xs text-primary font-semibold">Ver todo</span>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.map((r, i) => (
              <div key={i} className="flex items-start gap-3 px-6 py-4">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {r.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                  <p className="text-xs text-gray-500 truncate">{r.action}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-gray-400">{r.time}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.plan === "Premium" ? "bg-green-100 text-green-700" :
                    r.plan === "Pro"     ? "bg-teal-100 text-teal-700" :
                                          "bg-gray-100 text-gray-600"
                  }`}>{r.plan}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribución de planes */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Distribución de planes</h2>
          </div>
          <div className="p-6 flex flex-col gap-4">
            {[
              { label: "Premium", value: 97,  pct: 30, color: "bg-primary"      },
              { label: "Pro",     value: 126, pct: 39, color: "bg-teal-400"     },
              { label: "Básico",  value: 97,  pct: 31, color: "bg-gray-300"     },
            ].map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-gray-700">{p.label}</span>
                  <span className="text-gray-500">{p.value} usuarios ({p.pct}%)</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${p.color} rounded-full`} style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            ))}

            <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
              <p className="text-sm font-semibold text-gray-700">Total usuarios</p>
              <p className="text-2xl font-extrabold text-primary mt-1">320</p>
              <p className="text-xs text-gray-500 mt-0.5">Crecimiento mensual: +12 usuarios</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
