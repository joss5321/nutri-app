"use client";
import { useState } from "react";
import {
  CATEGORIAS_NUTRICIONALES,
  NIVELES_RECETA,
  TIPOS_RECETA,
  createReceta,
  updateReceta,
  type Receta,
  type RecetaInput,
} from "@/app/_data/recetas";

function ListEditor({
  title,
  items,
  setItems,
  placeholder,
  numbered,
}: {
  title: string;
  items: string[];
  setItems: (items: string[]) => void;
  placeholder: string;
  numbered?: boolean;
}) {
  const update = (i: number, value: string) => setItems(items.map((item, idx) => (idx === i ? value : item)));
  const add = () => setItems([...items, ""]);
  const remove = (i: number) => setItems(items.length > 1 ? items.filter((_, idx) => idx !== i) : items);

  return (
    <section>
      <p className="text-sm font-bold text-gray-800 mb-3">{title}</p>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            {numbered ? (
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">{i + 1}</div>
            ) : (
              <span className="text-gray-400 shrink-0">•</span>
            )}
            <input
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 h-9 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => remove(i)}
              disabled={items.length === 1}
              className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent shrink-0"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 text-xs text-primary font-semibold hover:underline">
        + Agregar
      </button>
    </section>
  );
}

export default function RecetaModal({
  receta,
  onSave,
  onClose,
}: {
  receta?: Receta;
  onSave: (receta: Receta) => void;
  onClose: () => void;
}) {
  const isEdit = !!receta;

  const [nombre, setNombre] = useState(receta?.nombre ?? "");
  const [emoji, setEmoji] = useState(receta?.emoji ?? "🍽️");
  const [tipo, setTipo] = useState<string>(receta?.tipo ?? TIPOS_RECETA[0]);
  const [categoria, setCategoria] = useState<string>(receta?.categoria_nutricional ?? CATEGORIAS_NUTRICIONALES[0]);
  const [nivel, setNivel] = useState<string>(receta?.nivel ?? NIVELES_RECETA[0]);
  const [tiempoPrep, setTiempoPrep] = useState(receta?.tiempo_prep_min?.toString() ?? "");
  const [tiempoCoccion, setTiempoCoccion] = useState(receta?.tiempo_coccion_min?.toString() ?? "");
  const [calorias, setCalorias] = useState(receta?.calorias?.toString() ?? "");
  const [porciones, setPorciones] = useState(receta?.porciones ?? "");
  const [proteinas, setProteinas] = useState(receta?.proteinas_g?.toString() ?? "");
  const [carbohidratos, setCarbohidratos] = useState(receta?.carbohidratos_g?.toString() ?? "");
  const [grasas, setGrasas] = useState(receta?.grasas_g?.toString() ?? "");
  const [ingredientes, setIngredientes] = useState<string[]>(
    receta && receta.ingredientes.length > 0 ? receta.ingredientes.map((i) => i.descripcion) : [""]
  );
  const [pasos, setPasos] = useState<string[]>(
    receta && receta.pasos.length > 0 ? receta.pasos.map((p) => p.descripcion) : [""]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toNumber = (v: string): number | null => (v.trim() === "" ? null : Number(v));
  const setPositive = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value.replace(/^-/, ""));
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      setError("El nombre de la receta es obligatorio.");
      return;
    }

    const numFields = [
      { label: "Prep. (min)", value: tiempoPrep },
      { label: "Cocción (min)", value: tiempoCoccion },
      { label: "Calorías", value: calorias },
      { label: "Proteínas (g)", value: proteinas },
      { label: "Carbohidratos (g)", value: carbohidratos },
      { label: "Grasas (g)", value: grasas },
    ];
    const negative = numFields.find((f) => f.value.trim() !== "" && Number(f.value) < 0);
    if (negative) {
      setError(`"${negative.label}" no puede ser negativo.`);
      return;
    }

    const emptyIngredient = ingredientes.some((ing) => ing.trim() === "");
    if (emptyIngredient) {
      setError("Todos los ingredientes deben tener texto. Elimina los vacíos o completa su contenido.");
      return;
    }

    const hasNumbers = ingredientes.some((ing) => /^\d+$/.test(ing.trim()));
    if (hasNumbers) {
      setError("Los ingredientes no pueden ser solo números. Describe el ingrediente con texto.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const prep = toNumber(tiempoPrep);
      const coccion = toNumber(tiempoCoccion);
      const total = (prep ?? 0) + (coccion ?? 0);

      const payload: RecetaInput = {
        nombre: nombre.trim(),
        emoji: emoji.trim() || "🍽️",
        tipo,
        categoria_nutricional: categoria,
        tags: categoria,
        tiempo_prep_min: prep,
        tiempo_coccion_min: coccion,
        tiempo_min: total || null,
        nivel,
        calorias: toNumber(calorias),
        porciones: porciones.trim() || null,
        proteinas_g: toNumber(proteinas),
        carbohidratos_g: toNumber(carbohidratos),
        grasas_g: toNumber(grasas),
        ingredientes,
        pasos,
      };

      const saved = isEdit ? await updateReceta(receta!.id, payload) : await createReceta(payload);

      onSave(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la receta.");
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
            <h2 className="font-bold text-gray-900 text-xl">{isEdit ? "Editar receta" : "Crear receta"}</h2>
            <p className="text-gray-500 text-sm">Completa la información para {isEdit ? "actualizar" : "agregar"} la receta al catálogo.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">×</button>
        </div>

        <div className="grid grid-cols-3 gap-6 p-6">
          {/* ── Columna izquierda ── */}
          <div className="col-span-2 flex flex-col gap-6">
            {/* 1. Información general */}
            <section>
              <p className="text-sm font-bold text-gray-800 mb-3">1. Información general</p>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="col-span-1">
                  <label className="text-xs text-gray-500 block mb-1">Emoji</label>
                  <input value={emoji} onChange={(e) => setEmoji(e.target.value)}
                    maxLength={4}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm text-center focus:outline-none focus:border-primary" />
                </div>
                <div className="col-span-3">
                  <label className="text-xs text-gray-500 block mb-1">Nombre de la receta *</label>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Pechuga de pollo a la plancha con quinoa"
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tipo de comida</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary">
                    {TIPOS_RECETA.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Dificultad</label>
                  <select value={nivel} onChange={(e) => setNivel(e.target.value)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary">
                    {NIVELES_RECETA.map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Categoría nutricional</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary">
                    {CATEGORIAS_NUTRICIONALES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* 2. Tiempos, porciones y calorías */}
            <section>
              <p className="text-sm font-bold text-gray-800 mb-3">2. Tiempos, porciones y calorías</p>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Prep. (min)</label>
                  <input type="number" min={0} value={tiempoPrep} onChange={setPositive(setTiempoPrep)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Cocción (min)</label>
                  <input type="number" min={0} value={tiempoCoccion} onChange={setPositive(setTiempoCoccion)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Calorías (kcal)</label>
                  <input type="number" min={0} value={calorias} onChange={setPositive(setCalorias)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Porciones</label>
                  <input value={porciones} onChange={(e) => setPorciones(e.target.value)}
                    placeholder="Ej. 2 porciones"
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
            </section>

            {/* 3. Macronutrientes */}
            <section>
              <p className="text-sm font-bold text-gray-800 mb-3">3. Macronutrientes (por porción)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Proteínas (g)</label>
                  <input type="number" min={0} step="0.1" value={proteinas} onChange={setPositive(setProteinas)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Carbohidratos (g)</label>
                  <input type="number" min={0} step="0.1" value={carbohidratos} onChange={setPositive(setCarbohidratos)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Grasas (g)</label>
                  <input type="number" min={0} step="0.1" value={grasas} onChange={setPositive(setGrasas)}
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
            </section>

            {/* 4. Ingredientes */}
            <ListEditor title="4. Ingredientes" items={ingredientes} setItems={setIngredientes} placeholder="Ej. Pechuga de pollo (200g)" />

            {/* 5. Preparación */}
            <ListEditor title="5. Preparación" items={pasos} setItems={setPasos} placeholder="Describe este paso..." numbered />
          </div>

          {/* ── Vista previa ── */}
          <div className="col-span-1">
            <div className="sticky top-0 bg-gray-50 rounded-2xl border border-gray-200 p-4">
              <p className="text-sm font-bold text-gray-800 mb-4">Vista previa de la receta</p>

              <div className="h-32 bg-primary/5 rounded-xl flex items-center justify-center text-5xl mb-3">
                {emoji || "🍽️"}
              </div>

              <p className="font-bold text-gray-900 text-sm mb-1">{nombre || "Nombre de la receta"}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{tipo}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{categoria}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3">
                <span>⏱ {(Number(tiempoPrep || 0) + Number(tiempoCoccion || 0)) || "—"} min</span>
                <span>📊 {nivel}</span>
                <span>🔥 {calorias || "—"} kcal</span>
              </div>
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
            {saving ? "Guardando..." : `✓ ${isEdit ? "Guardar cambios" : "Guardar receta"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
