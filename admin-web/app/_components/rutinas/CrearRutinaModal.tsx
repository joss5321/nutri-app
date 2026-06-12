"use client";
import { useState } from "react";

const MUSCLE_GROUPS = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Piernas", "Glúteos", "Abdomen", "Isquiotibiales"];

type Serie = { peso: string };

export default function CrearRutinaModal({ onClose }: { onClose: () => void }) {
  const [name, setName]                 = useState("Sentadilla con barra");
  const [tipo, setTipo]                 = useState("Fuerza");
  const [desc, setDesc]                 = useState("Ejercicio compuesto que trabaja principalmente cuádriceps, glúteos e isquiotibiales.");
  const [series, setSeries]             = useState("4");
  const [reps, setReps]                 = useState("10");
  const [rest, setRest]                 = useState("90");
  const [pesoType, setPesoType]         = useState<"peso" | "reps">("peso");
  const [muscPrinc, setMuscPrinc]       = useState("Piernas");
  const [muscSec, setMuscSec]           = useState<string[]>(["Glúteos", "Isquiotibiales"]);
  const [seriesData, setSeriesData]     = useState<Serie[]>([{ peso: "60" }, { peso: "70" }, { peso: "80" }, { peso: "80" }]);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const addSerie = () => setSeriesData((s) => [...s, { peso: "" }]);
  const toggleMuscSec = (m: string) =>
    setMuscSec((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-xl">Crear rutina</h2>
            <p className="text-gray-500 text-sm">Completa la información para agregar un nuevo ejercicio a la rutina.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">×</button>
        </div>

        <div className="grid grid-cols-3 gap-6 p-6">
          {/* ── Columna izquierda ── */}
          <div className="col-span-2 flex flex-col gap-6">
            {/* 1. Información del ejercicio */}
            <section>
              <p className="text-sm font-bold text-gray-800 mb-3">1. Información del ejercicio</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nombre del ejercicio *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tipo de ejercicio</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary">
                    {["Fuerza", "Cardio", "Movilidad", "Resistencia"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Descripción (opcional)</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
                  maxLength={200}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none h-20" />
                <p className="text-xs text-gray-400 text-right mt-0.5">{desc.length}/200</p>
              </div>
            </section>

            {/* 2. Video demostrativo */}
            <section>
              <p className="text-sm font-bold text-gray-800 mb-3">2. Video demostrativo</p>
              <div className="relative bg-gray-900 rounded-xl overflow-hidden h-44 flex items-center justify-center">
                {videoPreview ? (
                  <video src={videoPreview} controls className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <span className="text-4xl">🎬</span>
                    <p className="text-sm">Arrastra un video o pega una URL de YouTube</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-400">Formatos: MP4, MOV o YouTube URL. Máx. 50MB.</p>
                <label className="flex items-center gap-1 text-xs text-primary font-semibold cursor-pointer hover:underline">
                  ↑ Cambiar video
                  <input type="file" accept="video/*" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setVideoPreview(URL.createObjectURL(f));
                    }} />
                </label>
              </div>
              <div className="mt-2">
                <input
                  placeholder="O pega aquí la URL de YouTube / Vimeo"
                  className="w-full h-9 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none focus:border-primary"
                  onBlur={(e) => { if (e.target.value) setVideoPreview(e.target.value); }}
                />
              </div>
            </section>

            {/* 3. Parámetros */}
            <section>
              <p className="text-sm font-bold text-gray-800 mb-3">3. Parámetros del ejercicio</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { label: "Series *",      val: series,   set: setSeries },
                  { label: "Repeticiones *", val: reps,    set: setReps   },
                  { label: "Descanso",       val: rest,    set: setRest, suffix: "seg" },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden h-10">
                      <input value={f.val} onChange={(e) => f.set(e.target.value)}
                        type="number"
                        className="flex-1 px-3 text-sm focus:outline-none" />
                      {f.suffix && <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 h-full flex items-center">{f.suffix}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Peso selector */}
              <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-3">
                {(["peso", "reps"] as const).map((t) => (
                  <button key={t} onClick={() => setPesoType(t)}
                    className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                      pesoType === t ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-50"
                    }`}>
                    {t === "peso" ? "Por peso" : "Por repetición"}
                  </button>
                ))}
              </div>

              {/* Series individuales */}
              <p className="text-xs text-gray-500 font-medium mb-2">Peso por serie (kg) *</p>
              <div className="flex flex-col gap-2">
                {seriesData.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 h-10">
                    <span className="text-sm text-gray-500 w-12 shrink-0">Serie {i + 1}</span>
                    <input value={s.peso}
                      onChange={(e) => setSeriesData((prev) => prev.map((x, j) => j === i ? { ...x, peso: e.target.value } : x))}
                      type="number"
                      className="flex-1 bg-transparent focus:outline-none text-sm text-gray-800" />
                    <span className="text-xs text-gray-400">kg</span>
                  </div>
                ))}
                <button onClick={addSerie}
                  className="flex items-center gap-1 text-primary text-sm font-semibold hover:underline self-start mt-1">
                  + Agregar serie
                </button>
              </div>
            </section>

            {/* 4. Grupo muscular */}
            <section>
              <p className="text-sm font-bold text-gray-800 mb-3">4. Grupo muscular involucrado</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Grupo muscular principal *</label>
                  <select value={muscPrinc} onChange={(e) => setMuscPrinc(e.target.value)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary">
                    {MUSCLE_GROUPS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Grupos musculares secundarios</label>
                  <div className="flex flex-wrap gap-1.5 border border-gray-200 rounded-xl px-3 py-2 min-h-10">
                    {muscSec.map((m) => (
                      <span key={m} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                        {m}
                        <button onClick={() => toggleMuscSec(m)} className="hover:text-primary-dark">×</button>
                      </span>
                    ))}
                    <select onChange={(e) => { if (e.target.value) toggleMuscSec(e.target.value); e.target.value = ""; }}
                      className="text-xs text-gray-400 focus:outline-none bg-transparent flex-1 min-w-16">
                      <option value="">Agregar...</option>
                      {MUSCLE_GROUPS.filter((m) => !muscSec.includes(m) && m !== muscPrinc).map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ── Vista previa ── */}
          <div className="col-span-1">
            <div className="sticky top-0 bg-gray-50 rounded-2xl border border-gray-200 p-4">
              <p className="text-sm font-bold text-gray-800 mb-4">Vista previa del ejercicio</p>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">🏋️</div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{name || "Nombre del ejercicio"}</p>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{tipo}</span>
                </div>
              </div>

              <div className="bg-gray-200 rounded-xl h-36 flex items-center justify-center mb-3 overflow-hidden">
                {videoPreview ? (
                  <video src={videoPreview} className="w-full h-full object-cover" muted />
                ) : (
                  <span className="text-gray-400 text-sm">Sin video</span>
                )}
              </div>

              <p className="text-xs font-bold text-gray-700 mb-1">Grupo muscular principal</p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🦵</span>
                <span className="font-semibold text-gray-800 text-sm">{muscPrinc}</span>
              </div>

              {muscSec.length > 0 && (
                <>
                  <p className="text-xs font-bold text-gray-700 mb-1">Grupos musculares secundarios</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {muscSec.map((m) => (
                      <span key={m} className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{m}</span>
                    ))}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "Series",      value: series       },
                  { label: "Repeticiones", value: `${reps} reps` },
                  { label: "Peso",        value: seriesData.length > 0 ? `${seriesData[0].peso}–${seriesData[seriesData.length - 1].peso} kg` : "—" },
                  { label: "Descanso",    value: `${rest} seg` },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-xl p-2.5 border border-gray-100">
                    <p className="text-gray-400 font-medium">{s.label}</p>
                    <p className="font-bold text-gray-900 mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-5 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 h-10 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/5">
              ⊕ Guardar y agregar otro
            </button>
            <button className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark">
              ✓ Guardar ejercicio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
