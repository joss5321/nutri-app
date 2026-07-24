"use client";
import { useEffect, useState } from "react";
import EjercicioModal from "@/app/_components/ejercicios/EjercicioModal";
import { MUSCLE_GROUPS, type Exercise } from "@/app/_data/exercises";
import { deleteEjercicio, fetchEjercicios } from "@/app/_data/ejercicios";
import { fetchCurrentUserRol } from "@/app/_data/perfiles";
import { getYouTubeEmbedId, isYouTubeShort } from "@/app/_components/ejercicios/VideoPlayer";
import ConfirmModal from "@/app/_components/ConfirmModal";
import { supabase } from "@/lib/supabase";

export default function EjerciciosPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [grupo, setGrupo]         = useState("Todos");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]     = useState<Exercise | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRol, setCurrentRol] = useState<string | null>(null);

  const loadExercises = () => {
    fetchEjercicios()
      .then(setExercises)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los ejercicios."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExercises();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    fetchCurrentUserRol().then((rol) => setCurrentRol(rol));
  }, []);

  const load = () => {
    setLoading(true);
    setError(null);
    loadExercises();
  };

  const filtered = exercises.filter((e) => {
    const matchSearch = e.nombre.toLowerCase().includes(search.toLowerCase());
    const matchGrupo = grupo === "Todos" || e.grupo_muscular === grupo || e.grupos_secundarios.includes(grupo);
    return matchSearch && matchGrupo;
  });

  const handleSaved = (ex: Exercise) => {
    setExercises((prev) => {
      const exists = prev.some((e) => e.id === ex.id);
      return exists ? prev.map((e) => (e.id === ex.id ? ex : e)) : [ex, ...prev];
    });
  };

  const canEdit = (ex: Exercise): boolean => {
    if (!currentUserId || !currentRol) return false;
    if (currentRol === "superadmin") return ex.created_by === null || ex.created_by === currentUserId;
    return ex.created_by === currentUserId;
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deleteEjercicio(id);
      setExercises((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar el ejercicio.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ejercicios</h1>
          <p className="text-gray-500 text-sm mt-1">Crea y administra el catálogo de ejercicios disponibles para las rutinas.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          + Crear ejercicio
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 h-11 max-w-sm shadow-sm flex-1">
          <span className="text-gray-400">🔍</span>
          <input
            placeholder="Buscar ejercicio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm focus:outline-none text-gray-700"
          />
        </div>
        <select value={grupo} onChange={(e) => setGrupo(e.target.value)}
          className="h-11 border border-gray-200 rounded-xl px-3 text-sm bg-white shadow-sm focus:outline-none focus:border-primary">
          <option>Todos</option>
          {MUSCLE_GROUPS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={load} className="font-semibold hover:underline">Reintentar</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Cargando ejercicios...</p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">{filtered.length} ejercicio{filtered.length !== 1 ? "s" : ""} en el catálogo</p>

          {/* Grid de ejercicios */}
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((ex) => (
              <div
                key={ex.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-primary/50 transition-colors"
              >
                <div className={`bg-gray-900 rounded-xl flex items-center justify-center mb-3 overflow-hidden relative ${
                  ex.video_url && isYouTubeShort(ex.video_url) ? "h-48" : "h-32"
                }`}>
                  {ex.video_url ? (() => {
                    const ytId = getYouTubeEmbedId(ex.video_url);
                    if (ytId) {
                      const short = isYouTubeShort(ex.video_url);
                      return (
                        <>
                          <img
                            src={short
                              ? `https://img.youtube.com/vi/${ytId}/default.jpg`
                              : `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                            alt=""
                            className={short ? "h-full object-cover" : "w-full h-full object-cover"}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-white/80 text-3xl">▶</span>
                        </>
                      );
                    }
                    return <video src={ex.video_url} className="w-full h-full object-cover" muted />;
                  })() : (
                    <span className="text-3xl">{ex.emoji || "🎬"}</span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{ex.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{ex.descripcion || "Sin descripción"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {ex.grupo_muscular && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{ex.grupo_muscular}</span>
                  )}
                  {ex.grupos_secundarios.map((g) => (
                    <span key={g} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{g}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {canEdit(ex) ? (
                    <>
                      <button
                        onClick={() => setEditing(ex)}
                        className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                      >
                        ✏ Editar
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(ex.id)}
                        disabled={deletingId === ex.id}
                        className="h-9 px-3 rounded-xl border border-gray-200 text-red-500 text-sm font-semibold hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deletingId === ex.id ? "..." : "🗑"}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Solo lectura</span>
                  )}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400">
                <span className="text-4xl mb-2">🔍</span>
                <p className="text-sm">No se encontraron ejercicios.</p>
              </div>
            )}
          </div>
        </>
      )}

      {showCreate && (
        <EjercicioModal onSave={handleSaved} onClose={() => setShowCreate(false)} />
      )}
      {editing && (
        <EjercicioModal exercise={editing} onSave={handleSaved} onClose={() => setEditing(null)} />
      )}
      {confirmDeleteId && (
        <ConfirmModal
          title="Eliminar ejercicio"
          message="¿Estás seguro de que deseas eliminar este ejercicio del catálogo? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
