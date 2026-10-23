import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad — MyFitTrack",
  description: "Política de privacidad de la aplicación MyFitTrack.",
};

const CAMPOS_PENDIENTES_DE_LEGAL = [
  "Nombre de la entidad/desarrollador responsable",
  "Para qué se usa cada dato (sección 2)",
  "Otros proveedores que reciban datos, si aplica (sección 3)",
  "Tiempo de retención y procedimiento de eliminación de datos (sección 4)",
  "Correo de contacto para solicitudes de privacidad (sección 5)",
];

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-text-primary">
      <h1 className="text-3xl font-extrabold text-primary">
        Política de privacidad de MyFitTrack
      </h1>

      <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Aviso: campos pendientes de revisión legal</p>
        <p className="mt-1">
          Esta página describe, con precisión, los datos que la app recolecta
          realmente (verificado contra el código). Los siguientes puntos están
          marcados entre corchetes más abajo porque son decisiones legales o
          de negocio que aún no se han definido formalmente; deben
          completarse antes de enviar la app a revisión de Apple/Google:
        </p>
        <ul className="mt-2 list-disc pl-5">
          {CAMPOS_PENDIENTES_DE_LEGAL.map((campo) => (
            <li key={campo}>{campo}</li>
          ))}
        </ul>
      </div>

      <section className="mt-8 space-y-6 text-sm leading-relaxed text-text-primary">
        <p>
          [Nombre de la entidad/desarrollador responsable] (&quot;nosotros&quot;) opera la
          aplicación móvil MyFitTrack. Esta política describe qué datos
          recolectamos y cómo los usamos.
        </p>

        <div>
          <h2 className="text-lg font-bold text-primary">1. Datos que recolectamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Datos de cuenta: correo electrónico y contraseña (gestionados
              por nuestro proveedor de autenticación, Supabase).
            </li>
            <li>Datos de perfil: sexo, fecha de nacimiento, estatura.</li>
            <li>Datos de progreso físico: medidas corporales que el usuario registra.</li>
            <li>
              Datos de nutrición y entrenamiento: alimentos, rutinas y citas
              que el usuario registra o agenda dentro de la app.
            </li>
            <li>
              Foto de perfil, si el usuario decide subir una (requiere
              permiso de acceso a fotos).
            </li>
            <li>Notificaciones push, si el usuario las habilita.</li>
            <li>
              Datos de pago: al suscribirse a un plan, el cobro se procesa a
              través de Stripe. MyFitTrack no almacena números de tarjeta;
              Stripe los procesa bajo su propia{" "}
              <a
                href="https://stripe.com/privacy"
                className="text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                política de privacidad
              </a>
              .
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary">2. Cómo usamos los datos</h2>
          <p className="mt-2">
            [Completar: para qué se usa cada dato — personalización de
            planes de nutrición/entrenamiento, comunicación con el usuario,
            etc.]
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary">3. Con quién compartimos datos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Supabase (base de datos y autenticación).</li>
            <li>Stripe (procesamiento de pagos de suscripciones).</li>
            <li>[Completar: cualquier otro proveedor que aplique.]</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary">4. Retención y eliminación de datos</h2>
          <p className="mt-2">
            [Completar: cuánto tiempo se conservan los datos y cómo puede un
            usuario solicitar la eliminación de su cuenta y sus datos.]
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary">5. Contacto</h2>
          <p className="mt-2">
            Para preguntas sobre esta política o para solicitar la
            eliminación de tus datos, escribe a [email de contacto].
          </p>
        </div>
      </section>
    </main>
  );
}
