"use client";
import { useState } from "react";
import { MUSCLE_GROUPS, type Exercise } from "@/app/_data/exercises";
import { createEjercicio, deleteEjercicioVideo, updateEjercicio, uploadEjercicioVideo } from "@/app/_data/ejercicios";

export default function EjercicioModal({
  exercise,
  onSave,
  onClose,
}: {
  exercise?: Exercise;
  onSave: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const isEdit = !!exercise;

  const [nombre, setNombre]           = useState(exercise?.nombre ?? "");
  const [desc, setDesc]               = useState(exercise?.descripcion ?? "");
  const [muscPrinc, setMuscPrinc]     = useState(exercise?.grupo_muscular ?? MUSCLE_GROUPS[0]);
  const [muscSec, setMuscSec]         = useState<string[]>(exercise?.grupos_secundarios ?? []);
  const [videoUrl, setVideoUrl]       = useState(exercise?.video_url ?? "");
  const [videoFile, setVideoFile]     = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(exercise?.video_url ?? null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const toggleMuscSec = (m: string) =>
    setMuscSec((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  const handleFileChange = (f: File | undefined) => {
    if (!f) return;
    setVideoFile(f);
    setVideoUrl("");
    setVideoPreview(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    setError(null);

    try {
      let finalVideoUrl: string | null = videoUrl.trim() || null;
      let finalVideoStoragePath: string | null = exercise?.video_storage_path ?? null;

      if (videoFile) {
        const uploaded = await uploadEjercicioVideo(videoFile);
        finalVideoUrl = uploaded.url;
        finalVideoStoragePath = uploaded.path;
      } else if (finalVideoUrl !== (exercise?.video_url ?? null)) {
        // El video se cambió a una URL externa o se quitó: ya no referencia el archivo subido.
        finalVideoStoragePath = null;
      }

      const payload = {
        nombre: nombre.trim(),
        descripcion: desc.trim() || null,
        grupo_muscular: muscPrinc,
        grupos_secundarios: muscSec,
        video_url: finalVideoUrl,
        video_storage_path: finalVideoStoragePath,
      };

      const saved = isEdit
        ? await updateEjercicio(exercise!.id, payload)
        : await createEjercicio(payload);

      // Si se reemplazó un video propio por uno nuevo, limpiamos el archivo anterior.
      if (videoFile && exercise?.video_storage_path && exercise.video_storage_path !== finalVideoStoragePath) {
        deleteEjercicioVideo(exercise.video_storage_path).catch(() => {});
      }

      onSave(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el ejercicio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-xl">{isEdit ? "Editar ejercicio" : "Crear ejercicio"}</h2>
            <p className="text-gray-500 text-sm">Completa la información para {isEdit ? "actualizar" : "agregar"} el ejercicio al catálogo.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">×</button>
        </div>

        <div className="grid grid-cols-3 gap-6 p-6">
          {/* ── Columna izquierda ── */}
          <div className="col-span-2 flex flex-col gap-6">
            {/* 1. Información del ejercicio */}
            <section>
              <p className="text-sm font-bold text-gray-800 mb-3">1. Información del ejercicio</p>
              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1">Nombre del ejercicio *</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Press de banca"
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
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
                  ↑ {videoPreview ? "Cambiar video" : "Subir video"}
                  <input type="file" accept="video/*" className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0])} />
                </label>
              </div>
              <div className="mt-2">
                <input
                  value={videoFile ? "" : videoUrl}
                  disabled={!!videoFile}
                  placeholder="O pega aquí la URL de YouTube / Vimeo"
                  className="w-full h-9 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none focus:border-primary disabled:bg-gray-50 disabled:text-gray-400"
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onBlur={(e) => { if (e.target.value) setVideoPreview(e.target.value); }}
                />
              </div>
            </section>

            {/* 3. Grupo muscular */}
            <section>
              <p className="text-sm font-bold text-gray-800 mb-3">3. Grupo muscular involucrado</p>
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
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">{exercise?.emoji || "🏋️"}</div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{nombre || "Nombre del ejercicio"}</p>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{muscPrinc}</span>
                </div>
              </div>

              <div className="bg-gray-200 rounded-xl h-36 flex items-center justify-center mb-3 overflow-hidden">
                {videoPreview ? (
                  <video src={videoPreview} className="w-full h-full object-cover" muted />
                ) : (
                  <span className="text-gray-400 text-sm">Sin video</span>
                )}
              </div>

              {desc && (
                <>
                  <p className="text-xs font-bold text-gray-700 mb-1">Descripción</p>
                  <p className="text-xs text-gray-500 mb-3">{desc}</p>
                </>
              )}

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
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
              Cancelar
            </button>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
          <button onClick={handleSave} disabled={saving || !nombre.trim()}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-60">
            {saving ? "Guardando..." : `✓ ${isEdit ? "Guardar cambios" : "Guardar ejercicio"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
