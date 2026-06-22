"use client";
import { useEffect, useState } from "react";
import { fetchCitas, createCita, deleteCita, type Cita, type CitaInput } from "@/app/_data/citas";

const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTH_SHORT = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

const ESTADO_STYLES: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-700",
  confirmada: "bg-green-100 text-green-700",
  cancelada: "bg-gray-100 text-gray-500",
};

function parseFecha(fecha: string) {
  const [year, month, day] = fecha.split("-").map(Number);
  return { year, month: month - 1, day };
}

export default function CitasManager({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [tipo, setTipo] = useState("Nutrición");
  const [profesional, setProfesional] = useState("");
  const [modalidad, setModalidad] = useState("Presencial");
  const [notas, setNotas] = useState("");

  const [calendarDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loadCitas = () => {
    fetchCitas(userId)
      .then(setCitas)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las citas."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCitas();
  }, []);

  const load = () => {
    setLoading(true);
    setError(null);
    loadCitas();
  };

  const handleAddCita = async () => {
    if (!fecha || !hora) return;

    const now = new Date();
    const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    if (fecha < hoy) {
      setFeedback({ type: "error", text: "No puedes agendar una cita en una fecha pasada." });
      return;
    }

    if (fecha === hoy) {
      const [h, m] = hora.split(":").map(Number);
      const citaMin = h * 60 + m;
      const minimoMin = (now.getHours() + 1) * 60 + now.getMinutes();
      if (citaMin < minimoMin) {
        setFeedback({ type: "error", text: "Para hoy, la cita debe ser al menos 1 hora después de la hora actual." });
        return;
      }
    }

    setSaving(true);
    setFeedback(null);
    try {
      const input: CitaInput = {
        fecha,
        hora,
        tipo,
        profesional: profesional.trim() || null,
        modalidad,
        notas: notas.trim() || null,
      };
      const nueva = await createCita(userId, input);
      setCitas((prev) => [...prev, nueva].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)));
      setFecha("");
      setHora("");
      setNotas("");
      setFeedback({ type: "success", text: "Cita registrada correctamente." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo registrar la cita." });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCita = async (id: string) => {
    try {
      await deleteCita(id);
      setCitas((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo eliminar la cita." });
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-10">Cargando citas...</p>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Reintentar</button>
      </div>
    );
  }

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = lunes
  const today = new Date();

  const citaDaysInMonth = new Set(
    citas
      .map((c) => parseFecha(c.fecha))
      .filter((p) => p.year === year && p.month === month)
      .map((p) => p.day)
  );

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Calendario */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-center mb-3">
          <p className="font-bold text-gray-900 text-sm">{MONTH_LABELS[month]} {year}</p>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d) => (
            <span key={d} className="text-xs text-gray-400 font-medium py-1">{d}</span>
          ))}
          {Array.from({ length: firstWeekday }).map((_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            const hasCita = citaDaysInMonth.has(d);
            return (
              <span key={d} className={`text-xs h-7 w-7 mx-auto rounded-full flex items-center justify-center ${
                isToday ? "bg-primary text-white font-bold" :
                hasCita ? "bg-primary/10 text-primary font-semibold" :
                "text-gray-700"
              }`}>{d}</span>
            );
          })}
        </div>
        <div className="mt-3 p-2.5 bg-primary/5 rounded-xl border border-primary/20">
          <p className="text-xs font-semibold text-primary">📅 {MONTH_LABELS[month]}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {citaDaysInMonth.size === 0 ? "Sin citas programadas este mes." : `${citaDaysInMonth.size} día(s) con citas programadas.`}
          </p>
        </div>
      </div>

      {/* Formulario nueva cita */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="font-bold text-gray-900 text-sm mb-3">📋 Registrar nueva cita</p>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                min={`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`}
                className="w-full h-9 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Hora</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)}
                className="w-full h-9 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo de cita</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              className="w-full h-9 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none focus:border-primary">
              {["Nutrición", "Entrenamiento", "Seguimiento"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Profesional</label>
            <input value={profesional} onChange={(e) => setProfesional(e.target.value)}
              placeholder="Ej. Lic. Ana Torres"
              className="w-full h-9 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Modalidad</label>
            <select value={modalidad} onChange={(e) => setModalidad(e.target.value)}
              className="w-full h-9 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none focus:border-primary">
              {["Presencial", "En línea"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Escribe alguna nota adicional..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary resize-none h-16" />
          </div>
          {feedback && (
            <span className={`text-xs font-medium ${feedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {feedback.text}
            </span>
          )}
          <button
            onClick={handleAddCita}
            disabled={saving || !fecha || !hora}
            className="w-full h-10 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Guardando..." : "📅 Guardar cita"}
          </button>
        </div>
      </div>

      {/* Lista de citas */}
      <div className="flex flex-col gap-3">
        <p className="font-bold text-gray-900 text-sm">
          {citas.length === 0 ? "Sin citas programadas" : `${citas.length} cita(s) programada(s)`}
        </p>
        {citas.map((c) => {
          const { month: cMonth, day } = parseFecha(c.fecha);
          return (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-3 flex gap-3">
              <div className="flex flex-col items-center bg-primary text-white rounded-xl px-3 py-2 text-center shrink-0">
                <span className="text-xs font-bold opacity-80">{MONTH_SHORT[cMonth]}</span>
                <span className="text-lg font-extrabold">{day}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <p className="font-semibold text-gray-900 text-xs">{c.hora}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ESTADO_STYLES[c.estado] ?? "bg-gray-100 text-gray-500"}`}>
                    {c.estado}
                  </span>
                </div>
                <p className="font-bold text-gray-800 text-sm mt-0.5">{c.tipo}</p>
                {c.profesional && <p className="text-xs text-gray-500">{c.profesional}</p>}
                {c.modalidad && <p className="text-xs text-gray-400">📍 {c.modalidad}</p>}
                {c.notas && <p className="text-xs text-gray-400 mt-1">📝 {c.notas}</p>}
              </div>
              <button onClick={() => handleRemoveCita(c.id)} className="text-gray-400 hover:text-red-500 text-sm self-start">✕</button>
            </div>
          );
        })}
        {citas.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">Aún no hay citas registradas para este usuario.</p>
        )}
      </div>
    </div>
  );
}
