#!/usr/bin/env node
// Reconciliación histórica de suscripciones — Stripe es la fuente de verdad
// ACTUAL. No intenta reproducir eventos perdidos (stripe-webhook estuvo roto
// desde el commit 77307cf del 9 jul hasta el hotfix); en vez de eso, lee el
// estado REAL de cada Stripe Customer hoy y lo compara contra perfiles/
// suscripciones.
//
// Por defecto corre en modo DRY RUN — NO escribe nada, solo reporta. Para
// aplicar cambios hace falta pasar --apply explícitamente, y aun así solo
// se aplican los casos NO ambiguos (ver "casos que se excluyen" abajo).
//
// Uso:
//   node scripts/reconcile-stripe.mjs              # dry run (default)
//   node scripts/reconcile-stripe.mjs --apply       # aplica los cambios no ambiguos
//
// Variables de entorno requeridas:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
//   STRIPE_PRICE_BASICO, STRIPE_PRICE_PRO, STRIPE_PRICE_PREMIUM
//   (los mismos secrets ya usados por crear-checkout/stripe-webhook)
//
// Casos que se EXCLUYEN de --apply y quedan solo reportados para revisión
// manual (nunca se escriben, con o sin --apply):
//   - stripe_customer_id duplicado entre varios perfiles
//   - customer inexistente en Stripe / error al consultarlo
//   - múltiples suscripciones activas simultáneas para el mismo customer
//   - priceId que no coincide con STRIPE_PRICE_BASICO/PRO/PREMIUM
//
// Idempotente: correr --apply dos veces seguidas con el mismo estado real
// de Stripe produce el mismo resultado final (UPDATE por id, UPSERT por
// stripe_subscription_id) — no duplica ni corrompe nada. No borra ninguna
// fila de suscripciones ni de perfiles.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Falta variable de entorno requerida: ${name}`);
    process.exit(1);
  }
  return v;
}

const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));

const PRICE_ID_TO_PLAN = {
  [requireEnv('STRIPE_PRICE_BASICO')]: 'basico',
  [requireEnv('STRIPE_PRICE_PRO')]: 'pro',
  [requireEnv('STRIPE_PRICE_PREMIUM')]: 'premium',
};

function maskCustomerId(id) {
  if (!id) return '(none)';
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

async function main() {
  console.log(APPLY ? '=== MODO APPLY ===' : '=== MODO DRY RUN — no se escribe nada ===');
  console.log('');

  // ── 1. Perfiles con stripe_customer_id no nulo ──────────────────────────
  const { data: perfiles, error: perfilesError } = await supabase
    .from('perfiles')
    .select('id, stripe_customer_id, plan_membresia')
    .not('stripe_customer_id', 'is', null);

  if (perfilesError) {
    console.error('Error leyendo perfiles:', perfilesError);
    process.exit(1);
  }

  // ── 2. Detectar duplicados de stripe_customer_id ANTES de tocar nada ────
  const porCustomerId = new Map();
  for (const p of perfiles) {
    const arr = porCustomerId.get(p.stripe_customer_id) ?? [];
    arr.push(p);
    porCustomerId.set(p.stripe_customer_id, arr);
  }
  const duplicados = [...porCustomerId.entries()].filter(([, arr]) => arr.length > 1);

  if (duplicados.length > 0) {
    console.log('⚠ stripe_customer_id DUPLICADOS — requieren revisión manual, NUNCA se tocan por este script:');
    for (const [customerId, arr] of duplicados) {
      console.log(`  ${maskCustomerId(customerId)}: perfiles [${arr.map((p) => p.id).join(', ')}]`);
    }
    console.log('');
  }
  const idsDuplicados = new Set(duplicados.flatMap(([, arr]) => arr.map((p) => p.id)));

  // ── 3. Perfiles con plan pago pero SIN stripe_customer_id ───────────────
  const { data: perfilesSinCustomer, error: sinCustomerError } = await supabase
    .from('perfiles')
    .select('id, plan_membresia')
    .is('stripe_customer_id', null)
    .neq('plan_membresia', 'basico');

  if (sinCustomerError) {
    console.error('Error leyendo perfiles sin customer:', sinCustomerError);
  } else if (perfilesSinCustomer.length > 0) {
    console.log('⚠ Perfiles con plan pago pero SIN stripe_customer_id — requieren revisión manual:');
    for (const p of perfilesSinCustomer) {
      console.log(`  perfil=${p.id} plan_membresia=${p.plan_membresia}`);
    }
    console.log('');
  }

  // ── 4. suscripciones huérfanas (sin perfil real) — solo diagnóstico ─────
  const { data: suscripcionesHuerfanas, error: huerfanasError } = await supabase
    .from('suscripciones')
    .select('id, user_id, stripe_subscription_id')
    .not('user_id', 'in', `(${perfiles.map((p) => `"${p.id}"`).join(',') || 'null'})`);

  if (!huerfanasError && suscripcionesHuerfanas?.length > 0) {
    console.log('⚠ Registros de suscripciones sin perfil correspondiente — revisión manual:');
    for (const s of suscripcionesHuerfanas) {
      console.log(`  suscripcion=${s.id} user_id=${s.user_id} stripe_subscription_id=${s.stripe_subscription_id}`);
    }
    console.log('');
  }

  // ── 5. Recorrer cada perfil (excepto duplicados) y comparar contra Stripe ─
  const reporte = [];

  for (const perfil of perfiles) {
    if (idsDuplicados.has(perfil.id)) continue; // ya reportado arriba

    let subs;
    try {
      subs = await stripe.subscriptions.list({ customer: perfil.stripe_customer_id, status: 'all', limit: 10 });
    } catch (err) {
      reporte.push({
        perfil: perfil.id,
        customer: maskCustomerId(perfil.stripe_customer_id),
        estadoDbActual: perfil.plan_membresia,
        estadoStripeActual: `ERROR: ${err.message}`,
        cambioPropuesto: '(ninguno)',
        accion: 'REVISIÓN MANUAL — customer inexistente o error de Stripe',
      });
      continue;
    }

    const activas = subs.data.filter((s) => ['active', 'trialing'].includes(s.status));

    if (activas.length > 1) {
      reporte.push({
        perfil: perfil.id,
        customer: maskCustomerId(perfil.stripe_customer_id),
        estadoDbActual: perfil.plan_membresia,
        estadoStripeActual: `${activas.length} suscripciones activas simultáneas`,
        cambioPropuesto: '(ninguno)',
        accion: 'REVISIÓN MANUAL — múltiples suscripciones activas',
      });
      continue;
    }

    const subscription = activas[0] ?? subs.data[0] ?? null;

    let statusReal = 'sin_suscripcion';
    let priceIdReal = null;
    let planReal = 'basico';

    if (subscription) {
      statusReal = subscription.status;
      priceIdReal = subscription.items.data[0]?.price?.id ?? null;
      const esActiva = ['active', 'trialing'].includes(statusReal);

      if (priceIdReal && !PRICE_ID_TO_PLAN[priceIdReal]) {
        reporte.push({
          perfil: perfil.id,
          customer: maskCustomerId(perfil.stripe_customer_id),
          estadoDbActual: perfil.plan_membresia,
          estadoStripeActual: `status=${statusReal} price=${priceIdReal}`,
          cambioPropuesto: '(ninguno)',
          accion: `REVISIÓN MANUAL — priceId desconocido: ${priceIdReal}`,
        });
        continue;
      }

      planReal = esActiva ? (PRICE_ID_TO_PLAN[priceIdReal] ?? 'basico') : 'basico';
    }

    const cambio = planReal !== perfil.plan_membresia;

    reporte.push({
      perfil: perfil.id,
      customer: maskCustomerId(perfil.stripe_customer_id),
      estadoDbActual: perfil.plan_membresia,
      estadoStripeActual: `status=${statusReal} price=${priceIdReal ?? '(ninguno)'}`,
      cambioPropuesto: cambio ? `${perfil.plan_membresia} -> ${planReal}` : '(sin cambio)',
      accion: cambio ? (APPLY ? 'APLICANDO' : 'PENDIENTE (dry run)') : 'OK — sin diferencia',
      _apply: cambio ? { perfilId: perfil.id, nuevoPlan: planReal, subscription } : null,
    });
  }

  // ── 6. Reporte completo ──────────────────────────────────────────────────
  console.log('=== REPORTE POR PERFIL ===');
  for (const r of reporte) {
    const { _apply, ...visible } = r;
    console.log(JSON.stringify(visible));
  }

  const pendientes = reporte.filter((r) => r._apply);
  const revisionManual = reporte.filter((r) => r.accion.startsWith('REVISIÓN MANUAL'));

  console.log('');
  console.log('=== RESUMEN ===');
  console.log(`Perfiles con stripe_customer_id evaluados: ${perfiles.length}`);
  console.log(`Duplicados de customer_id (excluidos, sin tocar): ${idsDuplicados.size}`);
  console.log(`Casos que requieren revisión manual: ${revisionManual.length}`);
  console.log(`Cambios detectados (no ambiguos): ${pendientes.length}`);

  if (!APPLY) {
    console.log('');
    console.log('DRY RUN — no se escribió nada. Revisa el reporte de arriba y corre con --apply');
    console.log('cuando estés de acuerdo con los cambios listados como PENDIENTE.');
    return;
  }

  // ── 7. APPLY — solo casos no ambiguos, idempotente ──────────────────────
  console.log('');
  console.log('=== APLICANDO CAMBIOS ===');
  for (const r of pendientes) {
    const { perfilId, nuevoPlan, subscription } = r._apply;

    const { error: updateError } = await supabase
      .from('perfiles')
      .update({ plan_membresia: nuevoPlan })
      .eq('id', perfilId);

    if (updateError) {
      console.error(`✗ Error actualizando perfil ${perfilId}:`, updateError);
      continue;
    }

    if (subscription) {
      const { error: upsertError } = await supabase.from('suscripciones').upsert(
        {
          user_id: perfilId,
          stripe_subscription_id: subscription.id,
          stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
          status: subscription.status,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
        },
        { onConflict: 'stripe_subscription_id' },
      );

      if (upsertError) {
        console.error(`✗ Error actualizando suscripciones para perfil ${perfilId}:`, upsertError);
        continue;
      }
    }

    console.log(`✓ perfil=${perfilId} plan_membresia -> ${nuevoPlan}`);
  }
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
