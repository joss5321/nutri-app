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
| 1 | Política de privacidad publicada y enlazada | **Falta** (bajo el criterio estricto del issue, aunque la infraestructura de código ya está lista). Ya existe una ruta pública (`admin-web/app/privacidad/page.tsx`) y está enlazada desde `mobile-app` (pantalla de perfil, botón "Política de privacidad"), pero el enlace apunta a un dominio placeholder que no resuelve a nada real (`mobile-app/src/constants/legal.ts:5`) y el texto conserva 5 campos entre corchetes sin rellenar. Un enlace a un dominio inexistente y un texto legal incompleto no cumplen "publicada y enlazada" de forma verificable por un revisor de Apple/Google ([ver 1](#1-política-de-privacidad-publicada-y-enlazada)). | Reemplazar el dominio placeholder por el dominio real de producción de `admin-web` + revisión legal que rellene los 5 campos entre corchetes. Ninguno de los dos es algo que este flujo automatizado pueda hacer sin inventar información. |
| 2 | Descripción clara de las compras dentro de la app | **Falta el texto de tienda; el flujo de cobro real ya está identificado** ([ver 2](#2-descripción-clara-de-las-compras-dentro-de-la-app)). | Ninguno para el texto (ya se deja redactado abajo); revisar el punto de riesgo de Apple antes de enviar. |
| 3 | Capturas de pantalla reales | **Falta.** No hay ninguna captura de la app en el repo, solo branding/iconos. | Requiere correr un build real (simulador/dispositivo) con backend conectado — no disponible en este entorno. |
| 4 | Clasificación de edad | **Falta.** No existe configuración de clasificación de edad en `app.json`; es un dato que se llena en App Store Connect/Play Console, no en el repo. | Requiere acceso a App Store Connect y Play Console (credenciales que este flujo no tiene). |
| 5 | Cuenta de prueba funcional para revisores | **Parcial.** Existe infraestructura de usuarios de prueba (`supabase_seed_test_users.sql`), pero no hay una cuenta designada específicamente como "cuenta de revisor" ni confirmación de que funcione contra producción. | Requiere acceso al proyecto de Supabase de producción para crear/confirmar la cuenta — no disponible en este flujo. |

## Recomendación para el Coordinador

De los 5 elementos, **0 cumplen hoy el criterio de aceptación completo**, y
ninguno de los 5 se puede terminar de resolver con otra ronda de corrección
de código, porque lo que falta en cada caso es una decisión o un acceso que
este flujo automatizado no tiene y no debe inventar:

- **Ítem 1**: una decisión legal/de negocio (texto final de la política) +
  el dominio real de producción de `admin-web` (dato operativo, no de
  código).
- **Ítem 2**: el texto ya está redactado y listo para pegar en App Store
  Connect/Play Console — no hay ningún campo de configuración *en este
  repo* al que conectarlo, porque es un campo de la ficha de tienda, no de
  la app ni de `admin-web`.
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
- Notificaciones push (`expo-notifications`, solicitadas en
  `mobile-app/src/app/(app)/nutricion.tsx`).
- Datos de progreso físico y nutrición (medidas, rutinas, citas — ver
  `mobile-app/src/lib/api/`).
- Datos de pago: el cobro de suscripciones se procesa vía Stripe Checkout
  (ver sección 2) — Stripe, no la app, es quien recibe los datos de tarjeta.
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
que eso sobrestima el avance: un enlace a un dominio placeholder que no
resuelve a nada real, más un texto con 5 campos sin rellenar, no es una
política "publicada y enlazada" verificable por un revisor de Apple/Google,
sin importar que la ruta y el enlace ya existan en código. La tabla de
resumen ahora marca este elemento como **"Falta"**, no "Parcial" — la
infraestructura de código está lista, pero el criterio de aceptación en sí
no se cumple todavía.

**Qué sigue sin estar resuelto, y por qué (no se puede resolver sin acceso o
decisión externa, igual que antes)**:

1. **Texto legal definitivo.** La página publicada conserva los mismos
   campos entre corchetes del borrador (nombre de la entidad responsable,
   para qué se usa cada dato, otros proveedores, retención/eliminación,
   correo de contacto) con un aviso visible en la propia página listándolos
   como pendientes de revisión legal. Completarlos es una decisión
   legal/de negocio que no corresponde tomar de forma automática.
2. **Dominio real de `admin-web`.** El enlace desde `mobile-app` usa un
   placeholder (`PRIVACY_POLICY_URL` en `mobile-app/src/constants/legal.ts`)
   porque **el dominio de producción de `admin-web` no está registrado en
   ningún archivo de este repo** (no hay `vercel.json`, ni `.env`, ni
   referencia a un dominio `.vercel.app` en ningún lado — confirmado con
   `grep -rn "vercel.app" .`, sin resultados fuera de este mismo
   documento). Inventar un dominio sería peor que dejarlo explícito como
   pendiente: un enlace roto en producción. Falta que alguien con acceso al
   dashboard de Vercel (o a donde esté desplegado `admin-web`) reemplace esa
   constante por la URL real.
3. Una vez resuelto lo anterior, falta además cargar la misma URL en el
   campo "Privacy Policy URL" de App Store Connect / Play Console (fuera
   del repo).

### Borrador de política de privacidad (mismo contenido que `admin-web/app/privacidad/page.tsx`)

```
Política de privacidad de MyFitTrack

Última actualización: [fecha]

[Nombre de la entidad/desarrollador responsable] ("nosotros") opera la
aplicación móvil MyFitTrack. Esta política describe qué datos recolectamos
y cómo los usamos.

1. Datos que recolectamos
   - Datos de cuenta: correo electrónico y contraseña (gestionados por
     nuestro proveedor de autenticación, Supabase).
   - Datos de perfil: sexo, fecha de nacimiento, estatura.
   - Datos de progreso físico: medidas corporales que el usuario registra.
   - Datos de nutrición y entrenamiento: alimentos, rutinas y citas que el
     usuario registra o agenda dentro de la app.
   - Foto de perfil, si el usuario decide subir una (requiere permiso de
     acceso a fotos).
   - Notificaciones push, si el usuario las habilita.
   - Datos de pago: al suscribirse a un plan, el cobro se procesa a través
     de Stripe. MyFitTrack no almacena números de tarjeta; Stripe los
     procesa bajo su propia política de privacidad
     (https://stripe.com/privacy).

2. Cómo usamos los datos
   [Completar: para qué se usa cada dato — personalización de planes de
   nutrición/entrenamiento, comunicación con el usuario, etc.]

3. Con quién compartimos datos
   - Supabase (base de datos y autenticación).
   - Stripe (procesamiento de pagos de suscripciones).
   [Completar: cualquier otro proveedor que aplique.]

4. Retención y eliminación de datos
   [Completar: cuánto tiempo se conservan los datos y cómo puede un usuario
   solicitar la eliminación de su cuenta y sus datos.]

5. Contacto
   Para preguntas sobre esta política o para solicitar la eliminación de
   tus datos, escribe a [email de contacto].
```

---

## 2. Descripción clara de las compras dentro de la app

**Verificado en el repo:** las suscripciones **no usan Apple In-App Purchase
ni Google Play Billing nativos**. El flujo real (`mobile-app/src/app/(app)/perfil.tsx`)
abre un checkout de **Stripe** en un navegador embebido
(`expo-web-browser`, función `crearCheckout` de `mobile-app/src/lib/api/pagos.ts`)
cuando el usuario elige un plan. Los planes disponibles están en
`mobile-app/src/constants/planes.ts`: `basico`, `pro`, `premium`.

**Texto propuesto para el campo de descripción de compras/suscripciones en
App Store Connect / Play Console** (listo para usar, no requiere datos que
no estén ya en el repo):

```
MyFitTrack ofrece planes de suscripción opcionales (Básico, Pro y Premium)
que desbloquean funciones adicionales de seguimiento nutricional y de
entrenamiento. El pago se procesa de forma segura a través de Stripe dentro
de un navegador integrado en la app; MyFitTrack no almacena los datos de la
tarjeta. El usuario puede usar la app sin suscribirse; las funciones básicas
de registro de progreso están disponibles sin pago.
```

**Punto de riesgo que debe quedar registrado (no corregido en esta tarea):**
las directrices de revisión de Apple (App Store Review Guideline 3.1.1,
"In-App Purchase") generalmente exigen que el contenido/servicios digitales
consumidos dentro de la app usen el sistema de compras de Apple, con
excepciones limitadas. Un checkout web (Stripe) para desbloquear funciones
dentro de la app **puede ser motivo de rechazo en iOS** si Apple lo
considera un servicio digital sujeto a esa regla. Esto es una decisión de
negocio/arquitectura (migrar a `react-native-iap`/`expo-in-app-purchases`
para iOS, o argumentar una excepción aplicable) que está explícitamente fuera
del alcance de este issue: tocar la lógica de Stripe/cobros no está permitido
en esta tarea. Se deja documentado como riesgo a resolver antes de enviar a
revisión de Apple — Google Play es menos estricto con este punto para
servicios de suscripción fuera de contenido digital consumible en la app,
pero conviene confirmarlo también.

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

## Qué NO cubre este documento

- No redacta el texto legal final de la política de privacidad: la página
  publicada (`admin-web/app/privacidad/page.tsx`) conserva campos entre
  corchetes pendientes de revisión legal, marcados explícitamente en la
  propia página.
- No conoce ni inventa el dominio real de producción de `admin-web`: el
  enlace desde `mobile-app` usa un placeholder en
  `mobile-app/src/constants/legal.ts` hasta que alguien con acceso al
  despliegue lo reemplace.
- No modifica la lógica de cobros/Stripe ni resuelve el riesgo de revisión
  de Apple sobre compras dentro de la app descrito en la sección 2 — queda
  documentado como decisión pendiente, no como código a cambiar.
- No genera capturas de pantalla reales (requiere un build corrido por una
  persona con simulador/dispositivo disponible).
- No completa los cuestionarios de clasificación de edad en App Store
  Connect / Play Console (requiere sesión autenticada en esas consolas).
- No crea ni confirma cuentas contra el proyecto de Supabase de producción.
