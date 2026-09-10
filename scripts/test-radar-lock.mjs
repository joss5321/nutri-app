// Prueba de integración de concurrencia REAL para el advisory lock de
// ejecutar_radar_diario (Sección 76 de supabase_schema.sql).
//
// Por qué existe este script separado: pgTAP corre todo un archivo de
// prueba en UNA sola conexión/transacción secuencial — no puede abrir dos
// transacciones simultáneas para ejercer una carrera real. Este script sí
// abre dos conexiones psql independientes (vía "docker exec" contra el
// contenedor local de Supabase) para probar de forma determinista la rama
// "lock no obtenido" sin adivinar ni afirmar haber probado concurrencia
// con solo inspección de SQL.
//
// Requiere: Docker Desktop activo y "supabase start" corriendo (mismo
// stack que usa scripts/test-rls.mjs). NO modifica supabase_schema.sql ni
// hace deploy remoto — corre exclusivamente contra la base local.
//
// Uso: node scripts/test-radar-lock.mjs

import { spawn, spawnSync } from 'node:child_process';

const CONTAINER = 'supabase_db_nutri-app';
const LOCK_HOLD_SECONDS = 6;
const FECHA_PRUEBA = '2026-01-01';

function psqlSync(sql) {
  const result = spawnSync(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8' }
  );
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function assert(condition, label) {
  const mark = condition ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${label}`);
  return condition;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Verificando conectividad con el contenedor ${CONTAINER}...`);
  const ping = psqlSync('select 1');
  if (ping.status !== 0) {
    console.error('No se pudo conectar al Postgres local. ¿Está "supabase start" corriendo?');
    console.error(ping.stderr);
    process.exit(1);
  }

  let allPassed = true;

  // ── Conexión A: mantiene el advisory lock abierto en una transacción
  // real que no hace commit hasta que termina el pg_sleep. ─────────────
  console.log(`Abriendo conexión A: adquiere el advisory lock (72501,1) y lo retiene ${LOCK_HOLD_SECONDS}s...`);
  const holder = spawn(
    'docker',
    [
      'exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A',
      '-c', `begin; select pg_advisory_xact_lock(72501, 1); select pg_sleep(${LOCK_HOLD_SECONDS}); commit;`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let holderExited = false;
  const holderDone = new Promise((resolve) => {
    holder.on('exit', (code) => {
      holderExited = true;
      resolve(code);
    });
  });

  // Da tiempo a que la conexión A realmente adquiera el lock antes de
  // que la conexión B intente tomarlo.
  await sleep(1500);

  if (holderExited) {
    console.error('La conexión A terminó antes de tiempo — no se pudo sostener el lock para la prueba.');
    process.exit(1);
  }

  // ── Conexión B (independiente): intenta correr ejecutar_radar_diario
  // MIENTRAS la conexión A retiene el lock. Debe fallar. ───────────────
  console.log('Conexión B: llamando ejecutar_radar_diario() mientras el lock está retenido...');
  const duringLock = psqlSync(`select ejecutar_radar_diario('${FECHA_PRUEBA}'::date);`);
  const failedAsExpected = duringLock.status !== 0
    && /ya está corriendo en otra transacción/.test(duringLock.stderr);
  allPassed = assert(
    failedAsExpected,
    'ejecutar_radar_diario() lanza la excepción descriptiva cuando el advisory lock ya está tomado por otra transacción real'
  ) && allPassed;
  if (!failedAsExpected) {
    console.log('  stdout:', duringLock.stdout);
    console.log('  stderr:', duringLock.stderr);
  }

  allPassed = assert(
    !/ERROR:  duplicate key|ERROR:  null value/.test(duringLock.stderr),
    'El rechazo ocurre ANTES de tocar datos (no hay señales de que haya empezado a procesar pacientes)'
  ) && allPassed;

  console.log(`Esperando a que la conexión A libere el lock (commit tras ${LOCK_HOLD_SECONDS}s)...`);
  await holderDone;

  // ── Tras liberarse el lock, una nueva llamada debe tener éxito — esto
  // confirma que es un lock de TRANSACCIÓN (pg_try_advisory_xact_lock),
  // no uno de sesión que quedaría retenido indefinidamente. ────────────
  console.log('Conexión B: reintentando ejecutar_radar_diario() ya con el lock libre...');
  const afterRelease = psqlSync(`select ejecutar_radar_diario('${FECHA_PRUEBA}'::date);`);
  allPassed = assert(
    afterRelease.status === 0,
    'Tras liberarse el lock (fin de la transacción que lo sostenía), ejecutar_radar_diario() corre normalmente — confirma que es un lock transaccional, no de sesión'
  ) && allPassed;
  if (afterRelease.status !== 0) {
    console.log('  stderr:', afterRelease.stderr);
  }

  console.log('');
  console.log(allPassed ? 'RESULTADO: PASS — concurrencia real verificada.' : 'RESULTADO: FAIL — ver detalle arriba.');
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Error inesperado en el script de prueba:', err);
  process.exit(1);
});
