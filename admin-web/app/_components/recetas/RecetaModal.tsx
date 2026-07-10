"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIAS_NUTRICIONALES,
  NIVELES_RECETA,
  TIPOS_RECETA,
  createReceta,
  updateReceta,
  type Receta,
  type RecetaIngredienteInput,
  type RecetaInput,
} from "@/app/_data/recetas";
import { fetchAlimentos, type Alimento } from "@/app/_data/alimentos";

type IngredienteForm = {
  alimento_id: string | null;
  nombre: string;
  cantidad: string;
  unidad: string;
};

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
  customSave,
}: {
  receta?: Receta;
  onSave: (receta: Receta) => void;
  onClose: () => void;
  customSave?: (input: RecetaInput) => Promise<Receta>;
}) {
  const isEdit = !!receta;

  const [nombre, setNombre] = useState(receta?.nombre ?? "");
  const [emoji, setEmoji] = useState(receta?.emoji ?? "🍽️");
  const [tipo, setTipo] = useState<string>(receta?.tipo ?? TIPOS_RECETA[0]);
  const [categoria, setCategoria] = useState<string>(receta?.categoria_nutricional ?? CATEGORIAS_NUTRICIONALES[0]);
  const [nivel, setNivel] = useState<string>(receta?.nivel ?? NIVELES_RECETA[0]);
  const [calorias, setCalorias] = useState(receta?.calorias?.toString() ?? "");
  const [porciones, setPorciones] = useState(receta?.porciones ?? "");
  const [proteinas, setProteinas] = useState(receta?.proteinas_g?.toString() ?? "");
  const [carbohidratos, setCarbohidratos] = useState(receta?.carbohidratos_g?.toString() ?? "");
  const [grasas, setGrasas] = useState(receta?.grasas_g?.toString() ?? "");
  const [ingredientes, setIngredientes] = useState<IngredienteForm[]>(
    receta && receta.ingredientes.length > 0
      ? receta.ingredientes.map((i) => ({
          alimento_id: i.alimento_id ?? null,
          nombre: i.descripcion,
          cantidad: i.cantidad?.toString() ?? "",
          unidad: i.unidad ?? "",
        }))
      : [{ alimento_id: null, nombre: "", cantidad: "", unidad: "" }]
  );
  const [pasos, setPasos] = useState<string[]>(
    receta && receta.pasos.length > 0 ? receta.pasos.map((p) => p.descripcion) : [""]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete
  const [dropdownIdx, setDropdownIdx] = useState<number | null>(null);
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);

  useEffect(() => {
    fetchAlimentos().then(setAlimentos).catch(console.error);
  }, []);

  const alimentosById = useMemo(() => {
    const map: Record<string, Alimento> = {};
    alimentos.forEach((a) => { map[a.id] = a; });
    return map;
  }, [alimentos]);

  // Auto-calculate Kcal + macros from linked ingredients
  useEffect(() => {
    const hasLinkedNow = ingredientes.some((i) => !!i.alimento_id);
    if (!hasLinkedNow) return;
    let k = 0, p = 0, l = 0, h = 0;
    ingredientes.forEach((ing) => {
      if (!ing.alimento_id) return;
      const al = alimentosById[ing.alimento_id];
      if (!al || !al.cantidad || al.cantidad === 0) return;
      const scale = (parseFloat(ing.cantidad) || 0) / al.cantidad;
      k += (al.kcal ?? 0) * scale;
      p += (al.proteinas_g ?? 0) * scale;
      l += (al.lipidos_g ?? 0) * scale;
      h += (al.hco_g ?? 0) * scale;
    });
    setCalorias(Math.round(k).toString());
    setProteinas(p.toFixed(1));
    setGrasas(l.toFixed(1));
    setCarbohidratos(h.toFixed(1));
  }, [ingredientes, alimentosById]);

  const hasLinked = ingredientes.some((i) => !!i.alimento_id);

  // Ingredient helpers
  const updateIngrediente = (i: number, patch: Partial<IngredienteForm>) =>
    setIngredientes((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)));

  const addIngrediente = () =>
    setIngredientes((prev) => [...prev, { alimento_id: null, nombre: "", cantidad: "", unidad: "" }]);

  const removeIngrediente = (i: number) =>
    setIngredientes((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const selectAlimento = (i: number, al: Alimento) => {
    updateIngrediente(i, {
      alimento_id: al.id,
      nombre: al.nombre,
      cantidad: al.cantidad?.toString() ?? "1",
      unidad: al.unidad ?? "",
    });
    setDropdownIdx(null);
  };

  const getSuggestions = (text: string): Alimento[] => {
    if (!text.trim()) return [];
    return alimentos.filter((a) => a.nombre.toLowerCase().includes(text.toLowerCase())).slice(0, 8);
  };

  const toNumber = (v: string): number | null => (v.trim() === "" ? null : Number(v));
  const setPositive = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value.replace(/^-/, ""));
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      setError("El nombre de la receta es obligatorio.");
      return;
    }

    if (!hasLinked) {
      const numFields = [
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
    }

    const emptyIngredient = ingredientes.some((ing) => ing.nombre.trim() === "");
    if (emptyIngredient) {
      setError("Todos los ingredientes deben tener texto. Elimina los vacíos o completa su contenido.");
      return;
    }

    const hasNumbers = ingredientes.some((ing) => /^\d+$/.test(ing.nombre.trim()));
    if (hasNumbers) {
      setError("Los ingredientes no pueden ser solo números. Describe el ingrediente con texto.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: RecetaInput = {
        nombre: nombre.trim(),
        emoji: emoji.trim() || "🍽️",
        tipo,
        categoria_nutricional: categoria,
        tags: categoria,
        tiempo_prep_min: null,
        tiempo_coccion_min: null,
        tiempo_min: null,
        nivel,
        calorias: toNumber(calorias),
        porciones: porciones.trim() || null,
        proteinas_g: toNumber(proteinas),
        carbohidratos_g: toNumber(carbohidratos),
        grasas_g: toNumber(grasas),
        ingredientes: ingredientes
          .filter((ing) => ing.nombre.trim() !== "")
          .map((ing): RecetaIngredienteInput => ({
            descripcion: ing.nombre.trim(),
            alimento_id: ing.alimento_id,
            cantidad: parseFloat(ing.cantidad) || null,
            unidad: ing.unidad || null,
          })),
        pasos,
      };

      const saved = customSave
        ? await customSave(payload)
        : isEdit ? await updateReceta(receta!.id, payload) : await createReceta(payload);
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

            {/* 4. Ingredientes — antes de macros para que el cálculo sea visible */}
            <section>
              <p className="text-sm font-bold text-gray-800 mb-1">2. Ingredientes</p>
              <p className="text-xs text-gray-400 mb-3">Busca en el catálogo de alimentos o escribe libremente</p>

              <div className="grid grid-cols-[1fr_80px_96px_28px] gap-2 px-1 mb-1">
                <span className="text-xs text-gray-400 font-medium">Alimento</span>
                <span className="text-xs text-gray-400 font-medium text-center">Cantidad</span>
                <span className="text-xs text-gray-400 font-medium text-center">Unidad</span>
                <span />
              </div>

              <div className="flex flex-col gap-2">
                {ingredientes.map((ing, i) => {
                  const suggestions = getSuggestions(ing.nombre);
                  const isLinked = !!ing.alimento_id;
                  return (
                    <div key={i} className="grid grid-cols-[1fr_80px_96px_28px] gap-2 items-center">
                      {/* Nombre / autocomplete */}
                      <div className="relative">
                        <input
                          value={ing.nombre}
                          onChange={(e) => updateIngrediente(i, { nombre: e.target.value, alimento_id: null })}
                          onFocus={() => setDropdownIdx(i)}
                          onBlur={() => setTimeout(() => setDropdownIdx(null), 150)}
                          placeholder="Buscar alimento..."
                          className={`w-full h-9 border rounded-xl px-3 pr-7 text-sm focus:outline-none ${
                            isLinked
                              ? "border-green-300 bg-green-50 text-green-800"
                              : "border-gray-200 focus:border-primary"
                          }`}
                        />
                        {isLinked && (
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500 text-xs font-bold">✓</span>
                        )}
                        {dropdownIdx === i && ing.nombre.trim() && (
                          <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                            {suggestions.length > 0 ? (
                              <div className="max-h-48 overflow-y-auto">
                                {suggestions.map((al) => (
                                  <button
                                    key={al.id}
                                    onMouseDown={() => selectAlimento(i, al)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 hover:text-primary flex items-center justify-between gap-2"
                                  >
                                    <span className="font-medium">{al.nombre}</span>
                                    <span className="text-xs text-gray-400 shrink-0">
                                      {al.cantidad != null && al.unidad ? `${al.cantidad} ${al.unidad}` : al.unidad ?? ""}
                                      {al.kcal != null ? ` · ${al.kcal} kcal` : ""}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="px-3 py-2">
                                <p className="text-xs text-gray-400">No encontrado — se guardará como texto libre</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Cantidad */}
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={ing.cantidad}
                        onChange={(e) => updateIngrediente(i, { cantidad: e.target.value.replace(/^-/, "") })}
                        placeholder="—"
                        className="h-9 border border-gray-200 rounded-xl px-2 text-sm focus:outline-none focus:border-primary text-center"
                      />

                      {/* Unidad */}
                      <input
                        value={ing.unidad}
                        readOnly={isLinked}
                        onChange={(e) => !isLinked && updateIngrediente(i, { unidad: e.target.value })}
                        placeholder="unidad"
                        className={`h-9 border rounded-xl px-2 text-sm text-center focus:outline-none ${
                          isLinked
                            ? "border-gray-100 bg-gray-50 text-gray-500 cursor-default"
                            : "border-gray-200 focus:border-primary"
                        }`}
                      />

                      {/* Remove */}
                      <button
                        onClick={() => removeIngrediente(i)}
                        disabled={ingredientes.length === 1}
                        className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <button onClick={addIngrediente} className="mt-2 text-xs text-primary font-semibold hover:underline">
                + Agregar ingrediente
              </button>
            </section>

            {/* Porciones y calorías */}
            <section>
              <p className="text-sm font-bold text-gray-800 mb-3">3. Porciones y calorías</p>
              {hasLinked && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mb-3">
                  ⚡ Calculado automáticamente desde los ingredientes agregados
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Calorías (kcal)</label>
                  <input
                    type="number"
                    min={0}
                    value={calorias}
                    readOnly={hasLinked}
                    onChange={hasLinked ? undefined : setPositive(setCalorias)}
                    className={`w-full h-10 border rounded-xl px-3 text-sm focus:outline-none font-semibold ${
                      hasLinked
                        ? "border-amber-200 bg-amber-50 text-amber-700 cursor-default"
                        : "border-gray-200 focus:border-primary font-normal"
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Porciones</label>
                  <input value={porciones} onChange={(e) => setPorciones(e.target.value)}
                    placeholder="Ej. 2 porciones"
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
            </section>

            {/* Macronutrientes */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-800">
                  4. Macronutrientes{hasLinked ? " (total receta)" : " (por porción)"}
                </p>
                {hasLinked && (
                  <span className="text-xs text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                    ⚡ Auto
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Proteínas (g)</label>
                  <input type="number" min={0} step="0.1" value={proteinas}
                    readOnly={hasLinked}
                    onChange={hasLinked ? undefined : setPositive(setProteinas)}
                    className={`w-full h-10 border rounded-xl px-3 text-sm focus:outline-none font-semibold ${
                      hasLinked ? "border-red-200 bg-red-50 text-red-600 cursor-default" : "border-gray-200 focus:border-primary font-normal"
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Carbohidratos (g)</label>
                  <input type="number" min={0} step="0.1" value={carbohidratos}
                    readOnly={hasLinked}
                    onChange={hasLinked ? undefined : setPositive(setCarbohidratos)}
                    className={`w-full h-10 border rounded-xl px-3 text-sm focus:outline-none font-semibold ${
                      hasLinked ? "border-amber-200 bg-amber-50 text-amber-700 cursor-default" : "border-gray-200 focus:border-primary font-normal"
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Grasas (g)</label>
                  <input type="number" min={0} step="0.1" value={grasas}
                    readOnly={hasLinked}
                    onChange={hasLinked ? undefined : setPositive(setGrasas)}
                    className={`w-full h-10 border rounded-xl px-3 text-sm focus:outline-none font-semibold ${
                      hasLinked ? "border-purple-200 bg-purple-50 text-purple-600 cursor-default" : "border-gray-200 focus:border-primary font-normal"
                    }`}
                  />
                </div>
              </div>
            </section>

            {/* Preparación */}
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
                <span>📊 {nivel}</span>
                <span>🔥 {calorias || "—"} kcal</span>
                <span>🍽️ {porciones || "—"}</span>
              </div>

              {(proteinas || carbohidratos || grasas) && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-1 text-center">
                  <div>
                    <p className="text-xs font-bold text-red-500">{proteinas || "—"}<span className="font-normal text-gray-400">g</span></p>
                    <p className="text-xs text-gray-400">Prot</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-600">{carbohidratos || "—"}<span className="font-normal text-gray-400">g</span></p>
                    <p className="text-xs text-gray-400">HCO</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-purple-500">{grasas || "—"}<span className="font-normal text-gray-400">g</span></p>
                    <p className="text-xs text-gray-400">Líp</p>
                  </div>
                </div>
              )}

              {hasLinked && (
                <p className="mt-3 text-xs text-center text-green-600 bg-green-50 rounded-lg py-1">
                  ⚡ {ingredientes.filter(i => i.alimento_id).length} ingrediente{ingredientes.filter(i => i.alimento_id).length !== 1 ? "s" : ""} del catálogo
                </p>
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
            {saving ? "Guardando..." : `✓ ${isEdit ? "Guardar cambios" : "Guardar receta"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
