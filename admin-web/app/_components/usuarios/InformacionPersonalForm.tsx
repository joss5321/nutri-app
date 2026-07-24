"use client";
import { useEffect, useState } from "react";
import { fetchPerfil, updatePerfil } from "@/app/_data/perfiles";
import { fetchUltimaMedida, createMedida } from "@/app/_data/medidas";
import {
  fetchHistoriaClinica,
  saveHistoriaClinica,
  emptyHistoria,
  type HistoriaClinicaDatos,
  type Seguimiento,
} from "@/app/_data/historia_clinica";
import ConfirmModal from "@/app/_components/ConfirmModal";

// ── Helpers ──────────────────────────────────────────────────
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
  if (imc < 18.5) return { label: "Bajo peso",  color: "bg-blue-50 text-blue-600" };
  if (imc < 25)   return { label: "Normal",      color: "bg-green-50 text-green-600" };
  if (imc < 30)   return { label: "Sobrepeso",   color: "bg-yellow-50 text-yellow-600" };
  return            { label: "Obesidad",      color: "bg-red-50 text-red-600" };
}

const IC  = "w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary";
const LB  = "text-xs text-gray-500 font-medium block mb-1";
const TXA = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none";

// ── UI atoms ─────────────────────────────────────────────────
function Nota({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="border-t border-dashed border-gray-200 pt-3 mt-1">
      <label className={LB}>📝 Nota clínica</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)}
        rows={2} placeholder="Notas adicionales para esta sección..."
        className={TXA} />
    </div>
  );
}

function Ck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-primary shrink-0" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function YesNo({ value, onChange, labels = ["Sí", "No"] }: {
  value: boolean | null; onChange: (v: boolean | null) => void; labels?: [string, string];
}) {
  return (
    <div className="flex gap-2">
      {([true, false] as const).map((b, i) => (
        <button key={String(b)} type="button"
          onClick={() => onChange(value === b ? null : b)}
          className={`px-4 h-8 rounded-xl text-xs font-semibold border transition-colors ${
            value === b
              ? "bg-primary text-white border-primary"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}>
          {labels[i]}
        </button>
      ))}
    </div>
  );
}

function Accordion({ title, icon, isOpen, onToggle, children }: {
  title: string; icon: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
        <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
          <span>{icon}</span> {title}
        </span>
        <span className="text-gray-400 text-sm">{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

function emptySeg(): Seguimiento {
  return {
    id: "", fecha: new Date().toISOString().slice(0, 10),
    como_se_sintio: "", cambios_notados: "", menu_parecio: "",
    sintomas_gi: "", propuesta_intervencion: "", intento_jugo_verde: "",
    estres: "", ciclos_menstruales: "", utilizo_equivalentes: "",
    rutina: "", suplementos_medicamentos: "", consumo_agua: "",
    seguir_4_tiempos: "", alimentos_quitar: "", alimentos_incluir: "",
    rutina_sintio: "", logro_progresar: "", dolor_muscular: "",
    continuar_5_dias: "", realizo_cardio: "", intervencion: "",
  };
}

// ── Main component ───────────────────────────────────────────
export default function InformacionPersonalForm({
  userId, onPerfilUpdated,
}: { userId: string; onPerfilUpdated?: () => void }) {

  // Loading / error
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Datos personales
  const [savingPerfil,   setSavingPerfil]   = useState(false);
  const [perfilFeedback, setPerfilFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [nombreCompleto,  setNombreCompleto]  = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [sexo,            setSexo]            = useState("femenino");
  const [planMembresia,   setPlanMembresia]   = useState("basico");

  // Medidas
  const [savingMedidas,      setSavingMedidas]      = useState(false);
  const [medidasFeedback,    setMedidasFeedback]    = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showMedidasConfirm, setShowMedidasConfirm] = useState(false);
  const [peso,        setPeso]        = useState("");
  const [altura,      setAltura]      = useState("");
  const [cintura,     setCintura]     = useState("");
  const [cadera,      setCadera]      = useState("");
  const [masaMuscular, setMasaMuscular] = useState("");
  const [grasa,       setGrasa]       = useState("");
  const [brazo,       setBrazo]       = useState("");
  const [pantorrilla, setPantorrilla] = useState("");

  // Historia clínica
  const [hist, setHist] = useState<HistoriaClinicaDatos>(emptyHistoria);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sh = (key: keyof HistoriaClinicaDatos) => (val: any) =>
    setHist((prev) => ({ ...prev, [key]: val }));

  // Accordion open state
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set());
  const tog = (k: string) => setOpenSecs((prev) => {
    const nx = new Set(prev); nx.has(k) ? nx.delete(k) : nx.add(k); return nx;
  });

  // Seguimientos
  const [showNewSeg,  setShowNewSeg]  = useState(false);
  const [newSeg,      setNewSeg]      = useState<Seguimiento>(emptySeg);
  const setSF = (k: keyof Seguimiento) => (v: string) => setNewSeg((p) => ({ ...p, [k]: v }));
  const [savingSeg,   setSavingSeg]   = useState(false);
  const [openSegs,    setOpenSegs]    = useState<Set<string>>(new Set());
  const togSeg = (id: string) => setOpenSegs((prev) => {
    const nx = new Set(prev); nx.has(id) ? nx.delete(id) : nx.add(id); return nx;
  });

  // ── Load ─────────────────────────────────────────
  const loadInfo = () => {
    Promise.all([fetchPerfil(userId), fetchUltimaMedida(userId), fetchHistoriaClinica(userId)])
      .then(([perfil, medida, historia]) => {
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
        if (historia) setHist({ ...emptyHistoria(), ...historia });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar la información."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadInfo(); }, []);
  const load = () => { setLoading(true); setError(null); loadInfo(); };

  const pesoNum   = parseFloat(peso);
  const alturaNum = parseFloat(altura);
  const imc = pesoNum > 0 && alturaNum > 0 ? pesoNum / Math.pow(alturaNum / 100, 2) : null;
  const edad = calcularEdad(fechaNacimiento);

  // ── Save datos personales + historia ─────────────
  const handleSavePerfil = async () => {
    setSavingPerfil(true);
    setPerfilFeedback(null);
    try {
      await updatePerfil(userId, {
        nombre_completo: nombreCompleto.trim() || null,
        sexo,
        fecha_nacimiento: fechaNacimiento || null,
        plan_membresia: planMembresia,
      });
      await saveHistoriaClinica(userId, hist);
      setPerfilFeedback({ type: "success", text: "Historial guardado correctamente." });
      onPerfilUpdated?.();
    } catch (err) {
      setPerfilFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo guardar." });
    } finally {
      setSavingPerfil(false);
    }
  };

  // ── Save medidas (unchanged) ──────────────────────
  const handleSaveMedidas = async () => {
    setShowMedidasConfirm(false);
    setSavingMedidas(true);
    setMedidasFeedback(null);
    try {
      await updatePerfil(userId, { altura_cm: altura.trim() ? Number(altura) : null });
      await createMedida(userId, {
        fecha: new Date().toISOString().slice(0, 10),
        peso_kg:           peso.trim()        ? Number(peso)        : null,
        cintura_cm:        cintura.trim()     ? Number(cintura)     : null,
        cadera_cm:         cadera.trim()      ? Number(cadera)      : null,
        masa_muscular_pct: masaMuscular.trim()? Number(masaMuscular): null,
        grasa_pct:         grasa.trim()       ? Number(grasa)       : null,
        brazo_cm:          brazo.trim()       ? Number(brazo)       : null,
        pantorrilla_cm:    pantorrilla.trim() ? Number(pantorrilla) : null,
        imc: imc != null ? Number(imc.toFixed(2)) : null,
      });
      setMedidasFeedback({ type: "success", text: `Medidas registradas con fecha ${new Date().toLocaleDateString("es-MX")}.` });
    } catch (err) {
      setMedidasFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo guardar." });
    } finally {
      setSavingMedidas(false);
    }
  };

  // ── Save seguimiento ──────────────────────────────
  const handleSaveSeguimiento = async () => {
    setSavingSeg(true);
    const entry: Seguimiento = { ...newSeg, id: Date.now().toString() };
    const updated: HistoriaClinicaDatos = {
      ...hist,
      seguimientos: [entry, ...(hist.seguimientos ?? [])],
    };
    try {
      await saveHistoriaClinica(userId, updated);
      setHist(updated);
      setNewSeg(emptySeg());
      setShowNewSeg(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar el seguimiento.");
    } finally {
      setSavingSeg(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Cargando información...</p>;
  if (error) return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Reintentar</button>
    </div>
  );

  const SaveBtn = ({ label = "💾 Guardar datos personales" }: { label?: string }) => (
    <div className="flex items-center justify-end gap-3">
      {perfilFeedback && (
        <span className={`text-xs font-medium ${perfilFeedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {perfilFeedback.text}
        </span>
      )}
      <button onClick={handleSavePerfil} disabled={savingPerfil}
        className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
        {savingPerfil ? "Guardando..." : label}
      </button>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ═══════════════════════════════════════════════
          SECCIÓN 1 — DATOS PERSONALES
      ═══════════════════════════════════════════════ */}
      <div>
        <p className="font-semibold text-gray-900">Datos personales</p>
        <p className="text-sm text-gray-500">Información básica del usuario.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className={LB}>Nombre completo</label>
          <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} className={IC} />
        </div>
        <div>
          <label className={LB}>Plan de membresía</label>
          <select value={planMembresia} onChange={(e) => setPlanMembresia(e.target.value)}
            className={IC + " bg-white"}>
            <option value="basico">🔒 Básico</option>
            <option value="premium">👑 Premium</option>
          </select>
        </div>
        <div>
          <label className={LB}>Fecha de nacimiento</label>
          <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className={IC} />
        </div>
        <div>
          <label className={LB}>Edad</label>
          <div className="h-10 border border-gray-100 bg-gray-50 rounded-xl px-3 flex items-center text-sm text-gray-600">
            {edad != null ? `${edad} años` : "—"}
          </div>
        </div>
        <div>
          <label className={LB}>Sexo</label>
          <select value={sexo} onChange={(e) => setSexo(e.target.value)} className={IC + " bg-white"}>
            <option value="femenino">Femenino</option>
            <option value="masculino">Masculino</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label className={LB}>Ocupación</label>
          <input value={hist.ocupacion} onChange={(e) => sh("ocupacion")(e.target.value)}
            className={IC} placeholder="Ej. Estudiante, Contador..." />
        </div>
        <div className="col-span-2">
          <label className={LB}>Nacionalidad / Residencia</label>
          <input value={hist.nacionalidad} onChange={(e) => sh("nacionalidad")(e.target.value)} className={IC} />
        </div>
      </div>

      <div>
        <label className={LB}>Motivo de consulta (expectativas)</label>
        <textarea value={hist.motivo_consulta} onChange={(e) => sh("motivo_consulta")(e.target.value)}
          rows={3} placeholder="¿Qué espera lograr con la consulta?"
          className={TXA} />
      </div>

      <Nota value={hist.nota_datos_personales} onChange={sh("nota_datos_personales")} />

      <SaveBtn />

      <div className="border-t border-gray-200" />

      {/* ═══════════════════════════════════════════════
          SECCIÓN 2 — MEDIDAS ANTROPOMÉTRICAS (sin cambios)
      ═══════════════════════════════════════════════ */}
      <div>
        <p className="font-semibold text-gray-900">Medidas antropométricas</p>
        <p className="text-sm text-gray-500">Al guardar se creará un nuevo registro con la fecha de hoy en el historial de progreso.</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Peso (kg)",                    value: peso,        set: setPeso },
          { label: "Altura (cm)",                  value: altura,      set: setAltura },
          { label: "Circunferencia cintura (cm)",  value: cintura,     set: setCintura },
          { label: "Circunferencia cadera (cm)",   value: cadera,      set: setCadera },
        ].map((f) => (
          <div key={f.label}>
            <label className={LB}>{f.label}</label>
            <input value={f.value} type="number" onChange={(e) => f.set(e.target.value)} className={IC} />
          </div>
        ))}
      </div>

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

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "% Masa muscular",                     value: masaMuscular, set: setMasaMuscular },
          { label: "% Grasa corporal",                    value: grasa,        set: setGrasa },
          { label: "Circunferencia brazo (cm)",           value: brazo,        set: setBrazo },
          { label: "Circunferencia pantorrilla (cm)",     value: pantorrilla,  set: setPantorrilla },
        ].map((f) => (
          <div key={f.label}>
            <label className={LB}>{f.label}</label>
            <input value={f.value} type="number" onChange={(e) => f.set(e.target.value)} className={IC} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        {medidasFeedback && (
          <span className={`text-xs font-medium ${medidasFeedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {medidasFeedback.text}
          </span>
        )}
        <button onClick={() => setShowMedidasConfirm(true)} disabled={savingMedidas}
          className="flex items-center gap-2 px-4 h-10 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
          {savingMedidas ? "Guardando..." : "📊 Registrar medidas"}
        </button>
      </div>

      <div className="border-t border-gray-200" />

      {/* ═══════════════════════════════════════════════
          HISTORIA CLÍNICA — Secciones colapsibles
      ═══════════════════════════════════════════════ */}
      <div>
        <p className="font-semibold text-gray-900">Historia clínica</p>
        <p className="text-sm text-gray-500">Haz clic en cada sección para expandirla. Los datos se guardan con el botón verde.</p>
      </div>

      {/* ── Antecedentes personales ── */}
      <Accordion title="Antecedentes personales" icon="🩺"
        isOpen={openSecs.has("ap")} onToggle={() => tog("ap")}>

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Síntomas gastrointestinales</p>
        <div className="grid grid-cols-3 gap-3">
          <Ck label="Diarrea"       checked={hist.ap_diarrea}       onChange={sh("ap_diarrea")} />
          <Ck label="Vómito"        checked={hist.ap_vomito}        onChange={sh("ap_vomito")} />
          <Ck label="Náuseas"       checked={hist.ap_nauseas}       onChange={sh("ap_nauseas")} />
          <Ck label="Reflujo"       checked={hist.ap_reflujo}       onChange={sh("ap_reflujo")} />
          <Ck label="Gastritis"     checked={hist.ap_gastritis}     onChange={sh("ap_gastritis")} />
          <Ck label="Estreñimiento" checked={hist.ap_estrenimiento} onChange={sh("ap_estrenimiento")} />
          <Ck label="Colitis"       checked={hist.ap_colitis}       onChange={sh("ap_colitis")} />
        </div>

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Enfermedades</p>
        <div className="grid grid-cols-3 gap-3">
          <Ck label="Obesidad"               checked={hist.ap_obesidad}             onChange={sh("ap_obesidad")} />
          <Ck label="Diabetes"               checked={hist.ap_diabetes}             onChange={sh("ap_diabetes")} />
          <Ck label="HTA (Hipertensión)"     checked={hist.ap_hta}                  onChange={sh("ap_hta")} />
          <Ck label="Cáncer"                 checked={hist.ap_cancer}               onChange={sh("ap_cancer")} />
          <Ck label="Hipercolesterolemia"    checked={hist.ap_hipercolesterolemia}  onChange={sh("ap_hipercolesterolemia")} />
          <Ck label="Hipertrigliceridemia"   checked={hist.ap_hipertrigliceridemia} onChange={sh("ap_hipertrigliceridemia")} />
          <Ck label="Trastornos mentales"    checked={hist.ap_trastornos_mentales}  onChange={sh("ap_trastornos_mentales")} />
          <Ck label="Enfermedad Renal"       checked={hist.ap_enfermedad_renal}     onChange={sh("ap_enfermedad_renal")} />
          <Ck label="Enfermedad Cardíaca"    checked={hist.ap_enfermedad_cardiaca}  onChange={sh("ap_enfermedad_cardiaca")} />
          <Ck label="Tiroides (Hipo/Hiper)"  checked={hist.ap_tiroides}             onChange={sh("ap_tiroides")} />
        </div>

        <div>
          <label className={LB}>Enfermedad diagnosticada (dx)</label>
          <input value={hist.ap_enfermedad_dx}
            onChange={(e) => sh("ap_enfermedad_dx")(e.target.value)} className={IC} />
        </div>

        <div className="space-y-3">
          <Ck label="Toma algún medicamento o suplemento"
            checked={hist.ap_toma_medicamento} onChange={sh("ap_toma_medicamento")} />
          {hist.ap_toma_medicamento && (
            <div className="grid grid-cols-3 gap-3 pl-4 border-l-2 border-primary/20">
              <div>
                <label className={LB}>Cuál</label>
                <input value={hist.ap_medicamento_cual}
                  onChange={(e) => sh("ap_medicamento_cual")(e.target.value)} className={IC} />
              </div>
              <div>
                <label className={LB}>Dosis</label>
                <input value={hist.ap_medicamento_dosis}
                  onChange={(e) => sh("ap_medicamento_dosis")(e.target.value)} className={IC} />
              </div>
              <div>
                <label className={LB}>Desde cuándo</label>
                <input value={hist.ap_medicamento_desde}
                  onChange={(e) => sh("ap_medicamento_desde")(e.target.value)} className={IC} />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className={LB}>Ciclos menstruales</label>
          <input value={hist.ap_ciclos_menstruales}
            onChange={(e) => sh("ap_ciclos_menstruales")(e.target.value)}
            className={IC} placeholder="Duración, regularidad, fecha última..." />
        </div>

        <Nota value={hist.nota_antecedentes_personales} onChange={sh("nota_antecedentes_personales")} />
      </Accordion>

      {/* ── Antecedentes familiares ── */}
      <Accordion title="Antecedentes familiares" icon="👨‍👩‍👧‍👦"
        isOpen={openSecs.has("af")} onToggle={() => tog("af")}>

        <div className="grid grid-cols-2 gap-3">
          <Ck label="Obesidad"              checked={hist.af_obesidad}             onChange={sh("af_obesidad")} />
          <Ck label="Diabetes"              checked={hist.af_diabetes}             onChange={sh("af_diabetes")} />
          <Ck label="HTA (Hipertensión)"    checked={hist.af_hta}                  onChange={sh("af_hta")} />
          <Ck label="Cáncer"                checked={hist.af_cancer}               onChange={sh("af_cancer")} />
          <Ck label="Hipercolesterolemia"   checked={hist.af_hipercolesterolemia}  onChange={sh("af_hipercolesterolemia")} />
          <Ck label="Hipertrigliceridemia"  checked={hist.af_hipertrigliceridemia} onChange={sh("af_hipertrigliceridemia")} />
          <Ck label="Trastornos mentales"   checked={hist.af_trastornos_mentales}  onChange={sh("af_trastornos_mentales")} />
        </div>
        <div>
          <label className={LB}>Otros</label>
          <input value={hist.af_otros} onChange={(e) => sh("af_otros")(e.target.value)} className={IC} />
        </div>
        <Nota value={hist.nota_antecedentes_familiares} onChange={sh("nota_antecedentes_familiares")} />
      </Accordion>

      {/* ── Estilo de vida ── */}
      <Accordion title="Estilo de vida" icon="🏃"
        isOpen={openSecs.has("ev")} onToggle={() => tog("ev")}>

        <div className="space-y-3">
          <Ck label="Realiza ejercicio" checked={hist.ev_hace_ejercicio} onChange={sh("ev_hace_ejercicio")} />
          {hist.ev_hace_ejercicio && (
            <div className="grid grid-cols-3 gap-3 pl-4 border-l-2 border-primary/20">
              <div className="col-span-3">
                <label className={LB}>Tipo de ejercicio</label>
                <input type="text" value={hist.ev_tipo_ejercicio}
                  onChange={(e) => sh("ev_tipo_ejercicio")(e.target.value)} className={IC} placeholder="Ej. Musculación, cardio, yoga..." />
              </div>
              <div>
                <label className={LB}>Frecuencia (días/semana)</label>
                <input type="number" min={1} max={7} value={hist.ev_frecuencia}
                  onChange={(e) => sh("ev_frecuencia")(e.target.value)} className={IC} placeholder="/7" />
              </div>
              <div>
                <label className={LB}>Duración (min)</label>
                <input type="number" value={hist.ev_duracion}
                  onChange={(e) => sh("ev_duracion")(e.target.value)} className={IC} />
              </div>
              <div>
                <label className={LB}>Intensidad</label>
                <select value={hist.ev_intensidad} onChange={(e) => sh("ev_intensidad")(e.target.value)}
                  className={IC + " bg-white"}>
                  <option value="">— Seleccionar —</option>
                  <option value="ligera">Ligera</option>
                  <option value="moderada">Moderada</option>
                  <option value="intensa">Intensa</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className={LB}>Rutina semanal (Hora / Actividad)</label>
          <textarea value={hist.ev_rutina_semanal}
            onChange={(e) => sh("ev_rutina_semanal")(e.target.value)}
            rows={4} className={TXA} placeholder={"7:00am — Despierta\n8:00am — Trabajo\n..."} />
        </div>

        <div>
          <label className={LB}>Hábitos de sueño</label>
          <input value={hist.ev_habitos_sueno}
            onChange={(e) => sh("ev_habitos_sueno")(e.target.value)}
            className={IC} placeholder="Horas, calidad, horario..." />
        </div>

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Consumo</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LB}>Alcohol</label>
            <input value={hist.ev_alcohol} onChange={(e) => sh("ev_alcohol")(e.target.value)}
              className={IC} placeholder="Frecuencia / cantidad..." />
          </div>
          <div>
            <label className={LB}>Tabaco</label>
            <input value={hist.ev_tabaco} onChange={(e) => sh("ev_tabaco")(e.target.value)}
              className={IC} placeholder="Frecuencia / cantidad..." />
          </div>
          <div>
            <label className={LB}>Café</label>
            <input value={hist.ev_cafe} onChange={(e) => sh("ev_cafe")(e.target.value)}
              className={IC} placeholder="Tazas / día..." />
          </div>
          <div>
            <label className={LB}>Drogas</label>
            <input value={hist.ev_drogas} onChange={(e) => sh("ev_drogas")(e.target.value)}
              className={IC} placeholder="Tipo / frecuencia..." />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LB}>Vasos de agua potable al día</label>
            <input type="number" value={hist.ev_vasos_agua}
              onChange={(e) => sh("ev_vasos_agua")(e.target.value)} className={IC} />
          </div>
          <div>
            <label className={LB}>Vasos de bebidas al día (refrescos, jugos, aguas)</label>
            <input type="number" value={hist.ev_vasos_bebidas}
              onChange={(e) => sh("ev_vasos_bebidas")(e.target.value)} className={IC} />
          </div>
        </div>

        <Nota value={hist.nota_estilo_vida} onChange={sh("nota_estilo_vida")} />
      </Accordion>

      {/* ── Indicadores bioquímicos ── */}
      <Accordion title="Indicadores bioquímicos" icon="🧪"
        isOpen={openSecs.has("ib")} onToggle={() => tog("ib")}>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LB}>Última fecha de estudios</label>
            <input type="date" value={hist.ib_ultima_fecha}
              onChange={(e) => sh("ib_ultima_fecha")(e.target.value)} className={IC} />
          </div>
          <div>
            <label className={LB}>¿Se solicitaron análisis?</label>
            <YesNo value={hist.ib_se_solicitaron} onChange={sh("ib_se_solicitaron")} />
          </div>
        </div>
        {hist.ib_se_solicitaron && (
          <div>
            <label className={LB}>Cuáles</label>
            <input value={hist.ib_cuales} onChange={(e) => sh("ib_cuales")(e.target.value)}
              className={IC} placeholder="Glucosa, perfil lipídico, BH..." />
          </div>
        )}

        <Nota value={hist.nota_indicadores_bioquimicos} onChange={sh("nota_indicadores_bioquimicos")} />
      </Accordion>

      {/* ── Indicadores dietéticos ── */}
      <Accordion title="Indicadores dietéticos" icon="🥗"
        isOpen={openSecs.has("id")} onToggle={() => tog("id")}>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LB}>Cuántas comidas hace al día</label>
            <input type="number" value={hist.id_comidas_dia}
              onChange={(e) => sh("id_comidas_dia")(e.target.value)} className={IC} />
          </div>
          <div>
            <label className={LB}>Quién prepara sus alimentos</label>
            <input value={hist.id_quien_prepara}
              onChange={(e) => sh("id_quien_prepara")(e.target.value)} className={IC} />
          </div>
          <div>
            <label className={LB}>Grasa utilizada en casa</label>
            <input value={hist.id_grasa_casa}
              onChange={(e) => sh("id_grasa_casa")(e.target.value)}
              className={IC} placeholder="Aceite vegetal, mantequilla..." />
          </div>
          <div>
            <label className={LB}>Presupuesto para alimentos</label>
            <input value={hist.id_presupuesto}
              onChange={(e) => sh("id_presupuesto")(e.target.value)}
              className={IC} placeholder="Semanal / mensual..." />
          </div>
        </div>

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">R24 — Recordatorio 24 horas</p>
        <div className="space-y-3">
          {[
            { label: "Desayuno", key: "id_r24_desayuno" as const },
            { label: "Comida",   key: "id_r24_comida"   as const },
            { label: "Cena",     key: "id_r24_cena"     as const },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className={LB}>{label}</label>
              <textarea value={hist[key]} onChange={(e) => sh(key)(e.target.value)}
                rows={2} className={TXA} placeholder={`¿Qué comió en el ${label.toLowerCase()}?`} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LB}>Apetito</label>
            <div className="flex gap-2">
              {(["bueno", "regular", "malo"] as const).map((v) => (
                <button key={v} type="button"
                  onClick={() => sh("id_apetito")(hist.id_apetito === v ? "" : v)}
                  className={`px-3 h-8 rounded-xl text-xs font-semibold border capitalize transition-colors ${
                    hist.id_apetito === v
                      ? "bg-primary text-white border-primary"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={LB}>¿Agrega sal a la comida ya preparada?</label>
            <YesNo value={hist.id_agrega_sal} onChange={sh("id_agrega_sal")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LB}>Alimentos preferidos</label>
            <textarea value={hist.id_alimentos_preferidos}
              onChange={(e) => sh("id_alimentos_preferidos")(e.target.value)}
              rows={2} className={TXA} />
          </div>
          <div>
            <label className={LB}>Alimentos que no le agradan / no acostumbra</label>
            <textarea value={hist.id_no_agradan}
              onChange={(e) => sh("id_no_agradan")(e.target.value)}
              rows={2} className={TXA} />
          </div>
          <div>
            <label className={LB}>Alergia / Intolerancia</label>
            <input value={hist.id_alergias} onChange={(e) => sh("id_alergias")(e.target.value)} className={IC} />
          </div>
          <div>
            <label className={LB}>Alimentos que le causan malestar</label>
            <input value={hist.id_malestar} onChange={(e) => sh("id_malestar")(e.target.value)} className={IC} />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={LB}>¿Ha llevado alguna dieta anteriormente?</label>
            <YesNo value={hist.id_dieta_anterior} onChange={sh("id_dieta_anterior")} />
          </div>
          {hist.id_dieta_anterior && (
            <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-primary/20">
              <div>
                <label className={LB}>Qué tipo de dieta</label>
                <input value={hist.id_dieta_tipo} onChange={(e) => sh("id_dieta_tipo")(e.target.value)} className={IC} />
              </div>
              <div>
                <label className={LB}>Hace cuánto</label>
                <input value={hist.id_dieta_hace_cuanto}
                  onChange={(e) => sh("id_dieta_hace_cuanto")(e.target.value)} className={IC} />
              </div>
              <div>
                <label className={LB}>Por cuánto tiempo</label>
                <input value={hist.id_dieta_tiempo}
                  onChange={(e) => sh("id_dieta_tiempo")(e.target.value)} className={IC} />
              </div>
              <div>
                <label className={LB}>Por qué razón</label>
                <input value={hist.id_dieta_razon}
                  onChange={(e) => sh("id_dieta_razon")(e.target.value)} className={IC} />
              </div>
              <div>
                <label className={LB}>Qué tanto se apegó</label>
                <input value={hist.id_dieta_apego}
                  onChange={(e) => sh("id_dieta_apego")(e.target.value)} className={IC} />
              </div>
              <div>
                <label className={LB}>¿Obtuvo los resultados esperados?</label>
                <input value={hist.id_dieta_resultados}
                  onChange={(e) => sh("id_dieta_resultados")(e.target.value)} className={IC} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className={LB}>¿Ha utilizado medicamentos para bajar de peso?</label>
            <YesNo value={hist.id_medicamentos_peso} onChange={sh("id_medicamentos_peso")} />
          </div>
          {hist.id_medicamentos_peso && (
            <div className="pl-4 border-l-2 border-primary/20">
              <label className={LB}>Cuáles</label>
              <input value={hist.id_medicamentos_cuales}
                onChange={(e) => sh("id_medicamentos_cuales")(e.target.value)} className={IC} />
            </div>
          )}
        </div>

        <Nota value={hist.nota_indicadores_dieteticos} onChange={sh("nota_indicadores_dieteticos")} />
      </Accordion>

      {/* ── Entrenamiento ── */}
      <Accordion title="Entrenamiento" icon="💪"
        isOpen={openSecs.has("ent")} onToggle={() => tog("ent")}>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={LB}>Antecedentes de lesiones</label>
            <textarea value={hist.ent_lesiones}
              onChange={(e) => sh("ent_lesiones")(e.target.value)}
              rows={2} className={TXA} placeholder="Lesiones previas, cirugías, limitaciones..." />
          </div>
          <div>
            <label className={LB}>Experiencia con ejercicio</label>
            <input value={hist.ent_experiencia}
              onChange={(e) => sh("ent_experiencia")(e.target.value)}
              className={IC} placeholder="Principiante, intermedio, avanzado..." />
          </div>
          <div>
            <label className={LB}>¿Realiza otro tipo de ejercicio?</label>
            <input value={hist.ent_otro_ejercicio}
              onChange={(e) => sh("ent_otro_ejercicio")(e.target.value)}
              className={IC} placeholder="Yoga, natación, ciclismo..." />
          </div>
          <div>
            <label className={LB}>Días que destinará al entrenamiento</label>
            <input type="number" min={1} max={7} value={hist.ent_dias}
              onChange={(e) => sh("ent_dias")(e.target.value)} className={IC} />
          </div>
          <div>
            <label className={LB}>Distribución</label>
            <input value={hist.ent_distribucion}
              onChange={(e) => sh("ent_distribucion")(e.target.value)}
              className={IC} placeholder="Ej. Lun/Mie/Vie — Fuerza, Mar/Jue — Cardio" />
          </div>
        </div>

        <Nota value={hist.nota_entrenamiento} onChange={sh("nota_entrenamiento")} />
      </Accordion>

      {/* ── Comentarios / Plan de intervención ── */}
      <Accordion title="Comentarios / Plan de intervención" icon="📋"
        isOpen={openSecs.has("plan")} onToggle={() => tog("plan")}>
        <div>
          <label className={LB}>Comentarios y plan de intervención</label>
          <textarea value={hist.comentarios_plan}
            onChange={(e) => sh("comentarios_plan")(e.target.value)}
            rows={5} className={TXA}
            placeholder="Resumen de la evaluación, objetivos, estrategia nutricional y de entrenamiento..." />
        </div>
      </Accordion>

      {/* Botón guardar historial (copia) */}
      <SaveBtn label="💾 Guardar historial clínico" />

      <div className="border-t border-gray-200" />

      {/* ═══════════════════════════════════════════════
          SEGUIMIENTOS
      ═══════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">Seguimientos</p>
          <p className="text-sm text-gray-500">{(hist.seguimientos ?? []).length} consulta{(hist.seguimientos ?? []).length !== 1 ? "s" : ""} registrada{(hist.seguimientos ?? []).length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setShowNewSeg(true); setNewSeg(emptySeg()); }}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors">
          + Nueva consulta de seguimiento
        </button>
      </div>

      {/* Formulario nuevo seguimiento */}
      {showNewSeg && (
        <div className="border-2 border-primary/30 rounded-xl p-5 space-y-4 bg-primary/3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900 text-sm">Nueva consulta de seguimiento</p>
            <div>
              <label className={LB}>Fecha</label>
              <input type="date" value={newSeg.fecha}
                onChange={(e) => setSF("fecha")(e.target.value)}
                className="h-9 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nutrición</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["¿Cómo se sintió?",                 "como_se_sintio"],
              ["Cambios notados",                   "cambios_notados"],
              ["¿Qué le pareció el menú?",          "menu_parecio"],
              ["Síntomas GI",                       "sintomas_gi"],

              ["Estrés",                            "estres"],
              ["Ciclos menstruales",                "ciclos_menstruales"],
              ["¿Utilizó equivalentes?",            "utilizo_equivalentes"],
              ["Rutina",                            "rutina"],
              ["Suplementos / medicamentos",        "suplementos_medicamentos"],
              ["¿Consumo de agua?",                 "consumo_agua"],
              ["Tiempos de comida",                  "seguir_4_tiempos"],
              ["Alimentos por quitar",              "alimentos_quitar"],
              ["Alimentos por incluir",             "alimentos_incluir"],
            ] as [string, keyof Seguimiento][]).map(([lbl, key]) => (
              <div key={key}>
                <label className={LB}>{lbl}</label>
                <input value={newSeg[key] as string} onChange={(e) => setSF(key)(e.target.value)}
                  className={IC} />
              </div>
            ))}
          </div>

          <div>
            <label className={LB}>Propuesta de intervención</label>
            <textarea value={newSeg.propuesta_intervencion}
              onChange={(e) => setSF("propuesta_intervencion")(e.target.value)}
              rows={2} className={TXA} />
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Entrenamiento</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["¿Qué tal sintió la rutina?",   "rutina_sintio"],
              ["¿Logró progresar?",            "logro_progresar"],
              ["¿Dolor muscular?",             "dolor_muscular"],
              ["¿Días de entrenamiento?",       "continuar_5_dias"],
              ["¿Realizó cardio?",             "realizo_cardio"],
            ] as [string, keyof Seguimiento][]).map(([lbl, key]) => (
              <div key={key}>
                <label className={LB}>{lbl}</label>
                <input value={newSeg[key] as string} onChange={(e) => setSF(key)(e.target.value)}
                  className={IC} />
              </div>
            ))}
          </div>
          <div>
            <label className={LB}>Intervención</label>
            <textarea value={newSeg.intervencion}
              onChange={(e) => setSF("intervencion")(e.target.value)}
              rows={2} className={TXA} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-primary/20">
            <button onClick={() => setShowNewSeg(false)}
              className="h-9 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={handleSaveSeguimiento} disabled={savingSeg}
              className="h-9 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
              {savingSeg ? "Guardando..." : "💾 Guardar seguimiento"}
            </button>
          </div>
        </div>
      )}

      {/* Lista de seguimientos existentes */}
      {(hist.seguimientos ?? []).length > 0 && (
        <div className="space-y-2">
          {(hist.seguimientos ?? []).map((seg) => {
            const isOpen = openSegs.has(seg.id);
            const d = new Date(seg.fecha + "T12:00:00");
            const fechaFmt = d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
            return (
              <div key={seg.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <button type="button" onClick={() => togSeg(seg.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                  <span className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-800">📅 Seguimiento — {fechaFmt}</span>
                    {seg.como_se_sintio && (
                      <span className="text-xs text-gray-500 truncate max-w-[200px]">{seg.como_se_sintio}</span>
                    )}
                  </span>
                  <span className="text-gray-400 text-sm">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div className="p-4 space-y-3 text-sm">
                    {[
                      ["¿Cómo se sintió?",                  seg.como_se_sintio],
                      ["Cambios notados",                    seg.cambios_notados],
                      ["¿Qué le pareció el menú?",           seg.menu_parecio],
                      ["Síntomas GI",                        seg.sintomas_gi],
                      ["Propuesta de intervención",          seg.propuesta_intervencion],

                      ["Estrés",                             seg.estres],
                      ["Ciclos menstruales",                 seg.ciclos_menstruales],
                      ["¿Utilizó equivalentes?",             seg.utilizo_equivalentes],
                      ["Rutina",                             seg.rutina],
                      ["Suplementos / medicamentos",         seg.suplementos_medicamentos],
                      ["¿Consumo de agua?",                  seg.consumo_agua],
                      ["Tiempos de comida",                   seg.seguir_4_tiempos],
                      ["Alimentos por quitar",               seg.alimentos_quitar],
                      ["Alimentos por incluir",              seg.alimentos_incluir],
                      ["¿Qué tal sintió la rutina?",         seg.rutina_sintio],
                      ["¿Logró progresar?",                  seg.logro_progresar],
                      ["¿Dolor muscular?",                   seg.dolor_muscular],
                      ["¿Días de entrenamiento?",            seg.continuar_5_dias],
                      ["¿Realizó cardio?",                   seg.realizo_cardio],
                      ["Intervención",                       seg.intervencion],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label as string} className="flex gap-2">
                        <span className="text-xs text-gray-500 font-medium w-48 shrink-0">{label}:</span>
                        <span className="text-xs text-gray-800">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm modal para medidas */}
      {showMedidasConfirm && (
        <ConfirmModal
          title="Registrar medidas"
          message={`¿Estás seguro de guardar estas medidas? Se creará un nuevo registro con fecha ${new Date().toLocaleDateString("es-MX")} que actualizará el progreso del usuario.`}
          confirmLabel="Sí, registrar"
          variant="warning"
          onConfirm={handleSaveMedidas}
          onCancel={() => setShowMedidasConfirm(false)}
        />
      )}
    </div>
  );
}
