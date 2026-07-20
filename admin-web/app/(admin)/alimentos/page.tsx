"use client";
import { useEffect, useState } from "react";
import AlimentoModal from "@/app/_components/alimentos/AlimentoModal";
import ConfirmModal from "@/app/_components/ConfirmModal";
import { FOOD_GROUPS } from "@/app/_data/nutricion";
import {
  deleteAlimento,
  fetchAlimentos,
  type Alimento,
} from "@/app/_data/alimentos";

function fmt(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

const PAGE_SIZE = 50;

export default function AlimentosPage() {
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("Todas");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Alimento | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAlimentos()
      .then(setAlimentos)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar los alimentos.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Categorías únicas presentes en los datos cargados, ordenadas alfabéticamente
  const categoriasDisponibles = [...new Set(
    alimentos.map((a) => a.categoria).filter((c): c is string => !!c)
  )].sort((a, b) => a.localeCompare(b, "es"));

  const filtered = alimentos.filter((a) => {
    const matchSearch = a.nombre.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      categoriaFilter === "Todas" || a.categoria === categoriaFilter;
    return matchSearch && matchCat;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSaved = (a: Alimento) => {
    setAlimentos((prev) => {
      const exists = prev.some((x) => x.id === a.id);
      return exists ? prev.map((x) => (x.id === a.id ? a : x)) : [a, ...prev];
    });
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deleteAlimento(id);
      setAlimentos((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar el alimento.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alimentos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Administra el catálogo de alimentos con su información nutricional.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          + Agregar alimento
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 h-11 max-w-sm shadow-sm flex-1">
          <span className="text-gray-400">🔍</span>
          <input
            placeholder="Buscar alimento..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 text-sm focus:outline-none text-gray-700"
          />
        </div>
        <select
          value={categoriaFilter}
          onChange={(e) => { setCategoriaFilter(e.target.value); setPage(1); }}
          className="h-11 border border-gray-200 rounded-xl px-3 text-sm bg-white shadow-sm focus:outline-none focus:border-primary"
        >
          <option value="Todas">Todas las categorías ({alimentos.length})</option>
          {categoriasDisponibles.map((cat) => {
            const grupo = FOOD_GROUPS.find((g) => g.grupo === cat);
            const count = alimentos.filter((a) => a.categoria === cat).length;
            return (
              <option key={cat} value={cat}>
                {grupo ? `${grupo.icono} ` : ""}{cat} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={load} className="font-semibold hover:underline">
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Cargando alimentos...</p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">
            {filtered.length} alimento{filtered.length !== 1 ? "s" : ""} en el catálogo
            {totalPages > 1 && ` · Página ${safePage} de ${totalPages}`}
          </p>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Alimento</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Categoría</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Cantidad</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Unidad</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">P. Bruto (g)</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">P. Neto (g)</th>
                    <th className="text-right px-4 py-3 font-semibold text-amber-600 whitespace-nowrap">Kcal</th>
                    <th className="text-right px-4 py-3 font-semibold text-red-500 whitespace-nowrap">Prot (g)</th>
                    <th className="text-right px-4 py-3 font-semibold text-purple-500 whitespace-nowrap">Líp (g)</th>
                    <th className="text-right px-4 py-3 font-semibold text-blue-500 whitespace-nowrap">HCO (g)</th>
                    <th className="text-right px-4 py-3 font-semibold text-green-600 whitespace-nowrap">Fibra (g)</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((a, i) => {
                    const grupo = FOOD_GROUPS.find((g) => g.grupo === a.categoria);
                    return (
                      <tr
                        key={a.id}
                        className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${
                          i % 2 === 0 ? "" : "bg-gray-50/30"
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {a.nombre}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {a.categoria ? (
                            <span className="inline-flex items-center gap-1.5 text-xs bg-primary/8 text-primary px-2 py-0.5 rounded-full font-medium">
                              {grupo ? `${grupo.icono} ` : ""}{a.categoria}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{fmt(a.cantidad)}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{a.unidad ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(a.peso_bruto_g)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(a.peso_neto_g)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-600">{fmt(a.kcal)}</td>
                        <td className="px-4 py-3 text-right text-red-500">{fmt(a.proteinas_g)}</td>
                        <td className="px-4 py-3 text-right text-purple-500">{fmt(a.lipidos_g)}</td>
                        <td className="px-4 py-3 text-right text-blue-500">{fmt(a.hco_g)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{fmt(a.fibra_g)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => setEditing(a)}
                              className="h-8 px-3 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                            >
                              ✏ Editar
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(a.id)}
                              disabled={deletingId === a.id}
                              className="h-8 px-2 rounded-lg border border-gray-200 text-red-500 text-xs font-semibold hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              {deletingId === a.id ? "..." : "🗑"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={12} className="text-center py-14 text-gray-400">
                        <span className="text-3xl block mb-2">🔍</span>
                        No se encontraron alimentos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400">
                Mostrando {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                  className="h-8 px-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  «
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="h-8 px-3 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ‹ Anterior
                </button>

                {/* Números de página */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 2)
                  .reduce<(number | "…")[]>((acc, n, idx, arr) => {
                    if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, idx) =>
                    n === "…" ? (
                      <span key={`ellipsis-${idx}`} className="h-8 px-2 flex items-center text-gray-400 text-xs">…</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n as number)}
                        className={`h-8 w-8 rounded-lg border text-xs font-semibold transition-colors ${
                          safePage === n
                            ? "bg-primary border-primary text-white"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {n}
                      </button>
                    )
                  )}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="h-8 px-3 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente ›
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="h-8 px-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <AlimentoModal onSave={handleSaved} onClose={() => setShowCreate(false)} />
      )}
      {editing && (
        <AlimentoModal
          alimento={editing}
          onSave={handleSaved}
          onClose={() => setEditing(null)}
        />
      )}
      {confirmDeleteId && (
        <ConfirmModal
          title="Eliminar alimento"
          message="¿Estás seguro de que deseas eliminar este alimento del catálogo? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
