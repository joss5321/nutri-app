"use client";
import { useState } from "react";
import type { Perfil } from "@/app/_data/perfiles";
import InformacionPersonalForm from "./InformacionPersonalForm";
import NutricionEquivalentesForm from "./NutricionEquivalentesForm";
import RecetasAsignadasForm from "./RecetasAsignadasForm";
import CitasManager from "./CitasManager";

type Tab = "personal" | "nutricion" | "cita";

export default function CompletarPerfilModal({ perfiles, onClose }: { perfiles: Perfil[]; onClose: () => void }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [tab, setTab] = useState<Tab>("personal");

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "personal",  label: "Información Personal", icon: "👤" },
    { key: "nutricion", label: "Nutrición",            icon: "🥗" },
    { key: "cita",      label: "Cita",                 icon: "📅" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-xl">Completar perfil de usuario</h2>
            <p className="text-gray-500 text-sm">Selecciona un usuario registrado y completa su información personal, nutrición y citas.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">×</button>
        </div>

        {/* Selector de usuario */}
        <div className="px-6 pt-5">
          <label className="text-xs text-gray-500 font-medium block mb-1">Usuario</label>
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary">
            <option value="">Selecciona un usuario...</option>
            {perfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre_completo || "Usuario sin nombre"}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 mt-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {!selectedUserId ? (
            <p className="text-sm text-gray-400 text-center py-10">Selecciona un usuario para completar su información.</p>
          ) : (
            <>
              {tab === "personal"  && <InformacionPersonalForm key={selectedUserId} userId={selectedUserId} />}
              {tab === "nutricion" && (
                <div className="space-y-8">
                  <NutricionEquivalentesForm key={selectedUserId} userId={selectedUserId} />
                  <RecetasAsignadasForm key={`r-${selectedUserId}`} userId={selectedUserId} />
                </div>
              )}
              {tab === "cita"      && <CitasManager key={selectedUserId} userId={selectedUserId} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-5 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
