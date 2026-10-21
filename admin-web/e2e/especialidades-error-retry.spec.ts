import { test, expect } from "@playwright/test";

/**
 * Valida el issue #24 ("Mostrar error al fallar carga de catálogos"): la
 * carga del catálogo de especialidades debe mostrar un mensaje de error y
 * un botón "Reintentar" cuando falla, y debe recuperarse correctamente al
 * reintentar.
 *
 * Entorno aislado: monta el componente vía /test-harness/especialidades-tab
 * (fuera del guard de auth de (admin), sin login real) e intercepta la
 * llamada de red a Supabase con page.route() — nunca pega a la base de
 * datos real.
 */
test("EspecialidadesTab: muestra error + reintentar, y se recupera al reintentar", async ({ page }) => {
  let callCount = 0;

  await page.route("**/rest/v1/especialidades**", async (route) => {
    callCount += 1;
    if (callCount === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Error simulado de red (prueba aislada)" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "11111111-1111-1111-1111-111111111111", nombre: "Nutrición deportiva" },
          { id: "22222222-2222-2222-2222-222222222222", nombre: "Nutrición clínica" },
        ]),
      });
    }
  });

  await page.goto("/test-harness/especialidades-tab", { waitUntil: "domcontentloaded", timeout: 45_000 });

  // 1) Primer intento falla -> debe verse el mensaje de error + botón Reintentar.
  const retryButton = page.getByRole("button", { name: "Reintentar" });
  await expect(retryButton).toBeVisible();
  await expect(page.getByText(/no se pudo cargar|error simulado/i)).toBeVisible();

  await page.screenshot({ path: "e2e-evidence/01-error-visible.png" });

  // 2) Click en Reintentar -> la segunda llamada (mockeada arriba) tiene éxito.
  await retryButton.click();

  // 3) El catálogo real debe aparecer, y el error ya no debe estar.
  await expect(page.getByText("Catálogo disponible")).toBeVisible();
  await expect(page.getByText("Nutrición deportiva")).toBeVisible();
  await expect(retryButton).not.toBeVisible();

  await page.screenshot({ path: "e2e-evidence/02-recuperado-tras-reintentar.png" });

  expect(callCount).toBe(2);
});
