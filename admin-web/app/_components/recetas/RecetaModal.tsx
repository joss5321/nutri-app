"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Check, Zap, BarChart3, Flame, UtensilsCrossed, StickyNote, Upload, ImageIcon } from "lucide-react";
import {
  CATEGORIAS_NUTRICIONALES,
  NIVELES_RECETA,
  TIPOS_RECETA,
  calcularMacrosDesdeIngredientes,
  createReceta,
  deleteRecetaFoto,
  updateReceta,
  uploadRecetaFoto,
  type Receta,
  type RecetaIngredienteInput,
  type RecetaInput,
} from "@/app/_data/recetas";
import { fetchAlimentos, type Alimento } from "@/app/_data/alimentos";
import { fetchEquivalentes, type Equivalente } from "@/app/_data/nutricion";
import type { MealKey } from "@/app/_data/recetas_guardadas";

// Umbral para ignorar diferencias insignificantes por redondeo de cantidades.
const EPSILON_EQUIVALENTES = 0.05;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

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
      <p className="text-sm font-bold text-text-primary mb-3">{title}</p>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            {numbered ? (
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">{i + 1}</div>
            ) : (
              <span className="text-muted shrink-0">•</span>
            )}
            <input
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 h-9 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => remove(i)}
              disabled={items.length === 1}
              className="w-7 h-7 rounded-lg text-muted hover:text-error hover:bg-error-soft disabled:opacity-30 disabled:hover:bg-transparent shrink-0 flex items-center justify-center"
            >
              <X size={14} />
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
  userId,
  mealKey,
}: {
  receta?: Receta;
  onSave: (receta: Receta) => void;
  onClose: () => void;
  customSave?: (input: RecetaInput) => Promise<Receta>;
  /** Paciente dueño de la asignación — solo se pasa al editar una receta ya asignada. */
  userId?: string;
  /** Tiempo de comida activo — junto con userId, habilita la comparación contra la tabla de equivalentes del plan. */
  mealKey?: MealKey;
}) {
  const isEdit = !!receta;

  // ── Borrador local — evita perder el formulario si el modal se cierra
  // sin querer (click fuera, back, etc.) antes de guardar. Se lee UNA sola
  // vez de forma perezosa (no en un efecto) para que el primer render ya
  // arranque con el valor correcto, sin parpadeo ni setState-en-efecto.
  const DRAFT_KEY = `receta_modal_draft_${receta?.id ?? "new"}`;
  type Draft = {
    nombre?: string; emoji?: string; tipo?: string; categoria?: string; nivel?: string;
    calorias?: string; porciones?: string; proteinas?: string; carbohidratos?: string; grasas?: string;
    ingredientes?: IngredienteForm[]; pasos?: string[];
  };
  const [draft] = useState<Draft | null>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as Draft) : null;
    } catch {
      return null;
    }
  });
  const [hasDraft, setHasDraft] = useState(() => !!draft);

  const initialIngredientes = (): IngredienteForm[] => {
    if (draft?.ingredientes && draft.ingredientes.length > 0) return draft.ingredientes;
    return receta && receta.ingredientes.length > 0
      ? receta.ingredientes.map((i) => ({
          alimento_id: i.alimento_id ?? null,
          nombre: i.descripcion,
          cantidad: i.cantidad?.toString() ?? "",
          unidad: i.unidad ?? "",
        }))
      : [{ alimento_id: null, nombre: "", cantidad: "", unidad: "" }];
  };
  const initialPasos = (): string[] => {
    if (draft?.pasos && draft.pasos.length > 0) return draft.pasos;
    return receta && receta.pasos.length > 0 ? receta.pasos.map((p) => p.descripcion) : [""];
  };

  const [nombre, setNombre] = useState(draft?.nombre ?? receta?.nombre ?? "");
  const [emoji, setEmoji] = useState(draft?.emoji ?? receta?.emoji ?? "🍽️");
  const [tipo, setTipo] = useState<string>(draft?.tipo ?? receta?.tipo ?? TIPOS_RECETA[0]);
  const [categoria, setCategoria] = useState<string>(draft?.categoria ?? receta?.categoria_nutricional ?? CATEGORIAS_NUTRICIONALES[0]);
  const [nivel, setNivel] = useState<string>(draft?.nivel ?? receta?.nivel ?? NIVELES_RECETA[0]);
  const [calorias, setCalorias] = useState(draft?.calorias ?? receta?.calorias?.toString() ?? "");
  const [porciones, setPorciones] = useState(draft?.porciones ?? receta?.porciones ?? "");
  const [proteinas, setProteinas] = useState(draft?.proteinas ?? receta?.proteinas_g?.toString() ?? "");
  const [carbohidratos, setCarbohidratos] = useState(draft?.carbohidratos ?? receta?.carbohidratos_g?.toString() ?? "");
  const [grasas, setGrasas] = useState(draft?.grasas ?? receta?.grasas_g?.toString() ?? "");
  const [ingredientes, setIngredientes] = useState<IngredienteForm[]>(initialIngredientes);
  const [pasos, setPasos] = useState<string[]>(initialPasos);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Foto del platillo — no se persiste en el borrador (un File no es
  // serializable a localStorage); si se edita una receta ya guardada,
  // arranca con su foto actual.
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(receta?.foto_url ?? null);

  const handleFotoChange = (f: File | undefined) => {
    if (!f) return;
    setFotoFile(f);
    setFotoPreview(URL.createObjectURL(f));
  };

  const removeFoto = () => {
    setFotoFile(null);
    setFotoPreview(null);
  };

  const discardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setNombre(receta?.nombre ?? "");
    setEmoji(receta?.emoji ?? "🍽️");
    setTipo(receta?.tipo ?? TIPOS_RECETA[0]);
    setCategoria(receta?.categoria_nutricional ?? CATEGORIAS_NUTRICIONALES[0]);
    setNivel(receta?.nivel ?? NIVELES_RECETA[0]);
    setCalorias(receta?.calorias?.toString() ?? "");
    setPorciones(receta?.porciones ?? "");
    setProteinas(receta?.proteinas_g?.toString() ?? "");
    setCarbohidratos(receta?.carbohidratos_g?.toString() ?? "");
    setGrasas(receta?.grasas_g?.toString() ?? "");
    setIngredientes(
      receta && receta.ingredientes.length > 0
        ? receta.ingredientes.map((i) => ({
            alimento_id: i.alimento_id ?? null,
            nombre: i.descripcion,
            cantidad: i.cantidad?.toString() ?? "",
            unidad: i.unidad ?? "",
          }))
        : [{ alimento_id: null, nombre: "", cantidad: "", unidad: "" }]
    );
    setPasos(receta && receta.pasos.length > 0 ? receta.pasos.map((p) => p.descripcion) : [""]);
    setHasDraft(false);
  };

  // Autoguardar el borrador en cada cambio.
  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ nombre, emoji, tipo, categoria, nivel, calorias, porciones, proteinas, carbohidratos, grasas, ingredientes, pasos })
      );
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre, emoji, tipo, categoria, nivel, calorias, porciones, proteinas, carbohidratos, grasas, ingredientes, pasos]);

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

  // Tabla de equivalentes del plan del paciente — solo aplica al editar una
  // receta ya asignada (userId + mealKey presentes).
  const [planEquivalentes, setPlanEquivalentes] = useState<Equivalente[]>([]);
  useEffect(() => {
    if (!userId || !mealKey) return;
    fetchEquivalentes(userId).then(({ equivalentes }) => setPlanEquivalentes(equivalentes)).catch(console.error);
  }, [userId, mealKey]);

  // Equivalentes que esta receta aporta a cada grupo, a partir de los
  // ingredientes ligados al catálogo de alimentos. Cada alimento define
  // cuántos equivalentes representa su propia porción (cantidad + unidad) —
  // se escala proporcionalmente si el ingrediente usa otra cantidad.
  const equivalentesAportados = useMemo(() => {
    const totales: Record<string, number> = {};
    for (const ing of ingredientes) {
      if (!ing.alimento_id) continue;
      const alimento = alimentosById[ing.alimento_id];
      if (!alimento || !alimento.categoria || !alimento.cantidad) continue;
      const cantidadIngrediente = parseFloat(ing.cantidad) || 0;
      const aportado = (cantidadIngrediente / alimento.cantidad) * (alimento.equivalentes ?? 1);
      totales[alimento.categoria] = (totales[alimento.categoria] ?? 0) + aportado;
    }
    return totales;
  }, [ingredientes, alimentosById]);

  // Comparación contra la meta del plan para el tiempo de comida activo:
  // grupos faltantes (meta > aportado) y grupos con excedente (aportado > meta).
  const comparacionEquivalentes = useMemo(() => {
    if (!userId || !mealKey) return null;
    const faltantes: { grupo: string; faltan: number }[] = [];
    const excedentes: { grupo: string; exceso: number }[] = [];

    const grupos = new Set([
      ...planEquivalentes.map((e) => e.grupo),
      ...Object.keys(equivalentesAportados),
    ]);

    for (const grupo of grupos) {
      const meta = planEquivalentes.find((e) => e.grupo === grupo)?.[mealKey] ?? 0;
      const aportado = equivalentesAportados[grupo] ?? 0;
      const diff = aportado - meta;
      if (diff < -EPSILON_EQUIVALENTES) faltantes.push({ grupo, faltan: round1(-diff) });
      else if (diff > EPSILON_EQUIVALENTES) excedentes.push({ grupo, exceso: round1(diff) });
    }
    return { faltantes, excedentes };
  }, [userId, mealKey, planEquivalentes, equivalentesAportados]);

  // Auto-calculate Kcal + macros from linked ingredients
  useEffect(() => {
    const macros = calcularMacrosDesdeIngredientes(
      ingredientes.map((i) => ({ alimento_id: i.alimento_id, cantidad: parseFloat(i.cantidad) || 0 })),
      alimentosById
    );
    if (!macros) return;
    setCalorias(macros.calorias.toString());
    setProteinas(macros.proteinas_g.toFixed(1));
    setGrasas(macros.grasas_g.toFixed(1));
    setCarbohidratos(macros.carbohidratos_g.toFixed(1));
  }, [ingredientes, alimentosById]);

  const hasLinked = ingredientes.some((i) => !!i.alimento_id);

  // Ingredient helpers
  const updateIngrediente = (i: number, patch: Partial<IngredienteForm>) =>
    setIngredientes((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)));

  const addIngrediente = () =>
    setIngredientes((prev) => [...prev, { alimento_id: null, nombre: "", cantidad: "", unidad: "" }]);

  // ── Campos por grupo faltante (uno por cada grupo con déficit) ──────────
  // Cada campo busca y solo permite seleccionar alimentos de SU grupo.
  const [faltanteSearch, setFaltanteSearch] = useState<Record<string, string>>({});
  const [faltanteDropdownOpen, setFaltanteDropdownOpen] = useState<string | null>(null);

  const getSuggestionsForGrupo = (text: string, grupo: string): Alimento[] => {
    const delGrupo = alimentos.filter((a) => a.categoria === grupo);
    const filtrados = text.trim()
      ? delGrupo.filter((a) => a.nombre.toLowerCase().includes(text.toLowerCase()))
      : delGrupo;
    return filtrados.slice(0, 8);
  };

  const addAlimentoDeGrupo = (al: Alimento) => {
    setIngredientes((prev) => [
      ...prev,
      { alimento_id: al.id, nombre: al.nombre, cantidad: al.cantidad?.toString() ?? "1", unidad: al.unidad ?? "" },
    ]);
  };

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
      let finalFotoUrl: string | null = receta?.foto_url ?? null;
      let finalFotoStoragePath: string | null = receta?.foto_storage_path ?? null;

      if (fotoFile) {
        const uploaded = await uploadRecetaFoto(fotoFile);
        finalFotoUrl = uploaded.url;
        finalFotoStoragePath = uploaded.path;
      } else if (!fotoPreview) {
        // Se quitó la foto sin reemplazarla por una nueva.
        finalFotoUrl = null;
        finalFotoStoragePath = null;
      }

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
        foto_url: finalFotoUrl,
        foto_storage_path: finalFotoStoragePath,
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

      // Si se reemplazó o quitó una foto propia, limpiamos el archivo anterior.
      if (receta?.foto_storage_path && receta.foto_storage_path !== finalFotoStoragePath) {
        deleteRecetaFoto(receta.foto_storage_path).catch(() => {});
      }

      try { localStorage.removeItem(DRAFT_KEY); } catch {}
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
        <div className="flex items-center justify-between p-6 border-b border-divider">
          <div>
            <h2 className="font-bold text-text-primary text-xl">{isEdit ? "Editar receta" : "Crear receta"}</h2>
            <p className="text-secondary text-sm">Completa la información para {isEdit ? "actualizar" : "agregar"} la receta al catálogo.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-surface-muted flex items-center justify-center text-muted"><X size={18} /></button>
        </div>

        {hasDraft && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-warning-soft border-b border-warning/30 text-xs text-warning font-medium">
            <StickyNote size={14} className="shrink-0" />
            <span>Borrador restaurado — tenías cambios sin guardar en esta receta.</span>
            <button type="button" onClick={discardDraft} className="ml-auto shrink-0 text-warning hover:opacity-70 underline font-semibold">
              Descartar cambios
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6 p-6">
          {/* ── Columna izquierda ── */}
          <div className="col-span-2 flex flex-col gap-6">
            {/* 1. Información general */}
            <section>
              <p className="text-sm font-bold text-text-primary mb-3">1. Información general</p>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="col-span-1">
                  <label className="text-xs text-secondary block mb-1">Emoji</label>
                  <input value={emoji} onChange={(e) => setEmoji(e.target.value)}
                    maxLength={4}
                    className="w-full h-10 border border-border rounded-xl px-3 text-sm text-center focus:outline-none focus:border-primary" />
                </div>
                <div className="col-span-3">
                  <label className="text-xs text-secondary block mb-1">Nombre de la receta *</label>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Pechuga de pollo a la plancha con quinoa"
                    className="w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-secondary block mb-1">Tipo de comida</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                    className="w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary">
                    {TIPOS_RECETA.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-secondary block mb-1">Dificultad</label>
                  <select value={nivel} onChange={(e) => setNivel(e.target.value)}
                    className="w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary">
                    {NIVELES_RECETA.map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-secondary block mb-1">Categoría nutricional</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                    className="w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary">
                    {CATEGORIAS_NUTRICIONALES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* 2. Foto del platillo */}
            <section>
              <p className="text-sm font-bold text-text-primary mb-3">2. Foto del platillo</p>
              <div className="relative h-44 bg-surface-muted rounded-xl overflow-hidden flex items-center justify-center">
                {fotoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoPreview} alt="Foto del platillo" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted">
                    <ImageIcon size={36} />
                    <p className="text-sm">Sube una foto del platillo</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted">Formatos: JPG, PNG o WEBP.</p>
                <div className="flex items-center gap-3">
                  {fotoPreview && (
                    <button type="button" onClick={removeFoto} className="text-xs text-error font-semibold hover:underline">
                      Quitar
                    </button>
                  )}
                  <label className="flex items-center gap-1 text-xs text-primary font-semibold cursor-pointer hover:underline">
                    <Upload size={12} /> {fotoPreview ? "Cambiar foto" : "Subir foto"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => handleFotoChange(e.target.files?.[0])} />
                  </label>
                </div>
              </div>
            </section>

            {/* 4. Ingredientes — antes de macros para que el cálculo sea visible */}
            <section>
              <p className="text-sm font-bold text-text-primary mb-1">3. Ingredientes</p>
              <p className="text-xs text-muted mb-3">Busca en el catálogo de alimentos o escribe libremente</p>

              <div className="grid grid-cols-[1fr_80px_96px_28px] gap-2 px-1 mb-1">
                <span className="text-xs text-muted font-medium">Alimento</span>
                <span className="text-xs text-muted font-medium text-center">Cantidad</span>
                <span className="text-xs text-muted font-medium text-center">Unidad</span>
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
                              ? "border-success/40 bg-success-soft text-success"
                              : "border-border focus:border-primary"
                          }`}
                        />
                        {isLinked && (
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-success"><Check size={13} /></span>
                        )}
                        {dropdownIdx === i && ing.nombre.trim() && (
                          <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
                            {suggestions.length > 0 ? (
                              <div className="max-h-48 overflow-y-auto">
                                {suggestions.map((al) => (
                                  <button
                                    key={al.id}
                                    onMouseDown={() => selectAlimento(i, al)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 hover:text-primary flex items-center justify-between gap-2"
                                  >
                                    <span className="min-w-0">
                                      <span className="font-medium block truncate">{al.nombre}</span>
                                      {al.categoria && <span className="text-xs text-muted block truncate">{al.categoria}</span>}
                                    </span>
                                    <span className="text-xs text-muted shrink-0 text-right">
                                      {al.cantidad != null && al.unidad ? `${al.cantidad} ${al.unidad}` : al.unidad ?? ""}
                                      {al.kcal != null ? ` · ${al.kcal} kcal` : ""}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="px-3 py-2">
                                <p className="text-xs text-muted">No encontrado — se guardará como texto libre</p>
                              </div>
                            )}
                          </div>
                        )}
                        {isLinked && ing.alimento_id && alimentosById[ing.alimento_id] && (
                          <p className="text-[11px] text-muted mt-1 px-1 truncate">
                            {alimentosById[ing.alimento_id].categoria ?? "Sin grupo"}
                            {" · "}
                            {ing.cantidad || alimentosById[ing.alimento_id].cantidad || "—"} {ing.unidad || alimentosById[ing.alimento_id].unidad || ""}
                            {alimentosById[ing.alimento_id].kcal != null ? ` · ${alimentosById[ing.alimento_id].kcal} kcal` : ""}
                          </p>
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
                        className="h-9 border border-border rounded-xl px-2 text-sm focus:outline-none focus:border-primary text-center"
                      />

                      {/* Unidad */}
                      <input
                        value={ing.unidad}
                        readOnly={isLinked}
                        onChange={(e) => !isLinked && updateIngrediente(i, { unidad: e.target.value })}
                        placeholder="unidad"
                        className={`h-9 border rounded-xl px-2 text-sm text-center focus:outline-none ${
                          isLinked
                            ? "border-divider bg-background-secondary text-secondary cursor-default"
                            : "border-border focus:border-primary"
                        }`}
                      />

                      {/* Remove */}
                      <button
                        onClick={() => removeIngrediente(i)}
                        disabled={ingredientes.length === 1}
                        className="w-7 h-7 rounded-lg text-muted hover:text-error hover:bg-error-soft disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button onClick={addIngrediente} className="mt-2 text-xs text-primary font-semibold hover:underline">
                + Agregar ingrediente
              </button>

              {comparacionEquivalentes && comparacionEquivalentes.faltantes.length > 0 && (
                <div className="mt-4 pt-4 border-t border-red-200 flex flex-col gap-3">
                  <p className="text-xs font-bold text-red-600">
                    Grupos faltantes según el plan de equivalentes — agrega un alimento de cada uno
                  </p>
                  {comparacionEquivalentes.faltantes.map((f) => {
                    const searchText = faltanteSearch[f.grupo] ?? "";
                    const suggestions = getSuggestionsForGrupo(searchText, f.grupo);
                    return (
                      <div key={f.grupo} className="relative">
                        <label className="text-xs text-red-600 font-medium block mb-1">
                          Falta: {f.grupo} ({f.faltan} equiv.)
                        </label>
                        <input
                          value={searchText}
                          onChange={(e) => setFaltanteSearch((prev) => ({ ...prev, [f.grupo]: e.target.value }))}
                          onFocus={() => setFaltanteDropdownOpen(f.grupo)}
                          onBlur={() => setTimeout(() => setFaltanteDropdownOpen(null), 150)}
                          placeholder={`Buscar alimento de ${f.grupo}...`}
                          className="w-full h-9 border border-red-300 bg-red-50 rounded-xl px-3 text-sm text-red-700 placeholder:text-red-300 focus:outline-none focus:border-red-500"
                        />
                        {faltanteDropdownOpen === f.grupo && (
                          <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
                            {suggestions.length > 0 ? (
                              <div className="max-h-48 overflow-y-auto">
                                {suggestions.map((al) => (
                                  <button
                                    key={al.id}
                                    onMouseDown={() => {
                                      addAlimentoDeGrupo(al);
                                      setFaltanteSearch((prev) => ({ ...prev, [f.grupo]: "" }));
                                      setFaltanteDropdownOpen(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 hover:text-primary flex items-center justify-between gap-2"
                                  >
                                    <span className="font-medium">{al.nombre}</span>
                                    <span className="text-xs text-muted shrink-0">
                                      {al.cantidad != null && al.unidad ? `${al.cantidad} ${al.unidad}` : al.unidad ?? ""}
                                      {al.kcal != null ? ` · ${al.kcal} kcal` : ""}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="px-3 py-2">
                                <p className="text-xs text-muted">No hay alimentos de &quot;{f.grupo}&quot; en el catálogo</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Porciones y calorías */}
            <section>
              <p className="text-sm font-bold text-text-primary mb-3">4. Porciones y calorías</p>
              {hasLinked && (
                <p className="flex items-center gap-1 text-xs text-warning bg-warning-soft border border-warning/30 rounded-lg px-3 py-1.5 mb-3">
                  <Zap size={12} /> Calculado automáticamente desde los ingredientes agregados
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-secondary block mb-1">Calorías (kcal)</label>
                  <input
                    type="number"
                    min={0}
                    value={calorias}
                    readOnly={hasLinked}
                    onChange={hasLinked ? undefined : setPositive(setCalorias)}
                    className={`w-full h-10 border rounded-xl px-3 text-sm focus:outline-none font-semibold ${
                      hasLinked
                        ? "border-warning/30 bg-warning-soft text-warning cursor-default"
                        : "border-border focus:border-primary font-normal"
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs text-secondary block mb-1">Porciones</label>
                  <input value={porciones} onChange={(e) => setPorciones(e.target.value)}
                    placeholder="Ej. 2 porciones"
                    className="w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
            </section>

            {/* Macronutrientes */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-text-primary">
                  5. Macronutrientes{hasLinked ? " (total receta)" : " (por porción)"}
                </p>
                {hasLinked && (
                  <span className="flex items-center gap-1 text-xs text-success bg-success-soft border border-success/30 px-2 py-0.5 rounded-full">
                    <Zap size={11} /> Auto
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-secondary block mb-1">Proteínas (g)</label>
                  <input type="number" min={0} step="0.1" value={proteinas}
                    readOnly={hasLinked}
                    onChange={hasLinked ? undefined : setPositive(setProteinas)}
                    className={`w-full h-10 border rounded-xl px-3 text-sm focus:outline-none font-semibold ${
                      hasLinked ? "border-red-200 bg-red-50 text-red-600 cursor-default" : "border-border focus:border-primary font-normal"
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs text-secondary block mb-1">Carbohidratos (g)</label>
                  <input type="number" min={0} step="0.1" value={carbohidratos}
                    readOnly={hasLinked}
                    onChange={hasLinked ? undefined : setPositive(setCarbohidratos)}
                    className={`w-full h-10 border rounded-xl px-3 text-sm focus:outline-none font-semibold ${
                      hasLinked ? "border-amber-200 bg-amber-50 text-amber-700 cursor-default" : "border-border focus:border-primary font-normal"
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs text-secondary block mb-1">Grasas (g)</label>
                  <input type="number" min={0} step="0.1" value={grasas}
                    readOnly={hasLinked}
                    onChange={hasLinked ? undefined : setPositive(setGrasas)}
                    className={`w-full h-10 border rounded-xl px-3 text-sm focus:outline-none font-semibold ${
                      hasLinked ? "border-purple-200 bg-purple-50 text-purple-600 cursor-default" : "border-border focus:border-primary font-normal"
                    }`}
                  />
                </div>
              </div>
            </section>

            {/* Preparación */}
            <ListEditor title="6. Preparación" items={pasos} setItems={setPasos} placeholder="Describe este paso..." numbered />
          </div>

          {/* ── Vista previa ── */}
          <div className="col-span-1">
            <div className="sticky top-0 bg-background-secondary rounded-2xl border border-border p-4">
              <p className="text-sm font-bold text-text-primary mb-4">Vista previa de la receta</p>

              <div className="h-32 bg-primary/5 rounded-xl flex items-center justify-center text-5xl mb-3 overflow-hidden">
                {fotoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoPreview} alt="Foto del platillo" className="w-full h-full object-cover" />
                ) : (
                  emoji || "🍽️"
                )}
              </div>

              <p className="font-bold text-text-primary text-sm mb-1">{nombre || "Nombre de la receta"}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{tipo}</span>
                <span className="text-xs bg-surface-muted text-secondary px-2 py-0.5 rounded-full">{categoria}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-secondary border-t border-divider pt-3">
                <span className="flex items-center gap-1"><BarChart3 size={12} /> {nivel}</span>
                <span className="flex items-center gap-1"><Flame size={12} /> {calorias || "—"} kcal</span>
                <span className="flex items-center gap-1"><UtensilsCrossed size={12} /> {porciones || "—"}</span>
              </div>

              {(proteinas || carbohidratos || grasas) && (
                <div className="mt-3 pt-3 border-t border-divider grid grid-cols-3 gap-1 text-center">
                  <div>
                    <p className="text-xs font-bold text-red-500">{proteinas || "—"}<span className="font-normal text-muted">g</span></p>
                    <p className="text-xs text-muted">Prot</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-600">{carbohidratos || "—"}<span className="font-normal text-muted">g</span></p>
                    <p className="text-xs text-muted">HCO</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-purple-500">{grasas || "—"}<span className="font-normal text-muted">g</span></p>
                    <p className="text-xs text-muted">Líp</p>
                  </div>
                </div>
              )}

              {hasLinked && (
                <p className="mt-3 flex items-center justify-center gap-1 text-xs text-center text-success bg-success-soft rounded-lg py-1">
                  <Zap size={12} /> {ingredientes.filter(i => i.alimento_id).length} ingrediente{ingredientes.filter(i => i.alimento_id).length !== 1 ? "s" : ""} del catálogo
                </p>
              )}

              {comparacionEquivalentes && comparacionEquivalentes.excedentes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-divider">
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    Hay {comparacionEquivalentes.excedentes.length} grupo{comparacionEquivalentes.excedentes.length !== 1 ? "s" : ""} excedente{comparacionEquivalentes.excedentes.length !== 1 ? "s" : ""}: {comparacionEquivalentes.excedentes.map((e) => `${e.grupo} (+${e.exceso})`).join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-divider">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 h-10 rounded-xl border border-border text-secondary text-sm hover:bg-background-secondary">
              Cancelar
            </button>
            {error && <p className="text-error text-sm">{error}</p>}
          </div>
          <button onClick={handleSave} disabled={saving || !nombre.trim()}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-60">
            {saving ? "Guardando..." : (<><Check size={15} /> {isEdit ? "Guardar cambios" : "Guardar receta"}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
