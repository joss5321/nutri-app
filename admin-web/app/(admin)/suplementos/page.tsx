"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  fetchSuplementos,
  createSuplemento,
  updateSuplemento,
  deleteSuplemento,
  uploadSuplementoImagen,
  type Suplemento,
  type SuplementoInput,
} from "@/app/_data/suplementos";
import ConfirmModal from "@/app/_components/ConfirmModal";

function SuplementoModal({
  suplemento,
  onSave,
  onClose,
}: {
  suplemento?: Suplemento;
  onSave: (s: Suplemento) => void;
  onClose: () => void;
}) {
  const isEdit = !!suplemento;
  const [nombre, setNombre] = useState(suplemento?.nombre ?? "");
  const [marca, setMarca] = useState(suplemento?.marca ?? "");
  const [gramaje, setGramaje] = useState(suplemento?.gramaje ?? "");
  const [descripcion, setDescripcion] = useState(suplemento?.descripcion ?? "");
  const [imagenUrl, setImagenUrl] = useState(suplemento?.imagen_url ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file?: File) => {
    if (!file) return;
    setImageFile(file);
    setImagenUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      setError("El nombre del suplemento es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let finalImageUrl = imagenUrl;
      if (imageFile) {
        finalImageUrl = await uploadSuplementoImagen(imageFile);
      }

      const input: SuplementoInput = {
        nombre: nombre.trim(),
        icono: "💊",
        descripcion: descripcion.trim() || null,
        marca: marca.trim() || null,
        gramaje: gramaje.trim() || null,
        imagen_url: finalImageUrl || null,
      };

      const saved = isEdit
        ? await updateSuplemento(suplemento!.id, input)
        : await createSuplemento(input);

      onSave(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">{isEdit ? "Editar suplemento" : "Nuevo suplemento"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Imagen */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors bg-gray-50"
              onClick={() => fileRef.current?.click()}
            >
              {imagenUrl ? (
                <Image src={imagenUrl} alt="" width={112} height={112} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-400">
                  <span className="text-3xl">📷</span>
                  <span className="text-xs">Subir imagen</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0])} />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Nombre *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Proteína en polvo"
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Marca</label>
              <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej. Optimum Nutrition"
                className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Gramaje</label>
              <input value={gramaje} onChange={(e) => setGramaje(e.target.value)} placeholder="Ej. 2 lbs / 907g"
                className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Descripción</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción del suplemento..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none h-20" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "✓ Crear suplemento"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuplementosPage() {
  const [suplementos, setSuplementos] = useState<Suplemento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Suplemento | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSuplementos = () => {
    fetchSuplementos()
      .then(setSuplementos)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los suplementos."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSuplementos(); }, []);

  const handleSaved = (s: Suplemento) => {
    setSuplementos((prev) => {
      const exists = prev.some((x) => x.id === s.id);
      return exists ? prev.map((x) => (x.id === s.id ? s : x)) : [s, ...prev];
    });
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deleteSuplemento(id);
      setSuplementos((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = suplementos.filter((s) =>
    s.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (s.marca ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suplementación</h1>
          <p className="text-gray-500 text-sm mt-1">Catálogo de suplementos disponibles para asignar a usuarios.</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors">
          + Nuevo suplemento
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 h-11 mb-5 max-w-sm shadow-sm">
        <span className="text-gray-400">🔍</span>
        <input placeholder="Buscar suplemento..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm focus:outline-none text-gray-700" />
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={() => { setLoading(true); setError(null); loadSuplementos(); }} className="font-semibold hover:underline">Reintentar</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Cargando suplementos...</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            <span className="font-semibold text-gray-900">{filtered.length}</span> suplemento{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-3 gap-5">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:border-primary/50 transition-colors">
                {/* Imagen */}
                <div className="h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {s.imagen_url ? (
                    <Image src={s.imagen_url} alt={s.nombre} width={300} height={144} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-5xl">💊</span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{s.nombre}</p>
                      {s.marca && <p className="text-xs text-gray-500 truncate">{s.marca}</p>}
                    </div>
                    {s.gramaje && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium shrink-0">{s.gramaje}</span>
                    )}
                  </div>
                  {s.descripcion && (
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">{s.descripcion}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditing(s)}
                      className="flex-1 h-9 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors">
                      ✏️ Editar
                    </button>
                    <button onClick={() => setConfirmDeleteId(s.id)} disabled={deletingId === s.id}
                      className="h-9 px-3 rounded-xl border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 hover:border-red-400 transition-colors disabled:opacity-50">
                      {deletingId === s.id ? "..." : "🗑️"}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400">
                <span className="text-4xl mb-2">💊</span>
                <p className="text-sm">No se encontraron suplementos.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modales */}
      {showCreate && <SuplementoModal onSave={handleSaved} onClose={() => setShowCreate(false)} />}
      {editing && <SuplementoModal suplemento={editing} onSave={handleSaved} onClose={() => setEditing(null)} />}
      {confirmDeleteId && (
        <ConfirmModal
          title="Eliminar suplemento"
          message="¿Estás seguro de que deseas eliminar este suplemento del catálogo? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
