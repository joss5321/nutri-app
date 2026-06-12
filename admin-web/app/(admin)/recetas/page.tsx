"use client";
import { useState } from "react";

const RECIPES = [
  { id: 1,  emoji: "🍗", name: "Pechuga de pollo a la plancha con quinoa",  cat: "Almuerzo",  level: "Fácil",  time: 30, kcal: 420, tag: "Alta en proteína",     ingredients: [{ item: "Pechuga de pollo", qty: "2 unidades (200g)" }, { item: "Quinoa", qty: "1 taza (185g)" }, { item: "Brócoli", qty: "1 taza (100g)" }, { item: "Zanahoria", qty: "1 unidad (100g)" }, { item: "Pimiento rojo", qty: "1/2 unidad (75g)" }, { item: "Aceite de oliva", qty: "1 cucharada (15ml)" }, { item: "Sal y pimienta", qty: "Al gusto" }], macros: { proteinas: 38, carbos: 32, grasas: 12 }, prepTime: 15, cookTime: 15, tipo: "Desayuno", catNutri: "Alta en proteína" },
  { id: 2,  emoji: "🥣", name: "Avena con frutas y almendras",              cat: "Desayuno",  level: "Fácil",  time: 15, kcal: 320, tag: "Alta en fibra",        ingredients: [{ item: "Avena", qty: "1 taza" }, { item: "Leche descremada", qty: "200ml" }, { item: "Plátano", qty: "1 pieza" }, { item: "Almendras", qty: "20g" }, { item: "Miel", qty: "1 cdta" }], macros: { proteinas: 12, carbos: 58, grasas: 8 }, prepTime: 5, cookTime: 10, tipo: "Desayuno", catNutri: "Alta en fibra" },
  { id: 3,  emoji: "🐟", name: "Salmón al horno con batata y espárragos",   cat: "Almuerzo",  level: "Media", time: 40, kcal: 520, tag: "Omega 3",             ingredients: [{ item: "Filete de salmón", qty: "180g" }, { item: "Batata", qty: "150g" }, { item: "Espárragos", qty: "100g" }, { item: "Aceite de oliva", qty: "2 cdas" }, { item: "Limón", qty: "1 pieza" }], macros: { proteinas: 42, carbos: 35, grasas: 18 }, prepTime: 10, cookTime: 30, tipo: "Almuerzo", catNutri: "Omega 3" },
  { id: 4,  emoji: "🥗", name: "Ensalada de atún con aguacate",             cat: "Almuerzo",  level: "Fácil",  time: 20, kcal: 380, tag: "Rica en grasas saludables", ingredients: [{ item: "Atún en agua", qty: "1 lata (150g)" }, { item: "Aguacate", qty: "1/2 pieza" }, { item: "Lechuga", qty: "2 tazas" }, { item: "Tomate", qty: "1 pieza" }, { item: "Limón", qty: "1 pieza" }], macros: { proteinas: 30, carbos: 15, grasas: 22 }, prepTime: 20, cookTime: 0, tipo: "Almuerzo", catNutri: "Grasas saludables" },
  { id: 5,  emoji: "🥩", name: "Carne magra salteada con arroz integral",   cat: "Cena",      level: "Media", time: 25, kcal: 450, tag: "Alta en proteína",     ingredients: [{ item: "Carne magra", qty: "150g" }, { item: "Arroz integral", qty: "1/2 taza" }, { item: "Pimiento", qty: "1 pieza" }, { item: "Cebolla", qty: "1/4 pieza" }, { item: "Aceite", qty: "1 cdta" }], macros: { proteinas: 35, carbos: 45, grasas: 10 }, prepTime: 10, cookTime: 15, tipo: "Cena", catNutri: "Alta en proteína" },
  { id: 6,  emoji: "🥤", name: "Batido de proteína con frutos rojos",       cat: "Snack",     level: "Fácil",  time: 10, kcal: 250, tag: "Proteico",           ingredients: [{ item: "Proteína en polvo", qty: "1 medida (30g)" }, { item: "Frutos rojos", qty: "1/2 taza" }, { item: "Leche descremada", qty: "200ml" }, { item: "Hielo", qty: "Al gusto" }], macros: { proteinas: 28, carbos: 20, grasas: 4 }, prepTime: 10, cookTime: 0, tipo: "Snack", catNutri: "Proteico" },
];

type Recipe = typeof RECIPES[number];

function RecipeDetail({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const [tab, setTab] = useState<"ing" | "prep" | "info">("ing");

  return (
    <div className="w-96 shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base leading-snug">{recipe.name}</p>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium inline-block mt-1">{recipe.cat}</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 text-lg">×</button>
      </div>

      {/* Hero */}
      <div className="h-40 bg-primary/5 flex items-center justify-center text-6xl shrink-0">
        {recipe.emoji}
      </div>

      {/* Quick info */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 text-xs text-gray-500">
        <span>⏱ {recipe.time} min</span>
        <span>📊 {recipe.level}</span>
        <span>🔥 {recipe.kcal} kcal</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-100">
        <button className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50">
          ✏️ Editar
        </button>
        <button className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50">
          📋 Duplicar
        </button>
        <button className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50">
          🗑 Eliminar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-4">
        {([["ing", "Ingredientes"], ["prep", "Preparación"], ["info", "Info nutricional"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`py-3 px-2 text-xs font-semibold border-b-2 transition-colors ${
              tab === key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 flex-1">
        {tab === "ing" && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-3">Ingredientes (2 porciones)</p>
            <div className="flex flex-col gap-2">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="accent-primary" />
                    <span className="text-sm text-gray-700">{ing.item}</span>
                  </div>
                  <span className="text-xs text-gray-500">{ing.qty}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "prep" && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-3">Pasos de preparación</p>
            <div className="flex flex-col gap-3">
              {["Lava y corta todos los ingredientes.", "Calienta el aceite a fuego medio.", "Cocina la proteína 8-10 minutos por lado.", "Agrega las verduras y saltea 5 minutos.", "Sirve caliente y condimenta al gusto."].map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
                  <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "info" && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">Macronutrientes (por porción)</p>
              {[
                { label: "Proteínas",     value: recipe.macros.proteinas, unit: "g", color: "bg-primary"  },
                { label: "Carbohidratos", value: recipe.macros.carbos,    unit: "g", color: "bg-blue-400" },
                { label: "Grasas",        value: recipe.macros.grasas,    unit: "g", color: "bg-yellow-400" },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${m.color} shrink-0`} />
                  <span className="text-sm text-gray-700 flex-1">{m.label}</span>
                  <span className="text-sm font-bold text-gray-900">{m.value}{m.unit}</span>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-bold text-gray-700 mb-2">Información adicional</p>
              {[
                { label: "Dificultad",          value: recipe.level      },
                { label: "Tiempo de preparación", value: `${recipe.prepTime} min` },
                { label: "Tiempo de cocción",   value: `${recipe.cookTime} min` },
                { label: "Tipo de comida",      value: recipe.tipo       },
                { label: "Categoría",           value: recipe.catNutri   },
              ].map((r) => (
                <div key={r.label} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
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

export default function RecetasPage() {
  const [search, setSearch]         = useState("");
  const [cat, setCat]               = useState("Todas");
  const [tipo, setTipo]             = useState("Todas");
  const [dif, setDif]               = useState("Todas");
  const [selected, setSelected]     = useState<Recipe | null>(null);

  const filtered = RECIPES.filter((r) => {
    const matchSearch = search === "" || r.name.toLowerCase().includes(search.toLowerCase());
    const matchCat    = cat  === "Todas" || r.catNutri.toLowerCase().includes(cat.toLowerCase());
    const matchTipo   = tipo === "Todas" || r.tipo === tipo;
    const matchDif    = dif  === "Todas" || r.level === dif;
    return matchSearch && matchCat && matchTipo && matchDif;
  });

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
            <p className="text-gray-500 text-sm mt-1">Gestiona y crea recetas saludables para tus planes nutricionales.</p>
          </div>
          <button className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors">
            + Nueva receta
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 h-10 shadow-sm">
            <span className="text-gray-400 text-sm">🔍</span>
            <input placeholder="Buscar recetas..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-40 text-sm focus:outline-none text-gray-700" />
          </div>
          {[
            { label: "Categoría", value: cat, set: setCat, options: ["Todas", "Proteína", "Fibra", "Omega 3", "Grasas saludables"] },
            { label: "Tipo",      value: tipo, set: setTipo, options: ["Todas", "Desayuno", "Almuerzo", "Cena", "Snack"] },
            { label: "Dificultad",value: dif,  set: setDif,  options: ["Todas", "Fácil", "Media", "Difícil"] },
          ].map((f) => (
            <div key={f.label} className="flex flex-col">
              <label className="text-xs text-gray-400 font-medium mb-0.5 ml-1">{f.label}</label>
              <select value={f.value} onChange={(e) => f.set(e.target.value)}
                className="h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary bg-white shadow-sm">
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div className="flex flex-col">
            <label className="text-xs text-gray-400 font-medium mb-0.5 ml-1">Ordenar por</label>
            <select className="h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-primary bg-white shadow-sm">
              <option>Más recientes</option>
              <option>Nombre A-Z</option>
              <option>Calorías</option>
            </select>
          </div>
          <button className="flex items-center gap-1 h-10 px-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 self-end shadow-sm">
            ⚙ Filtros
          </button>
        </div>

        {/* Counter */}
        <p className="text-sm text-gray-500 mb-4">
          <span className="font-semibold text-gray-900">{filtered.length}</span> recetas encontradas
        </p>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-5">
          {filtered.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelected(r.id === selected?.id ? null : r)}
              className={`bg-white rounded-2xl border overflow-hidden cursor-pointer hover:shadow-md transition-all ${
                selected?.id === r.id ? "border-primary shadow-md" : "border-gray-200"
              }`}
            >
              {/* Image */}
              <div className="relative h-40 bg-primary/5 flex items-center justify-center">
                <span className="text-5xl">{r.emoji}</span>
                <span className="absolute top-2 left-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full font-semibold">
                  {r.cat}
                </span>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors"
                >
                  ♡
                </button>
              </div>

              <div className="p-4">
                <p className="font-semibold text-gray-900 text-sm leading-snug mb-2">{r.name}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                  <span>⏱ {r.time} min</span>
                  <span>📊 {r.level}</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{r.kcal} kcal</p>
                <span className="mt-2 inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {r.tag}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-1 mt-8">
          <button className="w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 text-xs">‹</button>
          {[1, 2, 3].map((p) => (
            <button key={p} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
              p === 1 ? "bg-primary text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>{p}</button>
          ))}
          <button className="w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 text-xs">›</button>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <RecipeDetail recipe={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
