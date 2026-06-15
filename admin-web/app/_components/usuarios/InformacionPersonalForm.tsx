"use client";
import { useEffect, useState } from "react";
import { fetchPerfil, updatePerfil } from "@/app/_data/perfiles";
import { fetchUltimaMedida, createMedida } from "@/app/_data/medidas";

function calcularEdad(fechaNacimiento: string): number | null {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

function imcInfo(imc: number) {
  if (imc < 18.5) return { label: "Bajo peso", color: "bg-blue-50 text-blue-600" };
  if (imc < 25) return { label: "Normal", color: "bg-green-50 text-green-600" };
  if (imc < 30) return { label: "Sobrepeso", color: "bg-yellow-50 text-yellow-600" };
  return { label: "Obesidad", color: "bg-red-50 text-red-600" };
}

export default function InformacionPersonalForm({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [sexo, setSexo] = useState("femenino");
  const [planMembresia, setPlanMembresia] = useState("basico");

  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [cintura, setCintura] = useState("");
  const [cadera, setCadera] = useState("");

  const [masaMuscular, setMasaMuscular] = useState("");
  const [grasa, setGrasa] = useState("");
  const [brazo, setBrazo] = useState("");
  const [pantorrilla, setPantorrilla] = useState("");

  const loadInfo = () => {
    Promise.all([fetchPerfil(userId), fetchUltimaMedida(userId)])
      .then(([perfil, medida]) => {
        setNombreCompleto(perfil.nombre_completo ?? "");
        setFechaNacimiento(perfil.fecha_nacimiento ?? "");
        setSexo(perfil.sexo ?? "femenino");
        setPlanMembresia(perfil.plan_membresia ?? "basico");
        setAltura(perfil.altura_cm != null ? String(perfil.altura_cm) : "");
        setPeso(medida?.peso_kg != null ? String(medida.peso_kg) : "");
        setCintura(medida?.cintura_cm != null ? String(medida.cintura_cm) : "");
        setCadera(medida?.cadera_cm != null ? String(medida.cadera_cm) : "");
        setMasaMuscular(medida?.masa_muscular_pct != null ? String(medida.masa_muscular_pct) : "");
        setGrasa(medida?.grasa_pct != null ? String(medida.grasa_pct) : "");
        setBrazo(medida?.brazo_cm != null ? String(medida.brazo_cm) : "");
        setPantorrilla(medida?.pantorrilla_cm != null ? String(medida.pantorrilla_cm) : "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar la información personal."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInfo();
  }, []);

  const load = () => {
    setLoading(true);
    setError(null);
    loadInfo();
  };

  const pesoNum = parseFloat(peso);
  const alturaNum = parseFloat(altura);
  const imc = pesoNum > 0 && alturaNum > 0 ? pesoNum / Math.pow(alturaNum / 100, 2) : null;
  const edad = calcularEdad(fechaNacimiento);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await updatePerfil(userId, {
        nombre_completo: nombreCompleto.trim() || null,
        sexo,
        fecha_nacimiento: fechaNacimiento || null,
        altura_cm: altura.trim() ? Number(altura) : null,
        plan_membresia: planMembresia,
      });
      await createMedida(userId, {
        fecha: new Date().toISOString().slice(0, 10),
        peso_kg: peso.trim() ? Number(peso) : null,
        cintura_cm: cintura.trim() ? Number(cintura) : null,
        cadera_cm: cadera.trim() ? Number(cadera) : null,
        masa_muscular_pct: masaMuscular.trim() ? Number(masaMuscular) : null,
        grasa_pct: grasa.trim() ? Number(grasa) : null,
        brazo_cm: brazo.trim() ? Number(brazo) : null,
        pantorrilla_cm: pantorrilla.trim() ? Number(pantorrilla) : null,
        imc: imc != null ? Number(imc.toFixed(2)) : null,
      });
      setFeedback({ type: "success", text: "Información guardada correctamente." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo guardar la información." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-10">Cargando información...</p>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-semibold text-gray-900">Información personal</p>
        <p className="text-sm text-gray-500">Datos básicos, antropométricos y plan del usuario.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-gray-500 font-medium block mb-1">Nombre completo</label>
          <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)}
            className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Plan de membresía</label>
          <select value={planMembresia} onChange={(e) => setPlanMembresia(e.target.value)}
            className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary">
            <option value="basico">🔒 Básico</option>
            <option value="premium">👑 Premium</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Fecha de nacimiento</label>
          <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)}
            className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Edad</label>
          <div className="h-10 border border-gray-100 bg-gray-50 rounded-xl px-3 flex items-center text-sm text-gray-600">
            {edad != null ? `${edad} años` : "—"}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Sexo</label>
          <select value={sexo} onChange={(e) => setSexo(e.target.value)}
            className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary">
            <option value="femenino">Femenino</option>
            <option value="masculino">Masculino</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        {[
          { label: "Peso (kg)", value: peso, set: setPeso },
          { label: "Altura (cm)", value: altura, set: setAltura },
          { label: "Circunferencia de cintura (cm)", value: cintura, set: setCintura },
          { label: "Circunferencia de cadera (cm)", value: cadera, set: setCadera },
        ].map((f) => (
          <div key={f.label}>
            <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
            <input value={f.value} type="number" onChange={(e) => f.set(e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
          </div>
        ))}
      </div>

      {/* IMC calculado */}
      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-bold text-gray-900">Índice de Masa Corporal (IMC)</p>
          <p className="text-xs text-gray-500">Calculado automáticamente: Peso / (Altura² en m)</p>
        </div>
        {imc ? (
          <div className="text-right">
            <p className="text-2xl font-extrabold text-primary">{imc.toFixed(1)}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${imcInfo(imc).color}`}>{imcInfo(imc).label}</span>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Ingresa peso y altura</p>
        )}
      </div>

      <div className="pt-1">
        <p className="font-semibold text-gray-900">Información opcional</p>
        <p className="text-sm text-gray-500">Mediciones adicionales si están disponibles.</p>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "% Masa muscular", value: masaMuscular, set: setMasaMuscular },
          { label: "% Grasa corporal", value: grasa, set: setGrasa },
          { label: "Circunferencia brazo (cm)", value: brazo, set: setBrazo },
          { label: "Circunferencia pantorrilla (cm)", value: pantorrilla, set: setPantorrilla },
        ].map((f) => (
          <div key={f.label}>
            <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
            <input value={f.value} type="number" onChange={(e) => f.set(e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        {feedback && (
          <span className={`text-xs font-medium ${feedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {feedback.text}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "Guardando..." : "💾 Guardar"}
        </button>
      </div>
    </div>
  );
}
