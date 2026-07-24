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

type SerieRow = { reps: string; peso: string };

type Assigned = {
  uid: string;
  exerciseId: string;
  series: string;
  seriesRows: SerieRow[];
  rir: string;
  rpe: string;
  descanso: string;
  tipoEsfuerzo: "reps" | "tiempo";
  unidadPeso: "kg" | "lbs";
};

const DEFAULT_SERIES = 3;
const makeRows = (n: number, template?: SerieRow): SerieRow[] =>
  Array.from({ length: n }, () => ({ reps: template?.reps ?? "10", peso: template?.peso ?? "" }));

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

  const [pesoUnidad, setPesoUnidad] = useState<"kg" | "lbs">("kg");
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
        setPesoUnidad(rutina.unidad_peso ?? "kg");
        const next = buildInitialAssigned();
        for (const dia of rutina.rutina_dias) {
          const dayName = DAYS[dia.numero_dia - 1];
          if (!dayName) continue;
          next[dayName] = dia.rutina_ejercicios.map((ej) => {
            const n = ej.series ?? DEFAULT_SERIES;
            let seriesRows: SerieRow[];
            if (ej.series_detalle && Array.isArray(ej.series_detalle) && ej.series_detalle.length > 0) {
              seriesRows = ej.series_detalle.map((s) => ({
                reps: s.reps ?? "",
                peso: s.peso != null ? String(s.peso) : "",
              }));
            } else {
              seriesRows = makeRows(n, {
                reps: ej.repeticiones ?? "10",
                peso: ej.peso_sugerido_kg != null ? String(ej.peso_sugerido_kg) : "",
              });
            }
            return {
              uid: ej.id,
              exerciseId: ej.ejercicio_id,
              series: String(n),
              seriesRows,
              rir: ej.rir != null ? String(ej.rir) : "",
              rpe: ej.rpe != null ? String(ej.rpe) : "",
              descanso: ej.descanso_seg != null ? String(ej.descanso_seg) : "",
              tipoEsfuerzo: ej.tipo_esfuerzo ?? "reps",
              unidadPeso: ej.unidad_peso ?? rutina.unidad_peso ?? "kg",
            };
          });
        }
        setAssigned(next);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar la rutina."))
      .finally(() => setLoadingRutina(false));
  };

  useEffect(() => { loadRutina(); }, []);

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
      [activeDay]: [
        ...prev[activeDay],
        {
          uid: `${activeDay}-${Date.now()}-${Math.random()}`,
          exerciseId,
          series: String(DEFAULT_SERIES),
          seriesRows: makeRows(DEFAULT_SERIES),
          rir: "",
          rpe: "",
          descanso: "",
          tipoEsfuerzo: "reps",
          unidadPeso: pesoUnidad,
        },
      ],
    }));
  };

  const updateExerciseUnit = (uid: string, unit: "kg" | "lbs") => {
    setAssigned((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((a) => (a.uid === uid ? { ...a, unidadPeso: unit } : a)),
    }));
  };

  const removeExercise = (uid: string) => {
    setAssigned((prev) => ({ ...prev, [activeDay]: prev[activeDay].filter((a) => a.uid !== uid) }));
  };

  const updateSeries = (uid: string, value: string) => {
    const n = Math.max(1, parseInt(value) || 1);
    setAssigned((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((a) => {
        if (a.uid !== uid) return a;
        const cur = a.seriesRows;
        const last = cur[cur.length - 1] ?? { reps: "10", peso: "" };
        const newRows =
          n > cur.length
            ? [...cur, ...makeRows(n - cur.length, last)]
            : cur.slice(0, n);
        return { ...a, series: String(n), seriesRows: newRows };
      }),
    }));
  };

  const updateSerieRow = (uid: string, si: number, field: "reps" | "peso", value: string) => {
    const sanitized = value.replace(/^-/, "");
    setAssigned((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((a) => {
        if (a.uid !== uid) return a;
        const newRows = a.seriesRows.map((row, i) => (i === si ? { ...row, [field]: sanitized } : row));
        return { ...a, seriesRows: newRows };
      }),
    }));
  };

  const updateExerciseField = (uid: string, field: "rir" | "rpe" | "descanso", value: string) => {
    const sanitized = value.replace(/^-/, "");
    setAssigned((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((a) => (a.uid === uid ? { ...a, [field]: sanitized } : a)),
    }));
  };

  const toggleTipoEsfuerzo = (uid: string) => {
    setAssigned((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((a) =>
        a.uid === uid
          ? { ...a, tipoEsfuerzo: a.tipoEsfuerzo === "reps" ? "tiempo" : "reps" }
          : a
      ),
    }));
  };

  const totalAsignados = Object.values(assigned).reduce((acc, day) => acc + day.length, 0);

  const handleSave = async () => {
    const allExercises = Object.entries(assigned).flatMap(([day, exs]) =>
      exs.map((a) => ({ day, ...a }))
    );
    const invalid = allExercises.find(
      (a) => !a.series.trim() || a.seriesRows.some((r) => !r.reps.trim())
    );
    if (invalid) {
      const label = invalid.tipoEsfuerzo === "tiempo" ? "Tiempo" : "Reps";
      setFeedback({ type: "error", text: `Completa ${label} de todas las series (revisa ${invalid.day}).` });
      return;
    }
    const negative = allExercises.find(
      (a) => Number(a.series) < 0 || a.seriesRows.some((r) => r.peso.trim() && Number(r.peso) < 0)
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
        unidad_peso: pesoUnidad,
        dias: DAYS.map((d, i) => ({
          numero_dia: i + 1,
          nombre_dia: d,
          es_descanso: assigned[d].length === 0,
          ejercicios: assigned[d].map((a, idx) => ({
            ejercicio_id: a.exerciseId,
            orden: idx,
            series: a.series.trim() ? Number(a.series) : null,
            repeticiones: a.seriesRows.map((r) => r.reps || "—").join(","),
            peso_sugerido_kg: a.seriesRows[0]?.peso.trim() ? Number(a.seriesRows[0].peso) : null,
            descanso_seg: a.descanso.trim() ? Number(a.descanso) : null,
            rir: a.rir.trim() ? Number(a.rir) : null,
            rpe: a.rpe.trim() ? Number(a.rpe) : null,
            tipo_esfuerzo: a.tipoEsfuerzo,
            unidad_peso: a.unidadPeso,
            series_detalle: a.seriesRows.map((r) => ({
              reps: r.reps || null,
              peso: r.peso.trim() ? Number(r.peso) : null,
            })),
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

              <div className="flex flex-col gap-2 overflow-y-auto max-h-[32rem] pr-1">
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
                    title="Arrastra o haz clic para agregar al día seleccionado"
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
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800">
                  Rutina semanal · {totalAsignados} ejercicio{totalAsignados !== 1 ? "s" : ""} asignados
                </p>
                {/* Unidad por defecto para nuevos ejercicios */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">Unidad por defecto:</span>
                  <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                    {(["kg", "lbs"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => setPesoUnidad(u)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          pesoUnidad === u ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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
                className={`flex-1 rounded-xl border-2 border-dashed p-3 flex flex-col gap-3 min-h-[24rem] max-h-[38rem] overflow-y-auto transition-colors ${
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
                    <div key={a.uid} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Exercise header */}
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/80 border-b border-gray-100">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-base shrink-0">
                          {ex.emoji || "🏋️"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 text-sm truncate">{ex.nombre}</p>
                          {ex.grupo_muscular && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{ex.grupo_muscular}</span>
                          )}
                        </div>
                        {/* Series + RIR + RPE */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Series */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 mb-0.5">Series</span>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={a.series}
                              onChange={(e) => updateSeries(a.uid, e.target.value)}
                              className="w-12 h-7 text-center border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary font-semibold"
                            />
                          </div>
                          {/* RIR */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 mb-0.5">RIR</span>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={a.rir}
                              onChange={(e) => updateExerciseField(a.uid, "rir", e.target.value)}
                              placeholder="—"
                              className="w-12 h-7 text-center border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary text-gray-500"
                            />
                          </div>
                          {/* RPE */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 mb-0.5">RPE</span>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              step="0.5"
                              value={a.rpe}
                              onChange={(e) => updateExerciseField(a.uid, "rpe", e.target.value)}
                              placeholder="—"
                              className="w-12 h-7 text-center border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary text-gray-500"
                            />
                          </div>
                          {/* Descanso */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 mb-0.5">Desc. (s)</span>
                            <input
                              type="number"
                              min="0"
                              step="5"
                              value={a.descanso}
                              onChange={(e) => updateExerciseField(a.uid, "descanso", e.target.value)}
                              placeholder="—"
                              className="w-14 h-7 text-center border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-orange-400 text-gray-500"
                            />
                          </div>
                          <button
                            onClick={() => removeExercise(a.uid)}
                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Series rows */}
                      <div className="divide-y divide-gray-50">
                        {/* Column labels */}
                        <div className="grid grid-cols-[32px_1fr_1fr] gap-2 px-3 py-1.5 bg-gray-50/40 items-center">
                          <span />
                          {/* Toggle Reps / Tiempo */}
                          <button
                            onClick={() => toggleTipoEsfuerzo(a.uid)}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors mx-auto ${
                              a.tipoEsfuerzo === "reps"
                                ? "bg-primary/10 text-primary"
                                : "bg-orange-100 text-orange-600"
                            }`}
                            title="Clic para cambiar entre Reps y Tiempo"
                          >
                            {a.tipoEsfuerzo === "reps" ? "Reps" : "Tiempo (seg)"}
                          </button>
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] text-gray-400 font-medium">Peso</span>
                            <div className="flex items-center bg-gray-100 rounded-md p-0.5">
                              {(["kg", "lbs"] as const).map((u) => (
                                <button
                                  key={u}
                                  onClick={() => updateExerciseUnit(a.uid, u)}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                                    a.unidadPeso === u ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
                                  }`}
                                >
                                  {u}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {a.seriesRows.map((row, si) => (
                          <div key={si} className="grid grid-cols-[32px_1fr_1fr] gap-2 items-center px-3 py-2">
                            <span className="text-xs font-bold text-gray-400">S{si + 1}</span>
                            <input
                              type={a.tipoEsfuerzo === "tiempo" ? "number" : "text"}
                              min={a.tipoEsfuerzo === "tiempo" ? "0" : undefined}
                              value={row.reps}
                              onChange={(e) => updateSerieRow(a.uid, si, "reps", e.target.value)}
                              placeholder={a.tipoEsfuerzo === "tiempo" ? "seg" : "—"}
                              className={`h-8 text-center border rounded-lg text-sm focus:outline-none w-full ${
                                a.tipoEsfuerzo === "tiempo"
                                  ? "border-orange-200 focus:border-orange-400"
                                  : "border-gray-200 focus:border-primary"
                              }`}
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={row.peso}
                              onChange={(e) => updateSerieRow(a.uid, si, "peso", e.target.value.replace(/^-/, ""))}
                              placeholder="—"
                              className="h-8 text-center border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary w-full"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Distribución muscular */}
        {!loadingRutina && !error && (() => {
          const muscleSeries: Record<string, { series: number; ejercicios: Set<string> }> = {};
          for (const day of DAYS) {
            for (const a of assigned[day]) {
              const ex = exercises.find((e) => e.id === a.exerciseId);
              if (!ex) continue;
              const s = parseInt(a.series) || 0;
              const groups = [ex.grupo_muscular, ...ex.grupos_secundarios].filter(Boolean) as string[];
              for (const g of groups) {
                if (!muscleSeries[g]) muscleSeries[g] = { series: 0, ejercicios: new Set() };
                muscleSeries[g].series += s;
                muscleSeries[g].ejercicios.add(ex.nombre);
              }
            }
          }
          const entries = Object.entries(muscleSeries).sort((a, b) => b[1].series - a[1].series);
          if (entries.length === 0) return null;
          const maxSeries = Math.max(...entries.map(([, v]) => v.series));
          const totalSeries = entries.reduce((acc, [, v]) => acc + v.series, 0);
          const totalEjercicios = new Set(Object.values(assigned).flat().map((a) => a.exerciseId)).size;

          return (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-gray-900 text-sm">📊 Distribución muscular semanal</p>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span><span className="font-bold text-gray-900">{totalEjercicios}</span> ejercicios</span>
                  <span><span className="font-bold text-gray-900">{totalSeries}</span> series totales</span>
                  <span><span className="font-bold text-gray-900">{entries.length}</span> músculos</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {entries.map(([muscle, data]) => {
                  const pct = (data.series / maxSeries) * 100;
                  return (
                    <div key={muscle} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-100">
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-gray-700 truncate">{muscle}</span>
                          <span className="text-xs font-bold text-primary shrink-0">{data.series} series</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                          {data.ejercicios.size} ej: {[...data.ejercicios].slice(0, 3).join(", ")}{data.ejercicios.size > 3 ? "..." : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
