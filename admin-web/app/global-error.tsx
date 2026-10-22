"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="es">
      <body className="h-full antialiased">
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <h2 className="text-lg font-bold text-text-primary">Algo salió mal</h2>
          <p className="text-sm text-text-secondary max-w-sm">
            Ocurrió un error inesperado y la aplicación no pudo cargarse.
          </p>
          {error.digest && (
            <p className="text-xs text-text-muted">Código: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-primary-dark transition-colors"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
