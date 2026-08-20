"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import RecetaModal from "@/app/_components/recetas/RecetaModal";
import VincularIngredientesModal from "@/app/_components/recetas/VincularIngredientesModal";
import ConfirmModal from "@/app/_components/ConfirmModal";
import {
  TIPOS_RECETA,
  calcularMacrosDesdeIngredientes,
  deleteReceta,
  duplicateReceta,
  fetchRecetasPaginated,
  fetchTodasRecetasCatalogo,
  updateRecetaMacros,
  type Receta,
} from "@/app/_data/recetas";
import { fetchAlimentos } from "@/app/_data/alimentos";
import { fetchCurrentUserRol } from "@/app/_data/perfiles";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 20;

// ── Pagination control ───────────────────────────────────────────────────────
function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-8">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="h-9 px-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Anterior
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-1 text-gray-400 text-sm select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`h-9 w-9 rounded-xl text-sm font-semibold border transition-colors ${
              p === page
                ? "bg-primary text-white border-primary"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="h-9 px-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Siguiente →
      </button>
    </div>
  );
}

// ── Recipe detail panel ──────────────────────────────────────────────────────
function RecipeDetail({
  receta,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  duplicating,
  deleting,
  canEdit,
}: {
  receta: Receta;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  duplicating: boolean;
  deleting: boolean;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"ing" | "prep" | "info">("ing");

  return (
    <div className="w-96 shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base leading-snug">{receta.nombre}</p>
          {receta.tipo && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium inline-block mt-1">
              {receta.tipo}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 text-lg"
        >
          ×
        </button>
      </div>

      {/* Hero */}
      <div className="h-40 bg-primary/5 flex items-center justify-center text-6xl shrink-0">
        {receta.emoji || "🍽️"}
      </div>

      {/* Quick info */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 text-xs text-gray-500">
        <span>⏱ {receta.tiempo_min ?? "—"} min</span>
        <span>📊 {receta.nivel ?? "—"}</span>
        <span>🔥 {receta.calorias ?? "—"} kcal</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-100">
        {canEdit && (
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
          >
            ✏️ Editar
          </button>
        )}
        <button
          onClick={onDuplicate}
          disabled={duplicating}
          className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          📋 {duplicating ? "Duplicando..." : "Duplicar"}
        </button>
        {canEdit && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
          >
            🗑 {deleting ? "Eliminando..." : "Eliminar"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-4">
        {(
          [
            ["ing", "Ingredientes"],
            ["prep", "Preparación"],
            ["info", "Info nutricional"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`py-3 px-2 text-xs font-semibold border-b-2 transition-colors ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 flex-1">
        {tab === "ing" && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-3">
              Ingredientes{receta.porciones ? ` (${receta.porciones})` : ""}
            </p>
            {receta.ingredientes.length > 0 ? (
              <div className="flex flex-col gap-2">
                {receta.ingredientes.map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0"
                  >
                    <input type="checkbox" className="accent-primary" />
                    <span className="text-sm text-gray-700">{ing.descripcion}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin ingredientes registrados.</p>
            )}
          </div>
        )}

        {tab === "prep" && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-3">Pasos de preparación</p>
            {receta.pasos.length > 0 ? (
              <div className="flex flex-col gap-3">
                {receta.pasos.map((paso) => (
                  <div key={paso.id} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                      {paso.numero}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{paso.descripcion}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin pasos registrados.</p>
            )}
          </div>
        )}

        {tab === "info" && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">Macronutrientes (por porción)</p>
              {[
                { label: "Proteínas",     value: receta.proteinas_g ?? 0,     unit: "g", color: "bg-primary"    },
                { label: "Carbohidratos", value: receta.carbohidratos_g ?? 0, unit: "g", color: "bg-blue-400"   },
                { label: "Grasas",        value: receta.grasas_g ?? 0,        unit: "g", color: "bg-yellow-400" },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${m.color} shrink-0`} />
                  <span className="text-sm text-gray-700 flex-1">{m.label}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {m.value}
                    {m.unit}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-bold text-gray-700 mb-2">Información adicional</p>
              {[
                { label: "Dificultad",            value: receta.nivel ?? "—" },
                { label: "Tiempo de preparación", value: receta.tiempo_prep_min != null ? `${receta.tiempo_prep_min} min` : "—" },
                { label: "Tiempo de cocción",     value: receta.tiempo_coccion_min != null ? `${receta.tiempo_coccion_min} min` : "—" },
                { label: "Tipo de comida",        value: receta.tipo ?? "—" },
                { label: "Categoría",             value: receta.categoria_nutricional ?? "—" },
              ].map((r) => (
                <div
                  key={r.label}
                  className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0"
                >
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-medium text-gray-800">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function RecetasPage() {
  const [recetas, setRecetas]       = useState<Receta[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [search, setSearch]               = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tipo, setTipo]                   = useState("Todas");
  const [page, setPage]                   = useState(1);

  const [selected, setSelected]           = useState<Receta | null>(null);
  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<Receta | null>(null);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRol, setCurrentRol]       = useState<string | null>(null);

  const [recalculando, setRecalculando]   = useState(false);
  const [recalcResumen, setRecalcResumen] = useState<string | null>(null);
  const [showVincular, setShowVincular]   = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeFrom  = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo    = Math.min(page * PAGE_SIZE, totalCount);

  // Refs so mutation handlers always read current filter state
  const pageRef   = useRef(page);
  const searchRef = useRef(debouncedSearch);
  const tipoRef   = useRef(tipo);
  useEffect(() => { pageRef.current   = page;           }, [page]);
  useEffect(() => { searchRef.current = debouncedSearch; }, [debouncedSearch]);
  useEffect(() => { tipoRef.current   = tipo;           }, [tipo]);

  // ── Core load ──────────────────────────────────────────────────────────────
  const loadPage = useCallback(async (p: number, q: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRecetasPaginated({ page: p, pageSize: PAGE_SIZE, search: q, tipo: t });
      setRecetas(result.data);
      setTotalCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las recetas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    loadPage(pageRef.current, searchRef.current, tipoRef.current);
  }, [loadPage]);

  // Debounce search → reset to page 1 when query changes
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load data whenever page, debounced search, or tipo changes
  useEffect(() => {
    loadPage(page, debouncedSearch, tipo);
  }, [page, debouncedSearch, tipo, loadPage]);

  // Clear detail panel when filters change (not on page change)
  useEffect(() => {
    setSelected(null);
  }, [debouncedSearch, tipo]);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    fetchCurrentUserRol().then((rol) => setCurrentRol(rol));
  }, []);

  // ── Permissions ────────────────────────────────────────────────────────────
  const canEdit = (r: Receta): boolean => {
    if (!currentUserId || !currentRol) return false;
    if (currentRol === "superadmin") return true;
    return r.created_by === currentUserId;
  };

  // ── Filter handlers ────────────────────────────────────────────────────────
  const handleTipoChange = (value: string) => {
    setTipo(value);
    setPage(1);
  };

  // ── Mutation handlers ──────────────────────────────────────────────────────
  const handleSaved = (receta: Receta) => {
    const isEdit = recetas.some((r) => r.id === receta.id);
    setSelected((prev) => (prev?.id === receta.id ? receta : prev));
    if (isEdit) {
      reload();
    } else {
      // New recipe lands at the top (ordered by created_at DESC) → go to page 1
      if (page !== 1) {
        setPage(1);
      } else {
        loadPage(1, debouncedSearch, tipo);
      }
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deleteReceta(id);
      setSelected((prev) => (prev?.id === id ? null : prev));
      // If this was the last card on a page > 1, go back one page
      if (recetas.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        reload();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar la receta.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (receta: Receta) => {
    setDuplicatingId(receta.id);
    try {
      const copia = await duplicateReceta(receta);
      setSelected(copia);
      // Duplicate has the newest created_at → appears first on page 1
      if (page !== 1) {
        setPage(1);
      } else {
        loadPage(1, debouncedSearch, tipo);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo duplicar la receta.");
    } finally {
      setDuplicatingId(null);
    }
  };

  // Recalcula calorías/macros para todas las recetas del catálogo cuyos
  // ingredientes están ligados al catálogo de alimentos (alimento_id). Útil
  // para recetas cargadas por fuera del formulario (ej. importadas por SQL)
  // que se guardaron con calorías vacías.
  const handleRecalcularCalorias = async () => {
    if (!confirm(
      "Esto recalculará calorías y macronutrientes de todas las recetas del catálogo que tengan ingredientes ligados al catálogo de alimentos, sobrescribiendo los valores actuales. ¿Continuar?"
    )) return;

    setRecalculando(true);
    setRecalcResumen(null);
    try {
      const [todasRecetas, alimentos] = await Promise.all([fetchTodasRecetasCatalogo(), fetchAlimentos()]);
      const alimentosById = Object.fromEntries(alimentos.map((a) => [a.id, a]));

      let actualizadas = 0, sinCambios = 0, sinIngredientesLigados = 0, errores = 0;
      for (const r of todasRecetas) {
        const macros = calcularMacrosDesdeIngredientes(r.ingredientes, alimentosById);
        if (!macros) { sinIngredientesLigados++; continue; }
        const sinCambio = r.calorias === macros.calorias
          && r.proteinas_g === macros.proteinas_g
          && r.carbohidratos_g === macros.carbohidratos_g
          && r.grasas_g === macros.grasas_g;
        if (sinCambio) { sinCambios++; continue; }
        try {
          await updateRecetaMacros(r.id, macros);
          actualizadas++;
        } catch {
          errores++;
        }
      }

      setRecalcResumen(
        `✅ ${actualizadas} receta(s) actualizada(s) · ${sinCambios} ya estaban correctas · ${sinIngredientesLigados} sin ingredientes ligados al catálogo` +
        (errores > 0 ? ` · ${errores} con error (revisa permisos)` : "")
      );
      reload();
    } catch (err) {
      setRecalcResumen(`❌ ${err instanceof Error ? err.message : "No se pudo recalcular."}`);
    } finally {
      setRecalculando(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
            <p className="text-gray-500 text-sm mt-1">
              Gestiona y crea recetas saludables para tus planes nutricionales.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {currentRol === "superadmin" && (
              <button
                onClick={() => setShowVincular(true)}
                title="Liga los ingredientes de las recetas al catálogo de alimentos para poder calcular sus calorías"
                className="flex items-center gap-2 h-10 px-4 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                🔗 Vincular ingredientes
              </button>
            )}
            {currentRol === "superadmin" && (
              <button
                onClick={handleRecalcularCalorias}
                disabled={recalculando}
                title="Recalcula calorías y macros de las recetas cuyos ingredientes están ligados al catálogo de alimentos"
                className="flex items-center gap-2 h-10 px-4 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {recalculando ? "Recalculando..." : "🔄 Recalcular calorías"}
              </button>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
            >
              + Nueva receta
            </button>
          </div>
        </div>

        {recalcResumen && (
          <div className="mb-4 flex items-center justify-between bg-primary/5 border border-primary/20 text-gray-700 text-sm rounded-xl px-4 py-3">
            <span>{recalcResumen}</span>
            <button onClick={() => setRecalcResumen(null)} className="text-gray-400 hover:text-gray-600 shrink-0 ml-3">×</button>
          </div>
        )}

        {/* Filters — Categoría and Dificultad removed; search + tipo remain */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div>
            <label className="text-xs text-gray-400 font-medium mb-0.5 ml-1 block">&nbsp;</label>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 h-10 shadow-sm">
              <span className="text-gray-400 text-sm">🔍</span>
              <input
                placeholder="Buscar recetas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-40 text-sm focus:outline-none text-gray-700"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium mb-0.5 ml-1 block">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => handleTipoChange(e.target.value)}
              className="h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary bg-white shadow-sm"
            >
              {["Todas", ...TIPOS_RECETA].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            <span>{error}</span>
            <button onClick={reload} className="font-semibold hover:underline">
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 py-10 text-center">Cargando recetas...</p>
        ) : (
          <>
            {/* Counter */}
            <p className="text-sm text-gray-500 mb-4">
              {totalCount > 0 ? (
                <>
                  Mostrando{" "}
                  <span className="font-semibold text-gray-900">
                    {rangeFrom}–{rangeTo}
                  </span>{" "}
                  de{" "}
                  <span className="font-semibold text-gray-900">{totalCount}</span>{" "}
                  recetas
                </>
              ) : (
                <>
                  <span className="font-semibold text-gray-900">0</span> recetas encontradas
                </>
              )}
            </p>

            {/* Grid */}
            <div className="grid grid-cols-3 gap-5">
              {recetas.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelected(r.id === selected?.id ? null : r)}
                  className={`bg-white rounded-2xl border overflow-hidden cursor-pointer hover:shadow-md transition-all ${
                    selected?.id === r.id ? "border-primary shadow-md" : "border-gray-200"
                  }`}
                >
                  <div className="relative h-40 bg-primary/5 flex items-center justify-center">
                    <span className="text-5xl">{r.emoji || "🍽️"}</span>
                    {r.tipo && (
                      <span className="absolute top-2 left-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full font-semibold">
                        {r.tipo}
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <p className="font-semibold text-gray-900 text-sm leading-snug mb-2">
                      {r.nombre}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span>⏱ {r.tiempo_min ?? "—"} min</span>
                      <span>📊 {r.nivel ?? "—"}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{r.calorias ?? "—"} kcal</p>
                    {r.categoria_nutricional && (
                      <span className="mt-2 inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {r.categoria_nutricional}
                      </span>
                    )}

                    <div
                      className="flex items-center gap-2 mt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canEdit(r) && (
                        <button
                          onClick={() => setEditing(r)}
                          className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                        >
                          ✏ Editar
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicate(r)}
                        disabled={duplicatingId === r.id}
                        className="h-9 px-3 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {duplicatingId === r.id ? "..." : "📋"}
                      </button>
                      {canEdit(r) && (
                        <button
                          onClick={() => setConfirmDeleteId(r.id)}
                          disabled={deletingId === r.id}
                          className="h-9 px-3 rounded-xl border border-gray-200 text-red-500 text-xs font-semibold hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {deletingId === r.id ? "..." : "🗑"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {recetas.length === 0 && (
                <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400">
                  <span className="text-4xl mb-2">🔍</span>
                  <p className="text-sm">No se encontraron recetas.</p>
                </div>
              )}
            </div>

            {/* Pagination controls */}
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <RecipeDetail
          receta={selected}
          onClose={() => setSelected(null)}
          onEdit={() => setEditing(selected)}
          onDuplicate={() => handleDuplicate(selected)}
          onDelete={() => setConfirmDeleteId(selected.id)}
          duplicating={duplicatingId === selected.id}
          deleting={deletingId === selected.id}
          canEdit={canEdit(selected)}
        />
      )}

      {showCreate && <RecetaModal onSave={handleSaved} onClose={() => setShowCreate(false)} />}
      {editing && (
        <RecetaModal receta={editing} onSave={handleSaved} onClose={() => setEditing(null)} />
      )}
      {confirmDeleteId && (
        <ConfirmModal
          title="Eliminar receta"
          message="¿Estás seguro de que deseas eliminar esta receta del catálogo? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {showVincular && (
        <VincularIngredientesModal onClose={() => { setShowVincular(false); reload(); }} />
      )}
    </div>
  );
}
