"use client";
import { useState } from "react";

// ── Equivalentes (mismos grupos que en mobile-app) ──────────────────────────
const MEAL_LABELS = ["Desayuno", "Colación 1", "Comida", "Colación 2", "Cena"];
const FOOD_GROUPS_INIT = [
  { icon: "🥣", label: "Cereales sin grasa",   meals: [0, 0, 0, 0, 0] },
  { icon: "🍎", label: "Frutas",               meals: [0, 0, 0, 0, 0] },
  { icon: "🥦", label: "Verduras",             meals: [0, 0, 0, 0, 0] },
  { icon: "🥛", label: "Leche descremada",     meals: [0, 0, 0, 0, 0] },
  { icon: "🍗", label: "POA muy bajo aporte",  meals: [0, 0, 0, 0, 0] },
  { icon: "🐟", label: "POA bajo aporte",      meals: [0, 0, 0, 0, 0] },
  { icon: "🥩", label: "POA medio aporte",     meals: [0, 0, 0, 0, 0] },
  { icon: "🫒", label: "Aceites y grasas",     meals: [0, 0, 0, 0, 0] },
  { icon: "🫘", label: "AC y C c/Proteína",    meals: [0, 0, 0, 0, 0] },
];

const RECIPE_OPTIONS = [
  "Pechuga de pollo a la plancha con quinoa",
  "Avena con frutas y almendras",
  "Salmón al horno con batata y espárragos",
  "Ensalada de atún con aguacate",
  "Carne magra salteada con arroz integral",
  "Batido de proteína con frutos rojos",
];

type Menu = { id: number; nombre: string; comidas: Record<string, string> };
type Cita = { id: number; fecha: string; hora: string; tipo: string; profesional: string; modalidad: string; notas: string };
type Tab = "personal" | "nutricion" | "cita";

function imcInfo(imc: number) {
  if (imc < 18.5) return { label: "Bajo peso", color: "bg-blue-50 text-blue-600" };
  if (imc < 25)   return { label: "Normal",    color: "bg-green-50 text-green-600" };
  if (imc < 30)   return { label: "Sobrepeso", color: "bg-yellow-50 text-yellow-600" };
  return { label: "Obesidad", color: "bg-red-50 text-red-600" };
}

export default function CrearUsuarioModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("personal");

  // ── Información personal (obligatoria) ──
  const [nombre, setNombre]       = useState("");
  const [correo, setCorreo]       = useState("");
  const [telefono, setTelefono]   = useState("");
  const [direccion, setDireccion] = useState("");
  const [peso, setPeso]           = useState("");
  const [altura, setAltura]       = useState("");
  const [sexo, setSexo]           = useState("Femenino");
  const [edad, setEdad]           = useState("");
  const [cintura, setCintura]     = useState("");
  const [cadera, setCadera]       = useState("");

  // ── Información personal (opcional) ──
  const [masaMuscular, setMasaMuscular] = useState("");
  const [grasa, setGrasa]               = useState("");
  const [brazo, setBrazo]               = useState("");
  const [pantorrilla, setPantorrilla]   = useState("");

  const pesoNum = parseFloat(peso);
  const alturaNum = parseFloat(altura);
  const imc = pesoNum > 0 && alturaNum > 0 ? pesoNum / Math.pow(alturaNum / 100, 2) : null;

  // ── Nutrición ──
  const [foodGroups, setFoodGroups] = useState(FOOD_GROUPS_INIT);
  const updateMeal = (gi: number, mi: number, value: string) => {
    const v = Math.max(0, parseInt(value) || 0);
    setFoodGroups((prev) => prev.map((g, i) => i === gi ? { ...g, meals: g.meals.map((m, j) => j === mi ? v : m) } : g));
  };

  const [menus, setMenus] = useState<Menu[]>([]);
  const [menuNombre, setMenuNombre] = useState("");
  const [menuComidas, setMenuComidas] = useState<Record<string, string>>(
    Object.fromEntries(MEAL_LABELS.map((m) => [m, RECIPE_OPTIONS[0]]))
  );
  const addMenu = () => {
    if (!menuNombre.trim()) return;
    setMenus((prev) => [...prev, { id: Date.now(), nombre: menuNombre.trim(), comidas: { ...menuComidas } }]);
    setMenuNombre("");
  };
  const removeMenu = (id: number) => setMenus((prev) => prev.filter((m) => m.id !== id));

  // ── Cita ──
  const [citaFecha, setCitaFecha]           = useState("");
  const [citaHora, setCitaHora]             = useState("");
  const [citaTipo, setCitaTipo]             = useState("Nutrición");
  const [citaProfesional, setCitaProfesional] = useState("Lic. Ana Torres");
  const [citaModalidad, setCitaModalidad]   = useState("Presencial");
  const [citaNotas, setCitaNotas]           = useState("");
  const [citas, setCitas] = useState<Cita[]>([]);
  const addCita = () => {
    if (!citaFecha || !citaHora) return;
    setCitas((prev) => [...prev, {
      id: Date.now(), fecha: citaFecha, hora: citaHora,
      tipo: citaTipo, profesional: citaProfesional, modalidad: citaModalidad, notas: citaNotas,
    }]);
    setCitaFecha(""); setCitaHora(""); setCitaNotas("");
  };
  const removeCita = (id: number) => setCitas((prev) => prev.filter((c) => c.id !== id));

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
            <h2 className="font-bold text-gray-900 text-xl">Agregar nuevo usuario</h2>
            <p className="text-gray-500 text-sm">Completa la información para registrar al usuario en la plataforma.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
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
          {/* ── TAB: Información Personal ── */}
          {tab === "personal" && (
            <div className="space-y-5">
              <div>
                <p className="font-semibold text-gray-900">Información obligatoria</p>
                <p className="text-sm text-gray-500">Datos básicos y antropométricos del usuario.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Nombre completo *", value: nombre,   set: setNombre,   type: "text",  span: 1 },
                  { label: "Correo *",          value: correo,   set: setCorreo,   type: "email", span: 1 },
                  { label: "Teléfono *",        value: telefono, set: setTelefono, type: "tel",   span: 1 },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
                    <input value={f.value} type={f.type} onChange={(e) => f.set(e.target.value)}
                      className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                  </div>
                ))}

                <div className="col-span-3">
                  <label className="text-xs text-gray-500 font-medium block mb-1">Dirección *</label>
                  <input value={direccion} onChange={(e) => setDireccion(e.target.value)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>

                {[
                  { label: "Peso (kg) *",  value: peso,   set: setPeso,   type: "number" },
                  { label: "Altura (cm) *", value: altura, set: setAltura, type: "number" },
                  { label: "Edad *",       value: edad,   set: setEdad,   type: "number" },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
                    <input value={f.value} type={f.type} onChange={(e) => f.set(e.target.value)}
                      className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                  </div>
                ))}

                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Sexo *</label>
                  <select value={sexo} onChange={(e) => setSexo(e.target.value)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary">
                    {["Femenino", "Masculino", "Otro"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {[
                  { label: "Circunferencia de cintura (cm) *", value: cintura, set: setCintura },
                  { label: "Circunferencia de cadera (cm) *",  value: cadera,  set: setCadera  },
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
                  { label: "% Masa muscular",            value: masaMuscular, set: setMasaMuscular },
                  { label: "% Grasa corporal",           value: grasa,        set: setGrasa        },
                  { label: "Circunferencia brazo (cm)",  value: brazo,        set: setBrazo        },
                  { label: "Circunferencia pantorrilla (cm)", value: pantorrilla, set: setPantorrilla },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
                    <input value={f.value} type="number" onChange={(e) => f.set(e.target.value)}
                      className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: Nutrición ── */}
          {tab === "nutricion" && (
            <div className="space-y-6">
              <div>
                <p className="font-semibold text-gray-900">Tabla de equivalentes</p>
                <p className="text-sm text-gray-500">Define cuántos equivalentes de cada grupo corresponden a cada tiempo de comida.</p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primary/5">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Grupo</th>
                      {MEAL_LABELS.map((m) => (
                        <th key={m} className="px-2 py-2 text-xs font-semibold text-primary text-center">{m}</th>
                      ))}
                      <th className="px-2 py-2 text-xs font-semibold text-gray-600 text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foodGroups.map((g, gi) => {
                      const total = g.meals.reduce((a, b) => a + b, 0);
                      return (
                        <tr key={g.label} className="border-t border-gray-100">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{g.icon}</span>
                              <span className="text-gray-700 text-xs font-medium">{g.label}</span>
                            </div>
                          </td>
                          {g.meals.map((v, mi) => (
                            <td key={mi} className="px-1 py-1.5">
                              <input type="number" min={0} value={v}
                                onChange={(e) => updateMeal(gi, mi, e.target.value)}
                                className="w-12 h-8 text-center border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary mx-auto block" />
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center">
                            <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">{total}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="font-semibold text-gray-900">Crear menús</p>
                <p className="text-sm text-gray-500 mb-3">Asigna una receta para cada tiempo de comida y guarda el menú.</p>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Nombre del menú</label>
                    <input value={menuNombre} onChange={(e) => setMenuNombre(e.target.value)}
                      placeholder="Ej. Menú Lunes - Semana 1"
                      className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary" />
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {MEAL_LABELS.map((m) => (
                      <div key={m}>
                        <label className="text-xs text-gray-500 font-medium block mb-1">{m}</label>
                        <select value={menuComidas[m]} onChange={(e) => setMenuComidas((prev) => ({ ...prev, [m]: e.target.value }))}
                          className="w-full h-10 border border-gray-200 rounded-xl px-2 text-xs bg-white focus:outline-none focus:border-primary">
                          {RECIPE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button onClick={addMenu}
                    className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark">
                    + Agregar menú
                  </button>
                </div>

                {menus.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {menus.map((menu) => (
                      <div key={menu.id} className="bg-white rounded-xl border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-bold text-gray-900 text-sm">🍽 {menu.nombre}</p>
                          <button onClick={() => removeMenu(menu.id)} className="text-gray-400 hover:text-red-500 text-sm">✕</button>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {MEAL_LABELS.map((m) => (
                            <div key={m} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-semibold uppercase">{m}</p>
                              <p className="text-xs text-gray-700 mt-0.5">{menu.comidas[m]}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Cita ── */}
          {tab === "cita" && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="font-semibold text-gray-900">Próxima cita</p>
                <p className="text-sm text-gray-500 mb-3">Programa la siguiente cita del usuario.</p>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                      <input type="date" value={citaFecha} onChange={(e) => setCitaFecha(e.target.value)}
                        className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Hora</label>
                      <input type="time" value={citaHora} onChange={(e) => setCitaHora(e.target.value)}
                        className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                  {[
                    { label: "Tipo de cita", value: citaTipo,        set: setCitaTipo,        options: ["Nutrición", "Entrenamiento", "Seguimiento"] },
                    { label: "Profesional",  value: citaProfesional, set: setCitaProfesional, options: ["Lic. Ana Torres", "Lic. Carlos Vega"] },
                    { label: "Modalidad",    value: citaModalidad,   set: setCitaModalidad,   options: ["Presencial", "En línea"] },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                      <select value={f.value} onChange={(e) => f.set(e.target.value)}
                        className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary">
                        {f.options.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
                    <textarea value={citaNotas} onChange={(e) => setCitaNotas(e.target.value)}
                      placeholder="Escribe alguna nota adicional..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary resize-none h-16" />
                  </div>
                  <button onClick={addCita}
                    className="w-full h-10 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark">
                    📅 Agregar cita
                  </button>
                </div>
              </div>

              <div>
                <p className="font-semibold text-gray-900">Citas programadas</p>
                <p className="text-sm text-gray-500 mb-3">{citas.length === 0 ? "Aún no hay citas agregadas." : `${citas.length} cita(s) agregada(s).`}</p>
                <div className="space-y-2">
                  {citas.map((c) => (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-3 flex gap-3">
                      <div className="flex flex-col items-center bg-primary text-white rounded-xl px-3 py-2 text-center shrink-0 min-w-16">
                        <span className="text-xs font-bold opacity-80">{c.fecha || "--/--"}</span>
                        <span className="text-sm font-extrabold">{c.hora || "--:--"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-gray-800 text-sm">{c.tipo}</p>
                          <button onClick={() => removeCita(c.id)} className="text-gray-400 hover:text-red-500 text-sm">✕</button>
                        </div>
                        <p className="text-xs text-gray-500">{c.profesional}</p>
                        <p className="text-xs text-gray-400">📍 {c.modalidad}</p>
                        {c.notas && <p className="text-xs text-gray-400 mt-1">📝 {c.notas}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-5 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onClose} className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark">
            ✓ Crear usuario
          </button>
        </div>
      </div>
    </div>
  );
}
