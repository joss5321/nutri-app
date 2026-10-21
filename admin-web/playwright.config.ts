import { defineConfig, devices } from "@playwright/test";

/**
 * Config aislada para las pruebas e2e del issue #24. Levanta su propio
 * servidor Next.js local (puerto dedicado, no el de desarrollo normal) y
 * no toca ningun dato real: las pruebas interceptan las llamadas a
 * Supabase con page.route(), nunca pegan a la red real.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "e2e-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4455",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // "next dev" con Turbopack: su cliente de HMR falla el handshake de
    // WebSocket en este entorno y eso bloquea la hidratacion de React por
    // completo (useEffect nunca corre) — confirmado en vivo durante esta
    // sesion. Se usa un build real (next build + next start) en su lugar:
    // sin HMR, y ademas mas representativo de lo que corre en produccion.
    command: "npm run build && npm run start -- --port 4455",
    url: "http://127.0.0.1:4455",
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
