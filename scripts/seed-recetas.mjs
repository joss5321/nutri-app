#!/usr/bin/env node
// Reemplaza a supabase/seed_recetas.sql (retirado — ver H1 del barrido
// final de auditoría). El script viejo hacía
// "DELETE FROM recetas WHERE user_id IS NULL" + reinserción completa del
// catálogo con IDs nuevos en cada corrida: cualquier receta_guardada de un
// paciente real que apuntara a una receta de catálogo se perdía en cascada
// (recetas_guardadas.receta_id → recetas(id) on delete cascade), sin forma
// de reconciliar después porque los IDs nunca se preservaban.
//
// Este script hace upsert por (nombre, tipo) en vez de borrar todo:
//   - receta existente (mismo nombre+tipo, user_id IS NULL) → se actualiza
//     IN PLACE (mismo id, misma fila) vía la RPC atómica
//     actualizar_receta_completa (Sección 59) — recetas_guardadas y
//     receta_base_id que ya apuntan a ella sobreviven intactos.
//   - receta nueva (nombre+tipo sin match) → se inserta vía la RPC atómica
//     crear_receta_completa (Sección 63).
//   - receta en la base que ya NO está en la fuente → NUNCA se borra
//     automáticamente. Solo se reporta (id, nombre, cuántas
//     recetas_guardadas y personalizaciones la referencian) para que la
//     eliminación, si alguna vez hace falta, sea una decisión humana
//     explícita y separada.
//
// (nombre, tipo) como llave compuesta fue una decisión explícita tras
// encontrar "Ceviche de atún" duplicado por nombre en la fuente original
// (una vez como Comida, otra como Cena) — confirmado en producción que no
// hay ningún otro duplicado por (nombre, tipo). Aun así, este script
// vuelve a verificar duplicados en cada corrida (tanto en la fuente como
// en la base real) antes de cualquier --apply, por si se agrega contenido
// ambiguo en el futuro.
//
// Por defecto corre en modo DRY RUN — NO escribe nada, solo reporta. Para
// aplicar cambios hace falta pasar --apply explícitamente, y aun así la
// operación completa se bloquea (cero escrituras) si existe cualquier
// duplicado por (nombre, tipo) en la base de datos.
//
// Uso:
//   node scripts/seed-recetas.mjs              # dry run (default)
//   node scripts/seed-recetas.mjs --apply       # aplica los cambios
//
// Variables de entorno requeridas (sin defaults inseguros):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Contenido del catálogo versionado en scripts/recetas-catalogo.json
// (migrado 1:1 desde supabase/seed_recetas.sql — mismo texto exacto de
// nombres/ingredientes/pasos, mismas cantidades/unidades numéricas de la
// v2). Edita ese archivo para agregar/corregir recetas del mismo PDF.
//
// Campos que este script NO gestiona (calorias, proteinas_g,
// carbohidratos_g, grasas_g, categoria_nutricional, tags,
// tiempo_prep_min, tiempo_coccion_min, tiempo_min) se preservan tal cual
// estén en la base al actualizar una receta existente — son calculados
// por la función de "vinculación asistida" (ligar cada ingrediente a un
// alimento del catálogo) desde la UI de admin-web, un flujo totalmente
// separado de este seed. Sobreescribirlos con NULL en cada corrida
// borraría ese trabajo silenciosamente.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Falta variable de entorno requerida: ${name}`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));

const CAMPOS_PRESERVADOS = [
  'categoria_nutricional', 'tags', 'tiempo_prep_min', 'tiempo_coccion_min',
  'tiempo_min', 'calorias', 'proteinas_g', 'carbohidratos_g', 'grasas_g',
];

function clave(nombre, tipo) {
  return `${nombre} ${tipo}`;
}

function agruparPorClave(rows, nombreKey, tipoKey) {
  const map = new Map();
  for (const r of rows) {
    const k = clave(r[nombreKey], r[tipoKey]);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

async function main() {
  console.log(APPLY ? '=== MODO APPLY ===' : '=== MODO DRY RUN — no se escribe nada ===');
  console.log('');

  const fuente = JSON.parse(readFileSync(join(__dirname, 'recetas-catalogo.json'), 'utf8'));

  // ── 1. Duplicados dentro de la FUENTE (defensivo) ───────────────────────
  const porClaveFuente = agruparPorClave(fuente, 'nombre', 'tipo');
  const duplicadosFuente = [...porClaveFuente.entries()].filter(([, arr]) => arr.length > 1);
  if (duplicadosFuente.length > 0) {
    console.error('✗ Duplicados por (nombre, tipo) DENTRO de recetas-catalogo.json — corrígelos antes de continuar:');
    for (const [, arr] of duplicadosFuente) {
      console.error(`  "${arr[0].nombre}" / ${arr[0].tipo} (${arr.length} veces en la fuente)`);
    }
    process.exit(1);
  }

  // ── 2. Catálogo real actual (todos los campos relevantes en una sola
  // consulta, para no hacer una query extra por receta al actualizar) ─────
  const { data: existentes, error: fetchError } = await supabase
    .from('recetas')
    .select(`id, nombre, tipo, ${CAMPOS_PRESERVADOS.join(', ')}`)
    .is('user_id', null);

  if (fetchError) {
    console.error('Error leyendo el catálogo actual:', fetchError.message);
    process.exitCode = 1;
    return;
  }

  // ── 3. Duplicados en la BASE DE DATOS por (nombre, tipo) ────────────────
  const porClaveDb = agruparPorClave(existentes, 'nombre', 'tipo');
  const duplicadosDb = [...porClaveDb.entries()].filter(([, arr]) => arr.length > 1);
  const porClaveDbUnica = new Map();
  for (const [k, arr] of porClaveDb) {
    if (arr.length === 1) porClaveDbUnica.set(k, arr[0]);
  }

  // ── 4. Plan: actualizar (match seguro) vs crear (sin match) ─────────────
  const aActualizar = [];
  const aCrear = [];
  for (const r of fuente) {
    const match = porClaveDbUnica.get(clave(r.nombre, r.tipo));
    if (match) aActualizar.push({ fuente: r, existente: match });
    else aCrear.push(r);
  }

  // ── 5. Recetas en la BD que ya NO están en la fuente — nunca se borran,
  // solo se reportan con su blast radius real. ────────────────────────────
  const clavesFuente = new Set(fuente.map((r) => clave(r.nombre, r.tipo)));
  const ausentes = existentes.filter((r) => !clavesFuente.has(clave(r.nombre, r.tipo)));

  let ausentesConDetalle = [];
  if (ausentes.length > 0) {
    const ids = ausentes.map((r) => r.id);
    const { data: guardadas } = await supabase.from('recetas_guardadas').select('receta_id').in('receta_id', ids);
    const { data: personalizadas } = await supabase.from('recetas').select('receta_base_id').in('receta_base_id', ids);

    const countGuardadas = new Map();
    for (const g of guardadas ?? []) countGuardadas.set(g.receta_id, (countGuardadas.get(g.receta_id) ?? 0) + 1);
    const countPersonalizadas = new Map();
    for (const p of personalizadas ?? []) countPersonalizadas.set(p.receta_base_id, (countPersonalizadas.get(p.receta_base_id) ?? 0) + 1);

    ausentesConDetalle = ausentes.map((r) => ({
      ...r,
      recetas_guardadas: countGuardadas.get(r.id) ?? 0,
      personalizaciones: countPersonalizadas.get(r.id) ?? 0,
    }));
  }

  // ── 6. Reporte ────────────────────────────────────────────────────────
  console.log('=== REPORTE ===');
  console.log(`Recetas fuente totales: ${fuente.length}`);
  console.log(`Existentes sin cambios de identidad (mismo nombre+tipo, se actualizan in-place): ${aActualizar.length}`);
  console.log(`Nuevas que se crearían: ${aCrear.length}`);
  console.log(`Recetas en BD ausentes de la fuente (NUNCA se borran automáticamente): ${ausentesConDetalle.length}`);
  for (const r of ausentesConDetalle) {
    console.log(`  id=${r.id} nombre="${r.nombre}" tipo=${r.tipo} recetas_guardadas=${r.recetas_guardadas} personalizaciones=${r.personalizaciones}`);
  }

  if (duplicadosDb.length > 0) {
    console.log('');
    console.log('⚠ AMBIGÜEDAD — duplicados por (nombre, tipo) en la base de datos real:');
    for (const [, arr] of duplicadosDb) {
      console.log(`  "${arr[0].nombre}" / ${arr[0].tipo} -> ids [${arr.map((a) => a.id).join(', ')}]`);
    }
    console.log('Estas recetas quedan excluidas del matching automático (ninguna de las dos se toca).');
  }

  console.log('');
  console.log('=== ERRORES / AMBIGÜEDADES ===');
  console.log(`Duplicados en la fuente: ${duplicadosFuente.length}`);
  console.log(`Duplicados en la base de datos: ${duplicadosDb.length}`);

  if (!APPLY) {
    console.log('');
    console.log('DRY RUN — no se escribió nada.');
    console.log(
      duplicadosDb.length > 0
        ? 'Si corrieras --apply ahora, la operación completa sería BLOQUEADA por los duplicados de arriba (cero escrituras).'
        : 'Corre con --apply para aplicar los cambios listados.'
    );
    return;
  }

  // ── 7. Gate de --apply: cualquier duplicado bloquea TODO, cero escrituras.
  if (duplicadosDb.length > 0) {
    console.error('');
    console.error('✗ APPLY BLOCKED — existen duplicados por (nombre, tipo) en la base de datos.');
    console.error('  Resuélvelos manualmente antes de volver a correr --apply. Cero escrituras realizadas.');
    process.exitCode = 1;
    return;
  }

  // ── 8. Aplicar — cada receta es una llamada RPC atómica (Secciones 59/63),
  // nunca un delete+insert manual desde Node. ──────────────────────────────
  console.log('');
  console.log('=== APLICANDO CAMBIOS ===');
  let erroresActualizar = 0;
  let erroresCrear = 0;

  for (const { fuente: r, existente } of aActualizar) {
    const { error } = await supabase.rpc('actualizar_receta_completa', {
      p_receta_id: existente.id,
      p_nombre: r.nombre,
      p_emoji: r.emoji,
      p_tipo: r.tipo,
      p_categoria_nutricional: existente.categoria_nutricional,
      p_tags: existente.tags,
      p_tiempo_prep_min: existente.tiempo_prep_min,
      p_tiempo_coccion_min: existente.tiempo_coccion_min,
      p_tiempo_min: existente.tiempo_min,
      p_nivel: r.nivel,
      p_calorias: existente.calorias,
      p_porciones: r.porciones,
      p_proteinas_g: existente.proteinas_g,
      p_carbohidratos_g: existente.carbohidratos_g,
      p_grasas_g: existente.grasas_g,
      p_ingredientes: r.ingredientes,
      p_pasos: r.pasos,
    });
    if (error) {
      console.error(`✗ Error actualizando "${r.nombre}" (${r.tipo}) [id=${existente.id}]:`, error.message);
      erroresActualizar++;
      continue;
    }
    console.log(`✓ actualizada: ${r.nombre} (${r.tipo}) [id=${existente.id}]`);
  }

  for (const r of aCrear) {
    const { data: nuevoId, error } = await supabase.rpc('crear_receta_completa', {
      p_user_id: null,
      p_nombre: r.nombre,
      p_emoji: r.emoji,
      p_tipo: r.tipo,
      p_categoria_nutricional: null,
      p_tags: null,
      p_tiempo_prep_min: null,
      p_tiempo_coccion_min: null,
      p_tiempo_min: null,
      p_nivel: r.nivel,
      p_calorias: null,
      p_porciones: r.porciones,
      p_proteinas_g: null,
      p_carbohidratos_g: null,
      p_grasas_g: null,
      p_ingredientes: r.ingredientes,
      p_pasos: r.pasos,
    });
    if (error) {
      console.error(`✗ Error creando "${r.nombre}" (${r.tipo}):`, error.message);
      erroresCrear++;
      continue;
    }
    console.log(`✓ creada: ${r.nombre} (${r.tipo}) [id=${nuevoId}]`);
  }

  const totalErrores = erroresActualizar + erroresCrear;
  console.log('');
  console.log(
    `=== RESUMEN: ${aActualizar.length - erroresActualizar} actualizadas, ` +
    `${aCrear.length - erroresCrear} creadas, ${totalErrores} errores ===`
  );
  if (totalErrores > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exitCode = 1;
});
