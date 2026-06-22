"use client";
import { useEffect, useState } from "react";
import { MUSCLE_GROUPS, type Exercise } from "@/app/_data/exercises";
import { fetchEjercicios } from "@/app/_data/ejercicios";
import ConfirmModal from "@/app/_components/ConfirmModal";
import {
  DAYS,
  deleteRutina,
  fetchRutinaActiva,
  saveRutina,
  type RutinaInput,
} from "@/app/_data/rutinas";

type Assigned = { uid: string; exerciseId: string; series: string; reps: string; peso: string };

const buildInitialAssigned = (): Record<string, Assigned[]> =>
  Object.fromEntries(DAYS.map((d) => [d, []]));

export default function RutinaBuilderModal({
  patient,
  onClose,
}: {
  patient: { id: string; name: string };
  onClose: () => void;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [assigned, setAssigned] = useState<Record<string, Assigned[]>>(buildInitialAssigned);
  const [activeDay, setActiveDay] = useState(DAYS[0]);
  const [search, setSearch] = useState("");
  const [grupo, setGrupo] = useState("Todos");
  const [dragOver, setDragOver] = useState(false);

  const [rutinaId, setRutinaId] = useState<string | null>(null);
  const [nombre, setNombre] = useState(`Rutina de ${patient.name}`);
  const [loadingRutina, setLoadingRutina] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchEjercicios()
      .then(setExercises)
      .catch(() => {})
      .finally(() => setLoadingExercises(false));
  }, []);

  const loadRutina = () => {
    fetchRutinaActiva(patient.id)
      .then((rutina) => {
        if (!rutina) return;
        setRutinaId(rutina.id);
        setNombre(rutina.nombre);
        const next = buildInitialAssigned();
        for (const dia of rutina.rutina_dias) {
          const dayName = DAYS[dia.numero_dia - 1];
          if (!dayName) continue;
          next[dayName] = dia.rutina_ejercicios.map((ej) => ({
            uid: ej.id,
            exerciseId: ej.ejercicio_id,
            series: ej.series != null ? String(ej.series) : "",
            reps: ej.repeticiones ?? "",
            peso: ej.peso_sugerido_kg != null ? String(ej.peso_sugerido_kg) : "",
          }));
        }
        setAssigned(next);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar la rutina."))
      .finally(() => setLoadingRutina(false));
  };

  useEffect(() => {
    loadRutina();
  }, []);

  const retryLoadRutina = () => {
    setLoadingRutina(true);
    setError(null);
    loadRutina();
  };

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
    const sanitized = field === "reps" ? value.replace(/-/g, "") : value.replace(/^-/, "");
    setAssigned((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((a) => a.uid === uid ? { ...a, [field]: sanitized } : a),
    }));
  };

  const totalAsignados = Object.values(assigned).reduce((acc, day) => acc + day.length, 0);

  const handleSave = async () => {
    const allExercises = Object.entries(assigned).flatMap(([day, exs]) =>
      exs.map((a) => ({ day, ...a }))
    );
    const invalid = allExercises.find((a) => !a.series.trim() || !a.reps.trim());
    if (invalid) {
      setFeedback({ type: "error", text: `Completa Series y Reps de todos los ejercicios (revisa ${invalid.day}).` });
      return;
    }
    const negative = allExercises.find(
      (a) => Number(a.series) < 0 || Number(a.peso) < 0
    );
    if (negative) {
      setFeedback({ type: "error", text: `No se permiten valores negativos (revisa ${negative.day}).` });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const input: RutinaInput = {
        nombre: nombre.trim() || `Rutina de ${patient.name}`,
        dias: DAYS.map((d, i) => ({
          numero_dia: i + 1,
          nombre_dia: d,
          es_descanso: assigned[d].length === 0,
          ejercicios: assigned[d].map((a, idx) => ({
            ejercicio_id: a.exerciseId,
            orden: idx,
            series: a.series.trim() ? Number(a.series) : null,
            repeticiones: a.reps.trim() || null,
            peso_sugerido_kg: a.peso.trim() ? Number(a.peso) : null,
            descanso_seg: null,
            rir: null,
          })),
        })),
      };
      const saved = await saveRutina(patient.id, input, rutinaId ?? undefined);
      setRutinaId(saved.id);
      setFeedback({ type: "success", text: "Rutina guardada correctamente." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo guardar la rutina." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!rutinaId) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    setFeedback(null);
    try {
      await deleteRutina(rutinaId);
      setRutinaId(null);
      setNombre(`Rutina de ${patient.name}`);
      setAssigned(buildInitialAssigned());
      setFeedback({ type: "success", text: "Rutina eliminada." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "No se pudo eliminar la rutina." });
    } finally {
      setDeleting(false);
    }
  };

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
              <h2 className="font-bold text-gray-900 text-xl">{nombre}</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">×</button>
        </div>

        {loadingRutina ? (
          <div className="flex-1 flex items-center justify-center p-10 text-gray-400 text-sm">Cargando rutina...</div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={retryLoadRutina} className="text-sm font-semibold text-primary hover:underline">Reintentar</button>
          </div>
        ) : (
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
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {ex.grupo_muscular && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{ex.grupo_muscular}</span>
                      )}
                      {ex.grupos_secundarios.map((g) => (
                        <span key={g} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{g}</span>
                      ))}
                    </div>
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
                            type={f.key === "reps" ? "text" : "number"}
                            min={f.key !== "reps" ? "0" : undefined}
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
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
              Cancelar
            </button>
            {rutinaId && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting || saving}
                className="px-5 h-10 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? "Eliminando..." : "🗑️ Eliminar rutina"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {feedback && (
              <span className={`text-xs font-medium ${feedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
                {feedback.text}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || deleting || loadingRutina}
              className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "Guardando..." : "✓ Guardar rutina"}
            </button>
          </div>
        </div>
      </div>
      {showDeleteConfirm && (
        <ConfirmModal
          title="Eliminar rutina"
          message="¿Estás seguro de que deseas eliminar esta rutina? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
