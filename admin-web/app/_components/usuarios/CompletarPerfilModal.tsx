"use client";
import { useState } from "react";
import type { Perfil } from "@/app/_data/perfiles";
import InformacionPersonalForm from "./InformacionPersonalForm";
import CitasManager from "./CitasManager";
import { X, User, CalendarDays } from "lucide-react";

type Tab = "personal" | "cita";
type LucideIcon = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

export default function CompletarPerfilModal({ perfiles, onClose }: { perfiles: Perfil[]; onClose: () => void }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [tab, setTab] = useState<Tab>("personal");

  const TABS: { key: Tab; label: string; Icon: LucideIcon }[] = [
    { key: "personal",  label: "Información Personal", Icon: User },
    { key: "cita",      label: "Cita",                 Icon: CalendarDays },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-divider">
          <div>
            <h2 className="font-bold text-text-primary text-xl">Completar perfil de usuario</h2>
            <p className="text-secondary text-sm">Selecciona un usuario registrado y completa su información personal y citas.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-surface-muted flex items-center justify-center text-muted"><X size={18} /></button>
        </div>

        {/* Selector de usuario */}
        <div className="px-6 pt-5">
          <label className="text-xs text-secondary font-medium block mb-1">Usuario</label>
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full h-10 border border-border rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary">
            <option value="">Selecciona un usuario...</option>
            {perfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre_completo || "Usuario sin nombre"}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-divider px-6 mt-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-secondary hover:text-text-primary"
              }`}
            >
              <t.Icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {!selectedUserId ? (
            <p className="text-sm text-muted text-center py-10">Selecciona un usuario para completar su información.</p>
          ) : (
            <>
              {tab === "personal" && <InformacionPersonalForm key={selectedUserId} userId={selectedUserId} />}
              {tab === "cita"     && <CitasManager key={selectedUserId} userId={selectedUserId} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-divider">
          <button onClick={onClose} className="px-5 h-10 rounded-xl border border-border text-secondary text-sm hover:bg-background-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
