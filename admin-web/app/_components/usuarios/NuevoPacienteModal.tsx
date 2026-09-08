"use client";
import { useState } from "react";
import { crearPacienteWeb } from "@/app/_data/nuevo_paciente";

const IC = "w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary";
const LB = "text-xs text-secondary font-medium block mb-1";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NuevoPacienteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [sexo, setSexo] = useState("femenino");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nombreValido = nombre.trim().length > 0;
  const emailValido = EMAIL_RE.test(email.trim());
  const puedeGuardar = nombreValido && emailValido && !saving;

  const handleSubmit = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    setError(null);
    try {
      await crearPacienteWeb({
        nombre,
        apellidos,
        fecha_nacimiento: fechaNacimiento,
        sexo,
        telefono,
        email,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el paciente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-divider">
          <h2 className="font-bold text-text-primary text-lg">Nuevo paciente</h2>
          <p className="text-sm text-secondary mt-1">
            Regístralo directamente aunque todavía no use la app móvil. Quedará asignado a tu
            cuenta y podrás asignarle rutinas, planes y citas de inmediato.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LB}>Nombre *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={IC} autoFocus />
            </div>
            <div>
              <label className={LB}>Apellidos</label>
              <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} className={IC} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LB}>Fecha de nacimiento</label>
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className={IC}
              />
            </div>
            <div>
              <label className={LB}>Sexo</label>
              <select value={sexo} onChange={(e) => setSexo(e.target.value)} className={IC + " bg-white"}>
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LB}>Teléfono</label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={IC}
                placeholder="10 dígitos"
              />
            </div>
            <div>
              <label className={LB}>Correo electrónico *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={IC}
                placeholder="paciente@correo.com"
              />
            </div>
          </div>

          <p className="text-xs text-muted">
            Le enviaremos un correo de invitación para que active su acceso a la app móvil cuando
            quiera. Mientras tanto, aparecerá como &ldquo;Sin registro móvil&rdquo; en tu lista de
            pacientes, pero ya puedes asignarle rutinas, planes de alimentación y citas.
          </p>

          {error && (
            <div className="bg-error-soft border border-error/30 text-error text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 h-10 rounded-xl border border-border text-secondary text-sm hover:bg-background-secondary disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!puedeGuardar}
            className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Registrar paciente"}
          </button>
        </div>
      </div>
    </div>
  );
}
