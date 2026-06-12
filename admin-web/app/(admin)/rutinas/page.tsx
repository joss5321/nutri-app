"use client";
import { useState } from "react";
import RutinaBuilderModal from "@/app/_components/rutinas/RutinaBuilderModal";

const USERS = [
  { id: 1, name: "Valeria Hernández", email: "valeria.hdez@gmail.com",   phone: "55 1234 5678", plan: "Premium", objetivo: "Bajar peso",          lastAccess: "Hoy, 10:30 AM",  status: "Activo" },
  { id: 2, name: "Diego Martínez",    email: "diego.martinez@gmail.com",  phone: "55 8765 4321", plan: "Básico",  objetivo: "Ganar masa",          lastAccess: "Ayer, 08:15 PM", status: "Activo" },
  { id: 3, name: "Sofía Ramírez",     email: "sofia.ramirez@gmail.com",   phone: "55 2345 6789", plan: "Pro",     objetivo: "Definición",          lastAccess: "Ayer, 07:45 PM", status: "Activo" },
  { id: 4, name: "Carlos López",      email: "carlos.lopez@gmail.com",    phone: "55 3456 7890", plan: "Premium", objetivo: "Salud general",       lastAccess: "26/05/2024",     status: "Activo" },
  { id: 5, name: "Fernanda Torres",   email: "fernanda.torres@gmail.com", phone: "55 4567 8901", plan: "Básico",  objetivo: "Bajar peso",          lastAccess: "26/05/2024",     status: "Activo" },
  { id: 6, name: "Jorge Sánchez",     email: "jorge.sanchez@gmail.com",   phone: "55 5678 9012", plan: "Pro",     objetivo: "Mejorar rendimiento", lastAccess: "25/05/2024",     status: "Activo" },
  { id: 7, name: "Paula Medina",      email: "paula.medina@gmail.com",    phone: "55 6789 0123", plan: "Básico",  objetivo: "Bajar peso",          lastAccess: "25/05/2024",     status: "Activo" },
  { id: 8, name: "Andrés Vega",       email: "andres.vega@gmail.com",     phone: "55 7890 1234", plan: "Premium", objetivo: "Salud general",       lastAccess: "24/05/2024",     status: "Activo" },
];

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    Premium: "bg-green-100 text-green-700",
    Pro:     "bg-teal-100  text-teal-700",
    Básico:  "bg-gray-100  text-gray-600",
  };
  return (
    <span className={`text-xs px-3 py-1 rounded-full font-semibold inline-flex items-center gap-1 ${map[plan]}`}>
      {plan === "Premium" ? "👑" : "🔒"} {plan}
    </span>
  );
}

export default function RutinasPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<typeof USERS[number] | null>(null);

  const filtered = USERS.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rutinas</h1>
          <p className="text-gray-500 text-sm mt-1">Selecciona un usuario para ver y armar su rutina semanal.</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 h-11 mb-5 max-w-sm shadow-sm">
        <span className="text-gray-400">🔍</span>
        <input
          placeholder="Buscar usuario, correo o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm focus:outline-none text-gray-700"
        />
      </div>

      {/* Table — seleccionar usuario para asignar rutina */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {["Nombre ↕", "Correo electrónico ↕", "Teléfono ↕", "Plan actual ↕", "Objetivo ↕", "Último acceso ↕", "Estado ↕", "Acciones"].map((h) => (
                <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className="font-medium text-gray-900">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-gray-600">{u.email}</td>
                <td className="px-4 py-3.5 text-gray-600">{u.phone}</td>
                <td className="px-4 py-3.5"><PlanBadge plan={u.plan} /></td>
                <td className="px-4 py-3.5 text-gray-600">{u.objetivo}</td>
                <td className="px-4 py-3.5 text-gray-500">{u.lastAccess}</td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-1.5 text-green-600 font-medium text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{u.status}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <button
                    onClick={() => setSelected(u)}
                    className="flex items-center gap-2 h-9 px-3 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 hover:text-primary text-gray-600 text-xs font-semibold transition-colors"
                    title="Ver y armar rutina"
                  >
                    🏋️ Ver rutina
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3.5 border-t border-gray-100">
          <span className="text-xs text-gray-500">Mostrando 1 a 8 de 320 usuarios</span>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 text-xs">‹</button>
            {[1, 2, 3, "...", 40].map((p, i) => (
              <button key={i} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                p === 1 ? "bg-primary text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>{p}</button>
            ))}
            <button className="w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 text-xs">›</button>
          </div>
        </div>
      </div>

      {selected && <RutinaBuilderModal patient={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
