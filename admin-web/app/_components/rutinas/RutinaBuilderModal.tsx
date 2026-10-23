"use client";
import { useEffect, useMemo, useState } from "react";
import { type Exercise } from "@/app/_data/exercises";
import { fetchEjercicios } from "@/app/_data/ejercicios";
import ConfirmModal from "@/app/_components/ConfirmModal";
import {
  DAYS,
  deleteRutina,
  fetchRutinaActiva,
  saveRutina,
  type RutinaInput,
} from "@/app/_data/rutinas";
import { exportRutinaPdf } from "@/app/_utils/exportRutinaPdf";
import { Search, Dumbbell, X, BarChart3, FileText, Trash2, Check } from "lucide-react";

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
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    fetchEjercicios()
      .then(setExercises)
      .catch(() => {})
      .finally(() => setLoadingExercises(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingRutina(true);
    setError(null);
    fetchRutinaActiva(patient.id)
      .then((rutina) => {
        if (cancelled) return;
        if (!rutina) { setLoadingRutina(false); return; }
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
        setLoadingRutina(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar la rutina.");
          setLoadingRutina(false);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  const retryLoadRutina = () => setRetryCount((c) => c + 1);

  const exerciseById = (id: string) => exercises.find((e) => e.id === id);

  // Músculos presentes en los ejercicios dados de alta (principal + secundarios),
  // en vez de una lista fija — así el filtro siempre cubre el catálogo real.
  const muscleGroups = useMemo(() => {
    const set = new Set<string>();
    for (const ex of exercises) {
      if (ex.grupo_muscular) set.add(ex.grupo_muscular);
      for (const g of ex.grupos_secundarios) if (g) set.add(g);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [exercises]);

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

  const stepSeries = (uid: string, delta: 1 | -1) => {
    setAssigned((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((a) => {
        if (a.uid !== uid) return a;
        const n = Math.min(20, Math.max(1, (parseInt(a.series) || 1) + delta));
        const cur = a.seriesRows;
        const last = cur[cur.length - 1] ?? { reps: "10", peso: "" };
        const newRows = n > cur.length
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
      // Los errores de Supabase (PostgrestError) no son instancias de Error
      // de JS, así que "err instanceof Error" nunca los detecta — sin esto,
      // el motivo real (RLS, constraint, etc.) queda oculto tras un mensaje
      // genérico que no ayuda a diagnosticar nada.
      const mensaje =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "No se pudo guardar la rutina.";
      setFeedback({ type: "error", text: mensaje });
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = () => {
    exportRutinaPdf({
      nombrePaciente: patient.name,
      nombreRutina: nombre,
      days: DAYS,
      assigned,
      exercises,
    });
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
        <div className="flex items-center justify-between p-6 border-b border-divider">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg">
              {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h2 className="font-bold text-text-primary text-xl">{nombre}</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-surface-muted flex items-center justify-center text-muted text-xl">×</button>
        </div>

        {loadingRutina ? (
          <div className="flex-1 flex items-center justify-center p-10 text-muted text-sm">Cargando rutina...</div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10">
            <p className="text-sm text-error">{error}</p>
            <button onClick={retryLoadRutina} className="text-sm font-semibold text-primary hover:underline">Reintentar</button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6 p-6 flex-1">
            {/* ── Catálogo de ejercicios ── */}
            <div className="col-span-1 flex flex-col gap-3">
              <p className="text-sm font-bold text-text-primary">Catálogo de ejercicios</p>
              <div className="flex items-center gap-2 bg-background-secondary border border-border rounded-xl px-3 h-10">
                <Search size={15} className="text-muted shrink-0" />
                <input
                  placeholder="Buscar ejercicio..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 text-sm bg-transparent focus:outline-none text-text-primary"
                />
              </div>
              <select value={grupo} onChange={(e) => setGrupo(e.target.value)}
                className="h-10 border border-border rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary">
                <option>Todos</option>
                {muscleGroups.map((m) => <option key={m}>{m}</option>)}
              </select>

              <div className="flex flex-col gap-2 overflow-y-auto max-h-[32rem] pr-1">
                {loadingExercises && (
                  <p className="text-xs text-muted text-center py-6">Cargando catálogo...</p>
                )}
                {!loadingExercises && catalog.map((ex) => (
                  <div
                    key={ex.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", ex.id)}
                    onClick={() => addExercise(ex.id)}
                    className="flex items-center gap-2 bg-background-secondary border border-border rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                    title="Arrastra o haz clic para agregar al día seleccionado"
                  >
                    <span className="text-muted text-xs">⠿</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">{ex.nombre}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {ex.grupo_muscular && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{ex.grupo_muscular}</span>
                        )}
                        {ex.grupos_secundarios.map((g) => (
                          <span key={g} className="text-xs bg-surface-muted text-secondary px-2 py-0.5 rounded-full">{g}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {!loadingExercises && catalog.length === 0 && (
                  <p className="text-xs text-muted text-center py-6">No se encontraron ejercicios.</p>
                )}
              </div>
            </div>

            {/* ── Rutina por día ── */}
            <div className="col-span-2 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-text-primary">
                  Rutina semanal · {totalAsignados} ejercicio{totalAsignados !== 1 ? "s" : ""} asignados
                </p>
                {/* Unidad por defecto para nuevos ejercicios */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">Unidad por defecto:</span>
                  <div className="flex items-center bg-surface-muted rounded-xl p-0.5">
                    {(["kg", "lbs"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => setPesoUnidad(u)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          pesoUnidad === u ? "bg-white text-text-primary shadow-sm" : "text-muted hover:text-secondary"
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
                      activeDay === d ? "bg-primary text-white" : "bg-surface-muted text-secondary hover:bg-surface-muted"
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
                className={`series-scroll h-[36rem] rounded-xl border-2 border-dashed p-3 flex flex-col gap-3 overflow-y-auto transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                {assigned[activeDay].length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted gap-1">
                    <Dumbbell size={28} />
                    <p className="text-sm">Arrastra ejercicios aquí para {activeDay}</p>
                  </div>
                )}

                {assigned[activeDay].map((a) => {
                  const ex = exerciseById(a.exerciseId);
                  if (!ex) return null;
                  return (
                    <div key={a.uid} className="shrink-0 bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                      {/* Exercise header */}
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-background-secondary/80 border-b border-divider">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-base shrink-0">
                          {ex.emoji || "🏋️"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-text-primary text-sm truncate">{ex.nombre}</p>
                          {ex.grupo_muscular && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{ex.grupo_muscular}</span>
                          )}
                        </div>
                        {/* Series + RIR + RPE */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Series */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-muted mb-0.5">Series</span>
                            <div className="flex items-center">
                              <button type="button" onClick={() => stepSeries(a.uid, -1)}
                                className="w-6 h-7 flex items-center justify-center border border-border rounded-l-lg text-xs text-secondary hover:bg-background-secondary active:bg-surface-muted select-none">−</button>
                              <span className="w-7 h-7 flex items-center justify-center border-t border-b border-border text-xs font-semibold text-text-primary select-none">{a.series}</span>
                              <button type="button" onClick={() => stepSeries(a.uid, 1)}
                                className="w-6 h-7 flex items-center justify-center border border-border rounded-r-lg text-xs text-secondary hover:bg-background-secondary active:bg-surface-muted select-none">+</button>
                            </div>
                          </div>
                          {/* RIR */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-muted mb-0.5">RIR</span>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={a.rir}
                              onChange={(e) => updateExerciseField(a.uid, "rir", e.target.value)}
                              placeholder="—"
                              className="w-12 h-7 text-center border border-border rounded-lg text-xs focus:outline-none focus:border-primary text-secondary"
                            />
                          </div>
                          {/* RPE */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-muted mb-0.5">RPE</span>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              step="0.5"
                              value={a.rpe}
                              onChange={(e) => updateExerciseField(a.uid, "rpe", e.target.value)}
                              placeholder="—"
                              className="w-12 h-7 text-center border border-border rounded-lg text-xs focus:outline-none focus:border-primary text-secondary"
                            />
                          </div>
                          {/* Descanso */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-muted mb-0.5">Desc. (s)</span>
                            <input
                              type="number"
                              min="0"
                              step="5"
                              value={a.descanso}
                              onChange={(e) => updateExerciseField(a.uid, "descanso", e.target.value)}
                              placeholder="—"
                              className="w-14 h-7 text-center border border-border rounded-lg text-xs focus:outline-none focus:border-orange-400 text-secondary"
                            />
                          </div>
                          <button
                            onClick={() => removeExercise(a.uid)}
                            className="w-7 h-7 flex items-center justify-center text-muted hover:text-error hover:bg-error-soft rounded-lg transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Series rows */}
                      <div className="divide-y divide-divider">
                        {/* Column labels */}
                        <div className="grid grid-cols-[32px_1fr_1fr] gap-2 px-3 py-1.5 bg-background-secondary/40 items-center">
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
                            <span className="text-[10px] text-muted font-medium">Peso</span>
                            <div className="flex items-center bg-surface-muted rounded-md p-0.5">
                              {(["kg", "lbs"] as const).map((u) => (
                                <button
                                  key={u}
                                  onClick={() => updateExerciseUnit(a.uid, u)}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                                    a.unidadPeso === u ? "bg-white text-text-primary shadow-sm" : "text-muted"
                                  }`}
                                >
                                  {u}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Scrollable rows */}
                        <div
                          className="series-scroll divide-y divide-divider overflow-y-auto max-h-44"
                          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0,0,0,0.08) transparent" }}
                        >
                          {a.seriesRows.map((row, si) => (
                            <div key={si} className="grid grid-cols-[32px_1fr_1fr] gap-2 items-center px-3 py-2">
                              <span className="text-xs font-bold text-muted">S{si + 1}</span>
                              <input
                                type={a.tipoEsfuerzo === "tiempo" ? "number" : "text"}
                                min={a.tipoEsfuerzo === "tiempo" ? "0" : undefined}
                                value={row.reps}
                                onChange={(e) => updateSerieRow(a.uid, si, "reps", e.target.value)}
                                placeholder={a.tipoEsfuerzo === "tiempo" ? "seg" : "—"}
                                className={`h-8 text-center border rounded-lg text-sm focus:outline-none w-full ${
                                  a.tipoEsfuerzo === "tiempo"
                                    ? "border-orange-200 focus:border-orange-400"
                                    : "border-border focus:border-primary"
                                }`}
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={row.peso}
                                onChange={(e) => updateSerieRow(a.uid, si, "peso", e.target.value.replace(/^-/, ""))}
                                placeholder="—"
                                className="h-8 text-center border border-border rounded-lg text-sm focus:outline-none focus:border-primary w-full"
                              />
                            </div>
                          ))}
                        </div>
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
            <div className="px-6 py-4 border-t border-divider bg-background-secondary/50">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-text-primary text-sm flex items-center gap-1.5"><BarChart3 size={14} className="text-primary" /> Distribución muscular semanal</p>
                <div className="flex gap-3 text-xs text-secondary">
                  <span><span className="font-bold text-text-primary">{totalEjercicios}</span> ejercicios</span>
                  <span><span className="font-bold text-text-primary">{totalSeries}</span> series totales</span>
                  <span><span className="font-bold text-text-primary">{entries.length}</span> músculos</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {entries.map(([muscle, data]) => {
                  const pct = (data.series / maxSeries) * 100;
                  return (
                    <div key={muscle} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-divider">
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-text-primary truncate">{muscle}</span>
                          <span className="text-xs font-bold text-primary shrink-0">{data.series} series</span>
                        </div>
                        <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted mt-0.5 truncate">
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-divider">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 h-10 rounded-xl border border-border text-secondary text-sm hover:bg-background-secondary">
              Cancelar
            </button>
            <button
              onClick={handleExportPdf}
              disabled={loadingRutina || !!error}
              className="flex items-center gap-2 px-5 h-10 rounded-xl border border-border text-secondary text-sm font-semibold hover:bg-background-secondary disabled:opacity-50"
            >
              <FileText size={15} /> Exportar PDF
            </button>
            {rutinaId && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting || saving}
                className="flex items-center gap-2 px-5 h-10 rounded-xl border border-error/30 text-error text-sm font-semibold hover:bg-error-soft disabled:opacity-50"
              >
                {!deleting && <Trash2 size={14} />}
                {deleting ? "Eliminando..." : "Eliminar rutina"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {feedback && (
              <span className={`text-xs font-medium ${feedback.type === "success" ? "text-success" : "text-error"}`}>
                {feedback.text}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || deleting || loadingRutina}
              className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
            >
              {!saving && <Check size={15} />}
              {saving ? "Guardando..." : "Guardar rutina"}
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
