"use client";
import { useEffect, useState } from "react";
import { MUSCLE_GROUPS, type Exercise } from "@/app/_data/exercises";
import { fetchEjercicios } from "@/app/_data/ejercicios";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

type Assigned = { uid: string; exerciseId: string; series: string; reps: string; peso: string };

const buildInitialAssigned = (): Record<string, Assigned[]> =>
  Object.fromEntries(DAYS.map((d) => [d, []]));

export default function RutinaBuilderModal({
  patient,
  onClose,
}: {
  patient: { id: number; name: string };
  onClose: () => void;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [assigned, setAssigned] = useState<Record<string, Assigned[]>>(buildInitialAssigned);
  const [activeDay, setActiveDay] = useState(DAYS[0]);
  const [search, setSearch] = useState("");
  const [grupo, setGrupo] = useState("Todos");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetchEjercicios()
      .then(setExercises)
      .catch(() => {})
      .finally(() => setLoadingExercises(false));
  }, []);

  const exerciseById = (id: string) => exercises.find((e) => e.id === id);

  const catalog = exercises.filter((e) => {
    const matchSearch = e.nombre.toLowerCase().includes(search.toLowerCase());
    const matchGrupo = grupo === "Todos" || e.grupo_muscular === grupo || e.grupos_secundarios.includes(grupo);
    return matchSearch && matchGrupo;
  });

  const addExercise = (exerciseId: string) => {
    setAssigned((prev) => ({
      ...prev,
      [activeDay]: [...prev[activeDay], { uid: `${activeDay}-${Date.now()}-${Math.random()}`, exerciseId, series: "3", reps: "10", peso: "" }],
    }));
  };

  const removeExercise = (uid: string) => {
    setAssigned((prev) => ({ ...prev, [activeDay]: prev[activeDay].filter((a) => a.uid !== uid) }));
  };

  const updateField = (uid: string, field: "series" | "reps" | "peso", value: string) => {
    setAssigned((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((a) => a.uid === uid ? { ...a, [field]: value } : a),
    }));
  };

  const totalAsignados = Object.values(assigned).reduce((acc, day) => acc + day.length, 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg">
              {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-xl">Rutina de {patient.name}</h2>
              <p className="text-gray-500 text-sm">Arrastra ejercicios del catálogo hacia el día seleccionado.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">×</button>
        </div>

        <div className="grid grid-cols-3 gap-6 p-6 flex-1">
          {/* ── Catálogo de ejercicios ── */}
          <div className="col-span-1 flex flex-col gap-3">
            <p className="text-sm font-bold text-gray-800">Catálogo de ejercicios</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-10">
              <span className="text-gray-400 text-sm">🔍</span>
              <input
                placeholder="Buscar ejercicio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700"
              />
            </div>
            <select value={grupo} onChange={(e) => setGrupo(e.target.value)}
              className="h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary">
              <option>Todos</option>
              {MUSCLE_GROUPS.map((m) => <option key={m}>{m}</option>)}
            </select>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[28rem] pr-1">
              {loadingExercises && (
                <p className="text-xs text-gray-400 text-center py-6">Cargando catálogo...</p>
              )}
              {!loadingExercises && catalog.map((ex) => (
                <div
                  key={ex.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", ex.id)}
                  onClick={() => addExercise(ex.id)}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                  title="Arrastra hacia un día o haz clic para agregarlo al día seleccionado"
                >
                  <span className="text-gray-400 text-xs">⠿</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{ex.nombre}</p>
                    {ex.grupo_muscular && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{ex.grupo_muscular}</span>
                    )}
                  </div>
                </div>
              ))}
              {!loadingExercises && catalog.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">No se encontraron ejercicios.</p>
              )}
            </div>
          </div>

          {/* ── Rutina por día ── */}
          <div className="col-span-2 flex flex-col gap-3">
            <p className="text-sm font-bold text-gray-800">Rutina semanal · {totalAsignados} ejercicio{totalAsignados !== 1 ? "s" : ""} asignados</p>

            {/* Tabs de días */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => setActiveDay(d)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeDay === d ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {d} {assigned[d].length > 0 && <span className="ml-1 opacity-75">({assigned[d].length})</span>}
                </button>
              ))}
            </div>

            {/* Zona de drop */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) addExercise(id);
                setDragOver(false);
              }}
              className={`flex-1 rounded-xl border-2 border-dashed p-3 flex flex-col gap-2 min-h-[24rem] transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-gray-200"
              }`}
            >
              {assigned[activeDay].length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-1">
                  <span className="text-3xl">🏋️</span>
                  <p className="text-sm">Arrastra ejercicios aquí para {activeDay}</p>
                </div>
              )}

              {assigned[activeDay].map((a) => {
                const ex = exerciseById(a.exerciseId);
                if (!ex) return null;
                return (
                  <div key={a.uid} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">{ex.emoji || "🏋️"}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm truncate">{ex.nombre}</p>
                      {ex.grupo_muscular && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{ex.grupo_muscular}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {[
                        { key: "series" as const, label: "Series" },
                        { key: "reps" as const,   label: "Reps" },
                        { key: "peso" as const,   label: "Peso (kg)" },
                      ].map((f) => (
                        <div key={f.key} className="flex flex-col items-center">
                          <span className="text-[10px] text-gray-400">{f.label}</span>
                          <input
                            value={a[f.key]}
                            onChange={(e) => updateField(a.uid, f.key, e.target.value)}
                            type="number"
                            className="w-14 h-8 text-center border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary"
                          />
                        </div>
                      ))}
                    </div>
                    <button onClick={() => removeExercise(a.uid)} className="text-gray-400 hover:text-red-500 shrink-0">✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-5 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onClose} className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark">
            ✓ Guardar rutina
          </button>
        </div>
      </div>
    </div>
  );
}
