"use client";
import Image from "next/image";
import { Info } from "lucide-react";
import type { Perfil } from "@/app/_data/perfiles";

function formatFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

export default function GeneralTab({ perfil }: { perfil: Perfil }) {
  const initials = (perfil.nombre_completo || "N")
    .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const rows: { label: string; value: string }[] = [
    { label: "Teléfono de cuenta", value: perfil.telefono || "—" },
    { label: "Fecha de nacimiento", value: formatFecha(perfil.fecha_nacimiento) },
    { label: "Sexo", value: perfil.sexo || "—" },
    { label: "Rol", value: perfil.rol },
    { label: "Registrado", value: perfil.created_at ? new Date(perfil.created_at).toLocaleDateString("es-MX") : "—" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        {perfil.avatar_url ? (
          <Image src={perfil.avatar_url} alt="" width={64} height={64} className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xl border-2 border-purple-200">
            {initials}
          </div>
        )}
        <div>
          <p className="font-bold text-text-primary text-lg">{perfil.nombre_completo || "Sin nombre"}</p>
          <p className="text-sm text-secondary">{perfil.email || "Sin correo"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {rows.map((r) => (
          <div key={r.label} className="bg-background-secondary rounded-xl p-3 border border-divider">
            <p className="text-xs text-secondary">{r.label}</p>
            <p className="font-semibold text-text-primary text-sm mt-0.5 capitalize">{r.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 bg-info-soft border border-info/20 text-info text-xs rounded-xl px-4 py-3">
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>
          Estos datos (foto, nombre, teléfono, correo de cuenta, fecha de nacimiento, sexo) se gestionan desde la
          edición estándar de Administradores. Esta pestaña es solo informativa — para cambiarlos, cierra este
          panel y usa &quot;Editar&quot; en la tabla de administradores.
        </p>
      </div>
    </div>
  );
}
