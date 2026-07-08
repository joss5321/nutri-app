"use client";
import { useState } from "react";
import { FOOD_GROUPS } from "@/app/_data/nutricion";
import {
  UNIDADES_ALIMENTO,
  createAlimento,
  updateAlimento,
  type Alimento,
  type AlimentoInput,
} from "@/app/_data/alimentos";

export default function AlimentoModal({
  alimento,
  onSave,
  onClose,
}: {
  alimento?: Alimento;
  onSave: (a: Alimento) => void;
  onClose: () => void;
}) {
  const isEdit = !!alimento;

  const [nombre, setNombre] = useState(alimento?.nombre ?? "");
  const [categoria, setCategoria] = useState(alimento?.categoria ?? FOOD_GROUPS[0].grupo);
  const [cantidad, setCantidad] = useState(alimento?.cantidad?.toString() ?? "");
  const [unidad, setUnidad] = useState(alimento?.unidad ?? UNIDADES_ALIMENTO[0]);
  const [pesoBruto, setPesoBruto] = useState(alimento?.peso_bruto_g?.toString() ?? "");
  const [pesoNeto, setPesoNeto] = useState(alimento?.peso_neto_g?.toString() ?? "");
  const [kcal, setKcal] = useState(alimento?.kcal?.toString() ?? "");
  const [proteinas, setProteinas] = useState(alimento?.proteinas_g?.toString() ?? "");
  const [lipidos, setLipidos] = useState(alimento?.lipidos_g?.toString() ?? "");
  const [hco, setHco] = useState(alimento?.hco_g?.toString() ?? "");
  const [fibra, setFibra] = useState(alimento?.fibra_g?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toNum = (v: string): number | null => (v.trim() === "" ? null : parseFloat(v));
  const setPositive = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setter(e.target.value.replace(/^-/, ""));

  const handleSave = async () => {
    if (!nombre.trim()) {
      setError("El nombre del alimento es obligatorio.");
      return;
    }
    const numFields = [
      { label: "Cantidad", value: cantidad },
      { label: "Peso bruto", value: pesoBruto },
      { label: "Peso neto", value: pesoNeto },
      { label: "Kcal", value: kcal },
      { label: "Proteínas", value: proteinas },
      { label: "Lípidos", value: lipidos },
      { label: "HCO", value: hco },
      { label: "Fibra", value: fibra },
    ];
    const negative = numFields.find((f) => f.value.trim() !== "" && Number(f.value) < 0);
    if (negative) {
      setError(`"${negative.label}" no puede ser negativo.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: AlimentoInput = {
        nombre: nombre.trim(),
        categoria: categoria || null,
        cantidad: toNum(cantidad),
        unidad: unidad || null,
        peso_bruto_g: toNum(pesoBruto),
        peso_neto_g: toNum(pesoNeto),
        kcal: toNum(kcal),
        proteinas_g: toNum(proteinas),
        lipidos_g: toNum(lipidos),
        hco_g: toNum(hco),
        fibra_g: toNum(fibra),
      };
      const saved = isEdit
        ? await updateAlimento(alimento!.id, payload)
        : await createAlimento(payload);
      onSave(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el alimento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-xl">
              {isEdit ? "Editar alimento" : "Agregar alimento"}
            </h2>
            <p className="text-gray-500 text-sm">
              Completa la información nutricional del alimento.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* 1. General */}
          <section>
            <p className="text-sm font-bold text-gray-800 mb-3">1. Información general</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Nombre del alimento *</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Pechuga de pollo cocida"
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Categoría</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
                >
                  {FOOD_GROUPS.map((g) => (
                    <option key={g.grupo} value={g.grupo}>
                      {g.icono} {g.grupo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* 2. Medidas */}
          <section>
            <p className="text-sm font-bold text-gray-800 mb-3">2. Medida y peso</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cantidad</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={cantidad}
                  onChange={setPositive(setCantidad)}
                  placeholder="Ej. 1"
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Unidad</label>
                <select
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
                >
                  {UNIDADES_ALIMENTO.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Peso bruto (g)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={pesoBruto}
                  onChange={setPositive(setPesoBruto)}
                  placeholder="Ej. 120"
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Peso neto (g)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={pesoNeto}
                  onChange={setPositive(setPesoNeto)}
                  placeholder="Ej. 100"
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </section>

          {/* 3. Macros */}
          <section>
            <p className="text-sm font-bold text-gray-800 mb-3">3. Información nutricional</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <label className="text-xs text-gray-500 block mb-1">Calorías (Kcal)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={kcal}
                  onChange={setPositive(setKcal)}
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Proteínas (g)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={proteinas}
                  onChange={setPositive(setProteinas)}
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Lípidos (g)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={lipidos}
                  onChange={setPositive(setLipidos)}
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">HCO (g)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={hco}
                  onChange={setPositive(setHco)}
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fibra (g)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={fibra}
                  onChange={setPositive(setFibra)}
                  className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
            >
              Cancelar
            </button>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !nombre.trim()}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-60"
          >
            {saving ? "Guardando..." : `✓ ${isEdit ? "Guardar cambios" : "Agregar alimento"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
