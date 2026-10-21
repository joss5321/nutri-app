"use client";
import { useState } from "react";
import EspecialidadesTab from "@/app/_components/usuarios/perfil-profesional/EspecialidadesTab";
import type { Especialidad } from "@/app/_data/nutriologo_perfiles";

/**
 * Arnes de prueba para e2e/especialidades-error-retry.spec.ts (issue #24).
 * Monta EspecialidadesTab de forma aislada, sin pasar por el login/guard
 * de (admin) ni por datos reales — la prueba intercepta la llamada de red
 * a Supabase directamente. No esta enlazada desde ninguna navegacion real.
 */
export default function EspecialidadesTabHarness() {
  const [seleccionadas, setSeleccionadas] = useState<Especialidad[]>([]);
  return (
    <div style={{ padding: 24, maxWidth: 480 }}>
      <EspecialidadesTab
        nutriologoId="00000000-0000-0000-0000-000000000000"
        seleccionadas={seleccionadas}
        onChange={setSeleccionadas}
        canEdit={true}
      />
    </div>
  );
}
