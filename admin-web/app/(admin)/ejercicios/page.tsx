"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import EjercicioModal from "@/app/_components/ejercicios/EjercicioModal";
import EjercicioDetalleModal from "@/app/_components/ejercicios/EjercicioDetalleModal";
import { type Exercise, type EjerciciosFiltros } from "@/app/_data/exercises";
import {
  deleteEjercicio,
  fetchEjerciciosCatalogo,
  fetchEjercicioFilterValues,
  fetchMuscleFilterOptions,
} from "@/app/_data/ejercicios";
import { fetchCurrentUserRol } from "@/app/_data/perfiles";
import { getYouTubeEmbedId, isYouTubeShort } from "@/app/_components/ejercicios/VideoPlayer";
import ConfirmModal from "@/app/_components/ConfirmModal";
import { supabase } from "@/lib/supabase";
import {
  tx,
  MUSCLE_ES,
  DIFFICULTY_ES,
  BODY_PART_ES,
  EQUIPMENT_ES,
  CATEGORY_ES,
} from "@/app/_data/workoutx-i18n";
import { proxyGifUrl } from "@/app/_data/gif-proxy";
import { Search, Eye, Pencil, Trash2 } from "lucide-react";

const PAGE_SIZE = 24;

type FilterOptions = {
  muscles:     string[];
  bodyParts:   string[];
  equipments:  string[];
  difficulties: string[];
  categories:  string[];
};

export default function EjerciciosPage() {
  // ── Datos ──────────────────────────────────────────────────────────────
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // ── Filtros ────────────────────────────────────────────────────────────
  const [search,     setSearch]     = useState("");
  const [grupo,      setGrupo]      = useState("");
  const [bodyPart,   setBodyPart]   = useState("");
  const [equipment,  setEquipment]  = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [category,   setCategory]   = useState("");
  const [source,     setSource]     = useState<"todos" | "manual" | "workoutx">("todos");
  const [page,       setPage]       = useState(1);

  // ── Opciones de filtros (valores únicos de la BD) ──────────────────────
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({
    muscles: [], bodyParts: [], equipments: [], difficulties: [], categories: [],
  });

  // ── UI ─────────────────────────────────────────────────────────────────
  const [showCreate,      setShowCreate]      = useState(false);
  const [editing,         setEditing]         = useState<Exercise | null>(null);
  const [viewing,         setViewing]         = useState<Exercise | null>(null);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [currentUserId,   setCurrentUserId]   = useState<string | null>(null);
  const [currentRol,      setCurrentRol]      = useState<string | null>(null);

  // Debounce para búsqueda por nombre
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ── Carga de ejercicios ────────────────────────────────────────────────
  const loadExercises = useCallback(
    (overridePage?: number) => {
      setLoading(true);
      setError(null);

      const filtros: EjerciciosFiltros = {
        search: debouncedSearch,
        grupo,
        bodyPart,
        equipment,
        difficulty,
        category,
        source,
        page: overridePage ?? page,
        pageSize: PAGE_SIZE,
      };

      fetchEjerciciosCatalogo(filtros)
        .then(({ data, total: t }) => {
          setExercises(data);
          setTotal(t);
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : "No se pudieron cargar los ejercicios.")
        )
        .finally(() => setLoading(false));
    },
    [debouncedSearch, grupo, bodyPart, equipment, difficulty, category, source, page],
  );

  // Cargar ejercicios cuando cambien filtros o página
  useEffect(() => { loadExercises(); }, [loadExercises]);

  // Cargar opciones de filtros y usuario una sola vez
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    fetchCurrentUserRol().then((rol) => setCurrentRol(rol));

    Promise.all([
      fetchMuscleFilterOptions(),
      fetchEjercicioFilterValues("body_part"),
      fetchEjercicioFilterValues("equipment"),
      fetchEjercicioFilterValues("difficulty"),
      fetchEjercicioFilterValues("category"),
    ]).then(([muscles, bodyParts, equipments, difficulties, categories]) => {
      setFilterOpts({ muscles, bodyParts, equipments, difficulties, categories });
    }).catch(() => {});
  }, []);

  // ── Debounce del campo de búsqueda ────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 350);
  };

  // Resetear página cuando cambia cualquier filtro (excepto página misma)
  const applyFilter = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  // ── Permisos de edición ────────────────────────────────────────────────
  const canEdit = (ex: Exercise): boolean => {
    if (!currentUserId || !currentRol) return false;
    // Ejercicios WorkoutX: nadie puede editarlos desde el frontend
    if (ex.source === "workoutx") return false;
    if (currentRol === "superadmin") return ex.created_by === null || ex.created_by === currentUserId;
    return ex.created_by === currentUserId;
  };

  // ── Guardado / eliminación ─────────────────────────────────────────────
  const handleSaved = (ex: Exercise) => {
    setExercises((prev) => {
      const exists = prev.some((e) => e.id === ex.id);
      return exists ? prev.map((e) => (e.id === ex.id ? ex : e)) : [ex, ...prev];
    });
    setTotal((t) => t + 1);
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deleteEjercicio(id);
      setExercises((prev) => prev.filter((e) => e.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar el ejercicio.");
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ejercicios</h1>
          <p className="text-gray-500 text-sm mt-1">
            Catálogo de ejercicios disponibles para las rutinas.
            {total > 0 && (
              <span className="ml-2 text-xs text-gray-400">
                {total.toLocaleString()} ejercicio{total !== 1 ? "s" : ""} en total
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          + Crear ejercicio
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5 shadow-sm space-y-3">
        {/* Fila 1: búsqueda + origen */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 border border-gray-200 rounded-xl px-3 h-10">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="flex-1 text-sm focus:outline-none text-gray-700"
            />
          </div>
          <FilterSelect
            value={source}
            onChange={(v) => { setSource(v as typeof source); setPage(1); }}
            placeholder="Origen"
          >
            <option value="todos">Todos los orígenes</option>
            <option value="manual">Manuales</option>
            <option value="workoutx">WorkoutX</option>
          </FilterSelect>
        </div>

        {/* Fila 2: filtros de músculo y WorkoutX */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <FilterSelect value={grupo} onChange={applyFilter(setGrupo)} placeholder="Músculo">
            <option value="">Músculo (todos)</option>
            {filterOpts.muscles.map((m) => (
              <option key={m} value={m}>{tx(MUSCLE_ES, m)}</option>
            ))}
          </FilterSelect>

          <FilterSelect value={bodyPart} onChange={applyFilter(setBodyPart)} placeholder="Parte del cuerpo">
            <option value="">Parte del cuerpo</option>
            {filterOpts.bodyParts.map((v) => (
              <option key={v} value={v}>{tx(BODY_PART_ES, v)}</option>
            ))}
          </FilterSelect>

          <FilterSelect value={equipment} onChange={applyFilter(setEquipment)} placeholder="Equipo">
            <option value="">Equipamiento</option>
            {filterOpts.equipments.map((v) => (
              <option key={v} value={v}>{tx(EQUIPMENT_ES, v)}</option>
            ))}
          </FilterSelect>

          <FilterSelect value={difficulty} onChange={applyFilter(setDifficulty)} placeholder="Dificultad">
            <option value="">Dificultad</option>
            {filterOpts.difficulties.map((v) => (
              <option key={v} value={v}>{tx(DIFFICULTY_ES, v)}</option>
            ))}
          </FilterSelect>

          <FilterSelect value={category} onChange={applyFilter(setCategory)} placeholder="Categoría">
            <option value="">Categoría</option>
            {filterOpts.categories.map((v) => (
              <option key={v} value={v}>{tx(CATEGORY_ES, v)}</option>
            ))}
          </FilterSelect>
        </div>

        {/* Limpiar filtros */}
        {(search || grupo || bodyPart || equipment || difficulty || category || source !== "todos") && (
          <button
            onClick={() => {
              setSearch(""); setDebouncedSearch(""); setGrupo(""); setBodyPart("");
              setEquipment(""); setDifficulty(""); setCategory(""); setSource("todos");
              setPage(1);
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={() => loadExercises()} className="font-semibold hover:underline ml-4">
            Reintentar
          </button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Cargando ejercicios...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {exercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                canEdit={canEdit(ex)}
                deleting={deletingId === ex.id}
                onView={() => setViewing(ex)}
                onEdit={() => setEditing(ex)}
                onDelete={() => setConfirmDeleteId(ex.id)}
              />
            ))}

            {exercises.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <div className="w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center mb-3">
                  <Search size={24} className="text-primary" />
                </div>
                <p className="text-sm">No se encontraron ejercicios con estos filtros.</p>
              </div>
            )}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <PaginationBtn disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ← Anterior
              </PaginationBtn>
              <span className="text-sm text-gray-500">
                Página {page} de {totalPages}
              </span>
              <PaginationBtn disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Siguiente →
              </PaginationBtn>
            </div>
          )}
        </>
      )}

      {/* Modales */}
      {showCreate && (
        <EjercicioModal onSave={handleSaved} onClose={() => setShowCreate(false)} />
      )}
      {editing && (
        <EjercicioModal exercise={editing} onSave={handleSaved} onClose={() => setEditing(null)} />
      )}
      {viewing && (
        <EjercicioDetalleModal exercise={viewing} onClose={() => setViewing(null)} />
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

// ── Tarjeta de ejercicio ──────────────────────────────────────────────────

function ExerciseCard({
  exercise: ex,
  canEdit,
  deleting,
  onView,
  onEdit,
  onDelete,
}: {
  exercise: Exercise;
  canEdit: boolean;
  deleting: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isWorkoutX = ex.source === "workoutx";

  // Prioridad visual: GIF > video > emoji
  const media = (() => {
    const proxiedGif = proxyGifUrl(ex.gif_url);
    if (proxiedGif) {
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={proxiedGif}
          alt={ex.nombre}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      );
    }
    if (ex.video_url) {
      const ytId = getYouTubeEmbedId(ex.video_url);
      if (ytId) {
        const short = isYouTubeShort(ex.video_url);
        return (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                short
                  ? `https://img.youtube.com/vi/${ytId}/default.jpg`
                  : `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
              }
              alt=""
              className={short ? "h-full object-cover" : "w-full h-full object-cover"}
            />
            <span className="absolute inset-0 flex items-center justify-center text-white/80 text-3xl">
              ▶
            </span>
          </>
        );
      }
      return <video src={ex.video_url} className="w-full h-full object-cover" muted />;
    }
    return <span className="text-3xl">{ex.emoji || "💪"}</span>;
  })();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-primary/50 transition-colors flex flex-col">
      {/* Imagen */}
      <div
        className="bg-gray-900 rounded-xl flex items-center justify-center mb-3 overflow-hidden relative h-36 cursor-pointer"
        onClick={onView}
      >
        {media}
        {/* Badge WorkoutX */}
        {isWorkoutX && (
          <span className="absolute top-2 right-2 text-xs bg-violet-600 text-white font-bold px-2 py-0.5 rounded-full">
            WorkoutX
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1">
        <p
          className="font-bold text-gray-900 text-sm truncate cursor-pointer hover:text-primary"
          onClick={onView}
        >
          {ex.nombre}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
          {ex.descripcion || "Sin descripción"}
        </p>
      </div>

      {/* Músculo tags */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {ex.grupo_muscular && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            {tx(MUSCLE_ES, ex.grupo_muscular)}
          </span>
        )}
        {ex.difficulty && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
            {tx(DIFFICULTY_ES, ex.difficulty)}
          </span>
        )}
        {ex.grupos_secundarios?.slice(0, 2).map((g) => (
          <span key={g} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {tx(MUSCLE_ES, g)}
          </span>
        ))}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <Eye size={14} /> Ver
        </button>
        {canEdit ? (
          <>
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <Pencil size={13} /> Editar
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="h-9 px-3 rounded-xl border border-gray-200 text-red-500 text-sm font-semibold hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {deleting ? "..." : <Trash2 size={14} />}
            </button>
          </>
        ) : (
          <span className="text-xs text-gray-400 italic">
            {isWorkoutX ? "WorkoutX" : "Solo lectura"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Átomos de UI ──────────────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-primary w-full"
    >
      {children}
    </select>
  );
}

function PaginationBtn({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="px-4 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
