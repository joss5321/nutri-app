import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad — MyFitTrack",
  description: "Política de privacidad de la aplicación MyFitTrack.",
};

const AVISOS_PENDIENTES = [
  "La eliminación de cuenta todavía no está implementada en la app (issues #71/#72 en desarrollo) — hoy se atiende manualmente escribiendo al correo de contacto.",
  "Confirmar con un abogado si este texto cumple los requisitos específicos de privacidad de tu mercado de lanzamiento antes de enviar la app a revisión.",
];

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-text-primary">
      <h1 className="text-3xl font-extrabold text-primary">
        Política de privacidad de MyFitTrack
      </h1>

      <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Avisos pendientes</p>
        <ul className="mt-2 list-disc pl-5">
          {AVISOS_PENDIENTES.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      </div>

      <section className="mt-8 space-y-6 text-sm leading-relaxed text-text-primary">
        <p>
          Josue Ricardo Yañez Martine (&quot;nosotros&quot;) opera la
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
            <li>
              Recordatorios: la app puede programar notificaciones locales en
              tu propio dispositivo (por ejemplo, horarios de suplementos).
              Estos recordatorios se generan y se muestran directamente en el
              teléfono; no se envían a ningún servidor externo.
            </li>
            <li>
              Datos de pago: al suscribirte a un plan, el cobro se procesa a
              través de Stripe o, si compraste la suscripción directamente
              desde la app, a través de la tienda de tu dispositivo (App
              Store o Google Play), gestionado con RevenueCat. MyFitTrack no
              almacena números de tarjeta; cada uno de estos procesa el pago
              bajo su propia política de privacidad (
              <a
                href="https://stripe.com/privacy"
                className="text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                Stripe
              </a>
              ,{" "}
              <a
                href="https://www.revenuecat.com/privacy/"
                className="text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                RevenueCat
              </a>
              ).
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary">2. Cómo usamos los datos</h2>
          <p className="mt-2">
            Usamos tus datos para gestionar tu perfil, personalizar tus
            planes de nutrición y entrenamiento, registrar tu progreso,
            gestionar tu suscripción y comunicarnos contigo sobre el
            servicio.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary">3. Con quién compartimos datos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Supabase (base de datos y autenticación).</li>
            <li>Stripe (procesamiento de pagos para suscripciones iniciadas por ese medio).</li>
            <li>
              RevenueCat, junto con Apple App Store / Google Play Store
              (procesamiento de pagos para suscripciones compradas
              directamente desde la app).
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary">4. Retención y eliminación de datos</h2>
          <p className="mt-2">
            Conservamos tus datos mientras tu cuenta esté activa. Esto
            incluye los registros de pagos y suscripciones, que conservamos
            por motivos operativos y de auditoría. Puedes solicitar la
            eliminación de tu cuenta y tus datos escribiéndonos al correo de
            contacto que aparece abajo. Hoy esa solicitud se atiende
            manualmente, mientras terminamos de construir la eliminación
            automática dentro de la app.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary">5. Contacto</h2>
          <p className="mt-2">
            Para preguntas sobre esta política o para solicitar la
            eliminación de tus datos, escribe a{" "}
            <a href="mailto:j.rym5311@gmail.com" className="text-primary underline">
              j.rym5311@gmail.com
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
