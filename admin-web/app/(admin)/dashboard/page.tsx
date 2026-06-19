"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Stats = {
  totalUsuarios: number;
  totalPremium: number;
  totalBasico: number;
  totalRutinas: number;
  totalRecetas: number;
  totalCitas: number;
};

type RecentUser = {
  id: string;
  nombre_completo: string | null;
  plan_membresia: string;
  created_at: string;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalUsuarios: 0, totalPremium: 0, totalBasico: 0,
    totalRutinas: 0, totalRecetas: 0, totalCitas: 0,
  });
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);

  useEffect(() => {
    async function load() {
      const [
        { count: totalUsuarios },
        { count: totalPremium },
        { count: totalBasico },
        { count: totalRutinas },
        { count: totalRecetas },
        { count: totalCitas },
        { data: recents },
      ] = await Promise.all([
        supabase.from("perfiles").select("*", { count: "exact", head: true }).eq("rol", "usuario"),
        supabase.from("perfiles").select("*", { count: "exact", head: true }).eq("plan_membresia", "premium").eq("rol", "usuario"),
        supabase.from("perfiles").select("*", { count: "exact", head: true }).eq("plan_membresia", "basico").eq("rol", "usuario"),
        supabase.from("rutinas").select("*", { count: "exact", head: true }).eq("activa", true),
        supabase.from("recetas").select("*", { count: "exact", head: true }),
        supabase.from("citas").select("*", { count: "exact", head: true }).eq("estado", "pendiente"),
        supabase.from("perfiles").select("id, nombre_completo, plan_membresia, created_at")
          .eq("rol", "usuario").order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({
        totalUsuarios: totalUsuarios ?? 0,
        totalPremium: totalPremium ?? 0,
        totalBasico: totalBasico ?? 0,
        totalRutinas: totalRutinas ?? 0,
        totalRecetas: totalRecetas ?? 0,
        totalCitas: totalCitas ?? 0,
      });
      setRecentUsers((recents as RecentUser[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const total = stats.totalUsuarios || 1;
  const pctPremium = Math.round((stats.totalPremium / total) * 100);
  const pctBasico = Math.round((stats.totalBasico / total) * 100);

  const kpis = [
    { label: "Usuarios registrados", value: String(stats.totalUsuarios), icon: "👥", sub: `${stats.totalPremium} premium, ${stats.totalBasico} básico`, color: "bg-blue-50 text-blue-600" },
    { label: "Rutinas activas",      value: String(stats.totalRutinas),  icon: "🏋️", sub: "Asignadas a usuarios",     color: "bg-green-50 text-green-600" },
    { label: "Recetas en catálogo",  value: String(stats.totalRecetas),  icon: "🥗", sub: "Disponibles para asignar", color: "bg-orange-50 text-orange-600" },
    { label: "Citas pendientes",     value: String(stats.totalCitas),    icon: "📅", sub: "Por confirmar",             color: "bg-purple-50 text-purple-600" },
  ];

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-sm text-gray-400 text-center py-20">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen general de la plataforma</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {kpis.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm text-gray-500 font-medium">{s.label}</span>
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${s.color}`}>
                {s.icon}
              </span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{s.value}</p>
            <p className="text-xs text-primary font-medium mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Usuarios recientes */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Últimos usuarios registrados</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentUsers.map((u) => {
              const nombre = u.nombre_completo || "Sin nombre";
              const isPremium = u.plan_membresia === "premium";
              return (
                <div key={u.id} className="flex items-start gap-3 px-6 py-4">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{nombre}</p>
                    <p className="text-xs text-gray-500">Se registró</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-gray-400">{timeAgo(u.created_at)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isPremium ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {isPremium ? "👑 Premium" : "🔒 Básico"}
                    </span>
                  </div>
                </div>
              );
            })}
            {recentUsers.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No hay usuarios registrados aún.</p>
            )}
          </div>
        </div>

        {/* Distribución de planes */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Distribución de planes</h2>
          </div>
          <div className="p-6 flex flex-col gap-4">
            {[
              { label: "Premium", value: stats.totalPremium, pct: pctPremium, color: "bg-primary" },
              { label: "Básico",  value: stats.totalBasico,  pct: pctBasico,  color: "bg-gray-300" },
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
              <p className="text-2xl font-extrabold text-primary mt-1">{stats.totalUsuarios}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
