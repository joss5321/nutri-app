#!/usr/bin/env node
// Prueba de renovación de suscripción usando Stripe Test Clocks — SOLO modo
// test. Simula el paso del tiempo para forzar el ciclo de facturación
// siguiente sin esperar un mes real, y confirma que Stripe emite la
// renovación correctamente (y, si se le pasa --customer, que el webhook
// desplegado reacciona sobre un perfil real de prueba).
//
// No usa el SDK de stripe (evita instalar una dependencia nueva solo para
// esto) — llama directo a la API REST de Stripe con fetch, nativo en
// Node 20+.
//
// USO:
//   STRIPE_SECRET_KEY=sk_test_... node scripts/test-stripe-renewal.mjs --price=price_xxx
//
// La clave se lee SOLO de la variable de entorno, nunca como argumento ni
// hardcodeada — así nunca queda en el historial de shell ni en un commit.
// Dónde configurar la clave de prueba (nunca pegarla en el chat):
//   - Local: exportarla en tu shell antes de correr este script
//     (ej. en PowerShell: $env:STRIPE_SECRET_KEY = "sk_test_...").
//   - Ya existe un STRIPE_SECRET_KEY en los secrets de Supabase
//     (supabase secrets list), pero ese es el que usan las Edge Functions
//     en producción — para esta prueba usa tu propia clave de TEST desde
//     el Dashboard de Stripe (Developers → API keys, con el toggle
//     "Test mode" activado), nunca la de producción aunque también sea
//     de test, para no mezclar datos de prueba con los reales.
//
// Flags:
//   --price=price_xxx   (requerido) un Price ID de modo test de tu cuenta
//                        de Stripe (Dashboard → Products, en Test mode).
//   --customer=cus_xxx  (opcional) un Customer ID real de un perfil de
//                        prueba (perfiles.stripe_customer_id) ya creado
//                        vía el flujo real de Checkout en test. Si se
//                        pasa, la renovación simulada SÍ disparará el
//                        webhook desplegado sobre ese perfil real — revisa
//                        perfiles.plan_membresia en Supabase después de
//                        correr el script para confirmar el efecto real.
//                        Si se omite, el script crea un customer
//                        descartable solo para probar el mecanismo de
//                        Test Clocks en sí (no toca ningún perfil real).

const API = "https://api.stripe.com/v1"

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=")
      return [k, v ?? "true"]
    }),
  )
  return args
}

function assertTestKey(key) {
  if (!key) {
    console.error("Falta STRIPE_SECRET_KEY en el entorno. No se puede continuar.")
    process.exit(1)
  }
  if (!key.startsWith("sk_test_")) {
    console.error(
      "STRIPE_SECRET_KEY no empieza con 'sk_test_' — esto parece una clave " +
        "LIVE o inválida. Este script se niega a correr para no arriesgar " +
        "cobros reales. Usa una clave de modo test del Dashboard de Stripe.",
    )
    process.exit(1)
  }
}

async function stripe(key, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Stripe API ${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`)
  }
  return json
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function esperarFacturaPagada(key, subscriptionId, intentos = 10) {
  for (let i = 0; i < intentos; i++) {
    const invoices = await stripe(key, "GET", `/invoices?subscription=${subscriptionId}&limit=3`)
    const pagada = invoices.data.find((inv) => inv.status === "paid")
    if (pagada) return pagada
    console.log(`  (esperando factura pagada, intento ${i + 1}/${intentos}...)`)
    await sleep(3000)
  }
  return null
}

async function main() {
  const args = parseArgs()
  const key = process.env.STRIPE_SECRET_KEY
  assertTestKey(key)

  if (!args.price) {
    console.error("Falta --price=price_xxx (un Price ID de modo test). Ver comentario de cabecera del script.")
    process.exit(1)
  }

  console.log("1) Creando Test Clock...")
  const ahora = Math.floor(Date.now() / 1000)
  const clock = await stripe(key, "POST", "/test_helpers/test_clocks", {
    frozen_time: String(ahora),
    name: `prueba-renovacion-${new Date().toISOString()}`,
  })
  console.log(`   clock=${clock.id}`)

  let customerId = args.customer
  let customerEsDescartable = false
  if (!customerId) {
    console.log("2) No se pasó --customer: creando customer descartable ligado al clock...")
    const customer = await stripe(key, "POST", "/customers", {
      test_clock: clock.id,
      email: `prueba-renovacion+${ahora}@example.com`,
      "payment_method": "pm_card_visa",
      "invoice_settings[default_payment_method]": "pm_card_visa",
    })
    customerId = customer.id
    customerEsDescartable = true
    console.log(`   customer descartable=${customerId}`)
  } else {
    console.log(`2) Usando customer real existente: ${customerId}`)
    console.log("   NOTA: este customer debe estar ya ligado al mismo Test Clock")
    console.log("   o la suscripción de prueba fallará. Si no sabes cómo ligarlo,")
    console.log("   usa el script sin --customer para una prueba aislada primero.")
  }

  console.log("3) Creando suscripción de prueba...")
  const sub = await stripe(key, "POST", "/subscriptions", {
    customer: customerId,
    "items[0][price]": args.price,
    "payment_behavior": "default_incomplete",
    "payment_settings[payment_method_types][0]": "card",
    "payment_settings[save_default_payment_method]": "on_subscription",
    "expand[0]": "latest_invoice.payment_intent",
  })
  console.log(`   subscription=${sub.id} status=${sub.status}`)

  console.log("4) Adelantando el Test Clock al siguiente periodo de facturación...")
  const siguientePeriodo = sub.current_period_end ?? ahora + 31 * 24 * 60 * 60
  await stripe(key, "POST", `/test_helpers/test_clocks/${clock.id}/advance`, {
    frozen_time: String(siguientePeriodo + 3600),
  })

  console.log("5) Esperando a que Stripe procese la renovación y emita factura...")
  await sleep(5000)
  const factura = await esperarFacturaPagada(key, sub.id)
  if (factura) {
    console.log(`\n✔ Renovación confirmada: factura ${factura.id} pagada (${factura.amount_paid / 100} ${factura.currency}).`)
    if (args.customer) {
      console.log(
        "  Como usaste un customer real, revisa ahora en Supabase que " +
          "perfiles.plan_membresia siga correcto para ese perfil (el " +
          "webhook stripe-webhook debió procesar el evento invoice.paid / " +
          "customer.subscription.updated) y que el registro en " +
          "stripe_webhook_events (Sección 89) tenga una fila nueva.",
      )
    }
  } else {
    console.log("\n✘ No se detectó una factura pagada tras varios intentos — revisa el Dashboard de Stripe (Test mode → Customers → el customer de prueba) para ver qué pasó.")
  }

  console.log("\n6) Limpieza...")
  if (customerEsDescartable) {
    await stripe(key, "DELETE", `/customers/${customerId}`).catch(() => {})
    console.log(`   customer descartable ${customerId} eliminado.`)
  } else {
    console.log(`   customer real ${customerId} NO se elimina (no es descartable). Cancela la suscripción manualmente si ya no la necesitas.`)
  }
  await stripe(key, "DELETE", `/test_helpers/test_clocks/${clock.id}`).catch(() => {})
  console.log(`   test clock ${clock.id} eliminado.`)
}

main().catch((err) => {
  console.error("\nError:", err.message)
  process.exit(1)
})
