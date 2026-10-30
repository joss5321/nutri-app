# Checklist de publicación en tiendas — MyFitTrack

Documento generado para el issue #34 (hallazgo de la auditoría de producción,
Fase 3). Audita, contra el estado real del código (no contra suposiciones),
los 5 elementos que pide el criterio de aceptación del issue y deja, para
cada uno, qué falta y el paso concreto siguiente.

No deja ningún elemento marcado como completo sin haber verificado
directamente en el repo que existe. Cuando algo no se pudo completar en esta
tarea (porque requiere credenciales de Apple/Google, una decisión legal o de
negocio, o acceso a producción que esta tarea no tiene), queda dicho de forma
explícita en vez de darlo por hecho.

## Resumen de estado

| # | Elemento requerido | Estado encontrado | Bloqueador para completarlo |
|---|---|---|---|
| 1 | Política de privacidad publicada y enlazada | **Completo, confirmado en vivo (2026-10-30).** `https://nutri-app-three-ashy.vercel.app/privacidad` carga sin pedir sesión, con los datos legales reales. Verificado tanto por el usuario (navegador) como por `curl` ([ver 1](#1-política-de-privacidad-publicada-y-enlazada)). | Ninguno. |
| 2 | Descripción clara de las compras dentro de la app | **Resuelto el riesgo de fondo; falta el texto de tienda.** El PR #79 (ya mergeado) migró el checkout dentro de la app de Stripe a compra nativa (RevenueCat/StoreKit/Play Billing) — el riesgo de rechazo por Guideline 3.1.1 que esta sección documentaba ya no aplica. Queda redactar el texto para el campo de descripción de App Store Connect/Play Console con el flujo nuevo ([ver 2](#2-descripción-clara-de-las-compras-dentro-de-la-app)). | Ninguno para el texto (se deja redactado abajo). |
| 3 | Capturas de pantalla reales | **Falta.** No hay ninguna captura de la app en el repo, solo branding/iconos. | Requiere correr un build real (simulador/dispositivo) con backend conectado — no disponible en este entorno. |
| 4 | Clasificación de edad | **Falta.** No existe configuración de clasificación de edad en `app.json`; es un dato que se llena en App Store Connect/Play Console, no en el repo. | Requiere acceso a App Store Connect y Play Console (credenciales que este flujo no tiene). |
| 5 | Cuenta de prueba funcional para revisores | **Parcial.** Existe infraestructura de usuarios de prueba (`supabase_seed_test_users.sql`), pero no hay una cuenta designada específicamente como "cuenta de revisor" ni confirmación de que funcione contra producción. | Requiere acceso al proyecto de Supabase de producción para crear/confirmar la cuenta — no disponible en este flujo. |
| 6 | Eliminación de cuenta desde la app (Apple Guideline 5.1.1(v)) | **Completo, verificado de extremo a extremo (2026-10-30).** No es uno de los 5 elementos originales del issue #34, pero era un bloqueador de revisión igual de real. PR #82 (cierra #71+#72) implementa el flujo completo y se probó contra el proyecto real con cuentas descartables ([ver 6](#6-eliminación-de-cuenta-apple-guideline-511v)). | Ninguno. |

## Recomendación para el Coordinador

De los 5 elementos, **0 cumplen hoy el criterio de aceptación completo**,
pero los ítems 1 y 2 ya resolvieron su parte de decisión/código — lo que
queda es mergear, desplegar y verificar en vivo, no una decisión pendiente.
Los ítems 3, 4 y 5 siguen necesitando accesos que este flujo automatizado
no tiene y no debe inventar:

- **Ítem 1**: decisión legal/de negocio y dominio real, ambos ya resueltos
  por el usuario — falta mergear este PR y re-verificar `/privacidad` en
  vivo tras el deploy.
- **Ítem 2**: decisión de arquitectura (Stripe → compra nativa) ya tomada
  y ya implementada vía PR #79 — falta redactar el texto final para la
  ficha de tienda (se deja listo abajo) y pegarlo en App Store
  Connect/Play Console, fuera de este repo.
- **Ítems 3, 4 y 5**: requieren, respectivamente, un simulador/dispositivo
  real, sesión autenticada en App Store Connect/Play Console, y acceso al
  proyecto de Supabase de **producción**.

Según `WORKFLOW.md`, decidir si el issue #34 pasa a `Bloqueada` (total o
parcialmente) o se divide en sub-tareas es una decisión del **Coordinador**,
no de la ronda de corrección de un PR. Este documento deja, punto por
punto, el detalle de qué acceso o decisión falta para cada ítem, listo para
copiarse al issue si el Coordinador decide bloquearlo.

---

## 1. Política de privacidad publicada y enlazada

**Verificado en el repo:** búsqueda de "privacidad"/"privacy" en todo el
código (`mobile-app`, `admin-web`, `docs`) no devuelve ningún resultado. No
hay pantalla, ruta ni enlace a una política de privacidad en la app ni en
`admin-web`.

**Qué datos recolecta realmente la app** (confirmado leyendo el código, para
que el texto de la política sea preciso y no genérico):

- Datos de perfil: sexo, fecha de nacimiento, estatura (`mobile-app/src/app/(app)/perfil.tsx`,
  tabla `perfiles`).
- Fotos: la app pide permiso de acceso a fotos para elegir imagen de perfil
  (`expo-image-picker`, permiso declarado en `mobile-app/app.json`).
- Recordatorios (`expo-notifications`, en `mobile-app/src/app/(app)/nutricion.tsx`)
  — confirmado por grep que son notificaciones LOCALES (`scheduleNotificationAsync`),
  nunca se registra un push token con el servicio de Expo; no sale ningún
  dato a un servidor externo por esto.
- Datos de progreso físico y nutrición (medidas, rutinas, citas — ver
  `mobile-app/src/lib/api/`).
- Datos de pago: el cobro de suscripciones se procesa vía Stripe Checkout
  (suscriptores legados) o vía compra nativa con RevenueCat/App Store/Google
  Play (ver sección 2, tras el PR #79) — ninguno de los dos, ni la app,
  almacena datos de tarjeta.
- Autenticación: email y contraseña vía Supabase Auth.

**Actualización (ronda 1 de revisión del PR #67):** el revisor señaló
correctamente que dejar esto solo en prosa, sin publicarlo, no cumple el
criterio de aceptación del issue ("publicada y enlazada"). Esa ronda:

1. **Publicó la ruta.** `admin-web/app/privacidad/page.tsx` es una página
   pública (fuera del grupo `(admin)`, que es el que exige sesión), estática,
   sin autenticación — sí es una ubicación correcta para esto: `admin-web`
   ya es el único frontend web del proyecto, y una ruta pública sin auth no
   compromete el panel administrativo.
2. **La enlazó desde la app.** `mobile-app/src/app/(app)/perfil.tsx` agrega
   un botón "Política de privacidad" que abre la URL vía
   `expo-web-browser` (mismo patrón que el checkout de Stripe), usando la
   constante `PRIVACY_POLICY_URL` de `mobile-app/src/constants/legal.ts`.

**Corrección (ronda 2 de revisión del PR #67):** la ronda anterior describió
esto como "Parcial" en la tabla de resumen. El revisor señaló, correctamente,
que eso sobrestimaba el avance: un enlace a un dominio placeholder que no
resolvía a nada real, más un texto con 5 campos sin rellenar, no era una
política "publicada y enlazada" verificable por un revisor de Apple/Google.

**Actualización (ronda 3 — datos reales del usuario, 2026-10-29):** el
usuario proporcionó los 5 datos que faltaban y se verificó cada afirmación
de la página contra el código antes de escribirla (nada inventado):

1. **Texto legal definitivo.** `admin-web/app/privacidad/page.tsx` ya tiene:
   responsable ("Josue Ricardo Yañez Martinez"), uso de datos, proveedores
   reales (Supabase, Stripe, RevenueCat/Apple/Google — confirmado por grep,
   sin incluir Expo porque la app solo programa notificaciones locales, no
   registra push tokens), retención/eliminación, y el correo de contacto
   real. **Actualización (2026-10-30):** la eliminación de cuenta ya está
   implementada desde la app (ver ítem 6) — si el texto de
   `admin-web/app/privacidad/page.tsx` todavía describe esto como "se
   atiende manualmente por correo", hay que revisarlo y actualizarlo para
   que mencione el flujo real dentro de la app.
2. **Dominio real de `admin-web`.** `mobile-app/src/constants/legal.ts`
   usa `https://nutri-app-three-ashy.vercel.app`, confirmado por el usuario
   en su dashboard de Vercel y verificado en vivo con `curl`: la raíz `/`
   redirige a `/login` (el login propio de `admin-web`, no una pantalla de
   Vercel Authentication) — sin protección de Vercel por delante.
3. **Confirmado completo (2026-10-30):** tras el merge y deploy, el usuario
   abrió `https://nutri-app-three-ashy.vercel.app/privacidad` en su
   navegador y confirmó que carga sin pedir sesión. Verificado también con
   `curl` (HTTP 200, título y contenido correctos, cacheado por Vercel).
   Queda pendiente, fuera de este repo, cargar esa misma URL en el campo
   "Privacy Policy URL" de App Store Connect / Play Console.

El contenido completo y actualizado vive únicamente en
`admin-web/app/privacidad/page.tsx` — no se duplica aquí para evitar que
este documento quede desactualizado otra vez la próxima vez que cambie.

---

## 2. Descripción clara de las compras dentro de la app

**Resuelto (PR #79, ya mergeado a `main`):** la ronda anterior de este
documento identificó que las suscripciones usaban un checkout web de
Stripe dentro de la app, y documentó esto como riesgo real de rechazo bajo
la Guideline 3.1.1 de Apple ("In-App Purchase") y la política de pagos de
Google Play. El usuario decidió la Opción A (migrar a compra nativa) y esa
migración ya está implementada: `mobile-app/src/app/(app)/perfil.tsx`
ahora compra vía `react-native-purchases` (RevenueCat), que orquesta
StoreKit en iOS y Google Play Billing en Android — ya no abre ningún
navegador para cobrar. Stripe se conserva únicamente para suscriptores
legados (`handleGestionarSuscripcion` distingue ambos casos) y para
cualquier cobro que no pase por el checkout de la app móvil.

**Pendiente, y de quién depende (no es código):** la migración de código
está lista, pero los productos de suscripción todavía no existen en App
Store Connect ni en Google Play Console, y el proyecto de RevenueCat
tampoco está configurado — ver el plan de migración guardado para el
detalle exacto (productos, entitlements, Offering, secret del webhook).
Sin eso, no hay nada que comprar todavía en ningún ambiente real.

**Texto propuesto para el campo de descripción de compras/suscripciones en
App Store Connect / Play Console** (listo para usar una vez que existan los
productos):

```
MyFitTrack ofrece planes de suscripción opcionales (Pro y Premium) que
desbloquean funciones adicionales de seguimiento nutricional y de
entrenamiento. El pago se procesa de forma segura a través del sistema de
compras de tu dispositivo (App Store o Google Play); MyFitTrack no
almacena los datos de tu tarjeta. El usuario puede usar la app sin
suscribirse; las funciones básicas de registro de progreso están
disponibles sin pago.
```

---

## 3. Capturas de pantalla reales

**Verificado en el repo:** `mobile-app/assets/` solo contiene íconos,
splash screen y branding (`assets/branding/`) — no hay ninguna captura de
pantalla de las vistas reales de la app (dashboard, nutrición, rutinas,
progreso, perfil).

**Por qué no se generaron en esta tarea:** tomar capturas reales requiere
correr un build de la app (simulador iOS, emulador Android o dispositivo
físico) conectado a un backend de Supabase con datos de ejemplo, y luego
capturar cada pantalla en los tamaños exactos que exigen las tiendas. Este
entorno de ejecución automatizado no tiene simulador/emulador ni las
credenciales de backend necesarias para correr la app de forma realista, y
generar capturas falsas o de un entorno no representativo no cumpliría el
criterio de aceptación ("capturas de pantalla reales").

**Pasos concretos para completarlo (a ejecutar por alguien con acceso a un
simulador/dispositivo):**

1. Levantar la app (`cd mobile-app && npx expo start`) contra un proyecto de
   Supabase con datos de ejemplo (puede usarse `supabase_seed_test_users.sql`
   para tener usuarios con datos realistas).
2. Capturar, como mínimo, las pantallas: `dashboard`, `nutricion`, `rutinas`,
   `progreso`, `perfil` (son las 5 rutas en `mobile-app/src/app/(app)/`).
3. Tamaños requeridos:
   - **App Store Connect (iOS):** al menos un set en 6.5" (1284×2778 o
     1242×2688 px) para iPhone; si `app.json` declara `supportsTablet: true`
     (como es el caso), también se necesita un set de iPad de 13"
     (2048×2732 px).
   - **Play Console (Android):** mínimo 2 capturas de teléfono (formato
     16:9 o 9:16, mínimo 320px, máximo 3840px por lado).
4. Subir cada set a su sección correspondiente en App Store Connect / Play
   Console.

---

## 4. Clasificación de edad

**Verificado en el repo:** `mobile-app/app.json` no declara ningún campo de
clasificación de edad (no existe tal campo para Expo/EAS — la clasificación
de edad no se configura en el repo, se llena directamente en los
cuestionarios de App Store Connect y Play Console al crear la ficha de la
app).

**Qué contenido de la app es relevante para responder esos cuestionarios**
(confirmado en el código, para que quien lo complete no tenga que adivinar):

- No hay contenido generado por otros usuarios visible públicamente, ni
  chat, ni funciones sociales (confirmado: no hay rutas de mensajería/chat
  en `mobile-app/src/app/`).
- La app recolecta datos de salud/fitness básicos (peso, medidas, nutrición)
  pero no diagnóstico médico ni datos clínicos.
- No hay contenido para adultos, apuestas, ni compras de contenido
  generado por el usuario.
- Tiene compras dentro de la app (suscripciones, ver sección 2) — ambos
  cuestionarios preguntan esto explícitamente.

Con ese contenido, lo esperable es una clasificación baja (4+ en App Store /
PEGI 3 o "Para todos" en Play Console), pero **la clasificación final la
asignan los cuestionarios oficiales de Apple/Google, no este documento** —
completarlos requiere acceso con sesión autenticada a App Store Connect y
Play Console, que este flujo automatizado no tiene.

---

## 5. Cuenta de prueba funcional para los revisores de Apple/Google

**Verificado en el repo:** existe `supabase_seed_test_users.sql`, que crea 6
usuarios de prueba (`juan.perez@test.com`, `maria.garcia@test.com`, etc.)
con contraseña `Test1234!` y datos de perfil ya completos (sexo, fecha de
nacimiento, estatura, plan de membresía). Es infraestructura reutilizable,
pero **no hay ninguna cuenta designada específicamente como "cuenta de
revisor"**, y no hay confirmación de que este seed se haya corrido contra el
proyecto de Supabase de **producción** (el `WORKFLOW.md` de este repo es
explícito en que `supabase_schema.sql`/scripts de seed describen lo
*propuesto*, no lo que ya corrió en producción).

**Qué falta para completarlo:**

1. **Designar o crear una cuenta dedicada para revisores**, distinta de las
   de prueba genéricas, con un correo identificable (ej.
   `reviewer@[dominio-del-proyecto]`) y una contraseña que no expire ni
   dependa de un correo real que alguien del equipo deba revisar durante la
   revisión de Apple/Google.
2. **Confirmar que la cuenta tiene datos de ejemplo suficientes** para que
   un revisor pueda ver las funciones principales sin tener que generarlos
   manualmente (perfil completo, al menos una medida de progreso, al menos
   una rutina o cita) — el patrón de `supabase_seed_test_users.sql` ya cubre
   esto para perfil básico, pero no incluye rutinas/citas/medidas de
   ejemplo.
3. **Verificar el login real contra producción** antes de enviar a revisión,
   y recién entonces completar los campos "Sign-in required" / "Demo
   Account" de App Store Connect y Play Console con ese correo y contraseña.

Esto no se completó en esta tarea porque crear o confirmar una cuenta contra
el proyecto de Supabase de **producción** requiere acceso a ese proyecto,
que este flujo automatizado no tiene (y que, de tenerlo, implicaría escribir
datos reales en producción — una acción que este issue no autoriza por sí
sola).

---

## 6. Eliminación de cuenta (Apple Guideline 5.1.1(v))

**No es uno de los 5 elementos originales del issue #34** — se agregó aquí
porque era un bloqueador de revisión real descubierto al preparar este
checklist, igual de capaz de causar un rechazo que cualquiera de los otros
5.

**La regla:** desde 2022, Apple exige (App Store Review Guideline 5.1.1(v))
que cualquier app que permita a un usuario crear una cuenta también permita
**iniciar la eliminación de esa cuenta desde dentro de la app**, sin
necesidad de llamar o escribir a soporte. No es opcional ni específico de
apps con datos sensibles — aplica a MyFitTrack igual que a cualquier otra.

**Completo, verificado de extremo a extremo (2026-10-30).** PR #82 (merge
de #71+#72) implementa el flujo completo:
`mobile-app/src/components/ui/EliminarCuentaModal.tsx` (aviso de
consecuencias → aviso de suscripción activa si aplica → confirmación de
identidad con contraseña → confirmación final irreversible) +
`mobile-app/src/lib/api/cuenta.ts` + la Edge Function
`supabase/functions/eliminar-cuenta`.

Probado contra el proyecto real de Supabase con cuentas descartables
creadas por el flujo público de registro (no simulado, no solo revisión de
código), limpiadas por completo al terminar:

- **Cuenta normal:** `eliminar-cuenta` devolvió `{"success":true}` y se
  confirmó por SQL que `auth.users`/`perfiles` desaparecieron.
- **Nutriólogo con un paciente asignado:** bloqueado correctamente con 409
  (`"Tienes 1 paciente asignado. Reasígnalos antes de eliminar tu
  cuenta."`), sin tocar ningún dato — evita tanto huérfanos silenciosos en
  `perfiles.nutricionista_id` como el borrado real de
  `pacientes_manuales` que habría ocurrido sin este guardia.
- Una suscripción Stripe activa se cancela de forma sincrónica dentro de
  la misma función (no depende del webhook async); una suscripción
  RevenueCat (App Store/Google Play) no se puede cancelar por API —  el
  modal avisa de esto y ofrece el link nativo de gestión antes de
  continuar.

Evidencia completa en los comentarios de cierre de
[#71](https://github.com/joss5321/nutri-app/issues/71) y
[#72](https://github.com/joss5321/nutri-app/issues/72). Ya no es un
bloqueador para enviar a revisión.

---

## Qué NO cubre este documento

- No verifica en vivo que `/privacidad` cargue sin sesión en producción:
  eso requiere que este PR esté mergeado y desplegado primero (hoy da 404
  porque la página no existe todavía en el deploy actual).
- No crea los productos de suscripción en App Store Connect/Play Console
  ni el proyecto de RevenueCat — ver el plan de migración guardado para el
  detalle exacto de qué falta configurar ahí.
- No genera capturas de pantalla reales (requiere un build corrido por una
  persona con simulador/dispositivo disponible).
- No completa los cuestionarios de clasificación de edad en App Store
  Connect / Play Console (requiere sesión autenticada en esas consolas).
- No crea ni confirma cuentas contra el proyecto de Supabase de producción.
