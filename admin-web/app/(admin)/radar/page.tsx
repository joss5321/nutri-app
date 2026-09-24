"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import {
  fetchRadarResumen,
  fetchEnSeguimiento,
  ordenarPorPrioridad,
  agruparPorResumen,
  type PacienteRadar,
  type PacienteEnSeguimiento,
  type GrupoResumen,
} from "@/app/_data/radar";
import { fetchPerfil, type Perfil } from "@/app/_data/perfiles";
import ResumenEstados from "@/app/_components/radar/ResumenEstados";
import PacienteRadarCard from "@/app/_components/radar/PacienteRadarCard";
import SeguimientoCard from "@/app/_components/radar/SeguimientoCard";
import UserModal from "@/app/_components/usuarios/UserModal";

export default function RadarPage() {
  const [pacientes, setPacientes] = useState<PacienteRadar[] | null>(null);
  const [enSeguimiento, setEnSeguimiento] = useState<PacienteEnSeguimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<GrupoResumen | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [verSecundarios, setVerSecundarios] = useState(false);
  const [verSeguimiento, setVerSeguimiento] = useState(false);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<Perfil | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState<string | null>(null);
  // Pacientes cuya última alerta abierta se acaba de resolver en esta
  // misma sesión (R6, punto 10): el motor solo recalcula estado una vez al
  // día, así que sin este registro local el paciente seguiría apareciendo
  // como pendiente hasta la próxima corrida — justo lo que el producto NO
  // quiere. No reinterpreta ningún score: solo oculta de "pendiente" a
  // quien ya no tiene ninguna alerta abierta tras la intervención real que
  // el backend acaba de confirmar.
  const [atendidosAhora, setAtendidosAhora] = useState<Set<string>>(new Set());

  // No resetea estado sincrónicamente dentro del efecto (el estado inicial
  // ya es null/sin error) — solo carga. El botón "Reintentar" sí resetea,
  // pero corre desde un click handler, no desde un efecto.
  useEffect(() => {
    fetchRadarResumen()
      .then((data) => setPacientes(ordenarPorPrioridad(data)))
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar Radar."));
    fetchEnSeguimiento()
      .then(setEnSeguimiento)
      .catch(() => setEnSeguimiento([]));
  }, []);

  function reintentar() {
    setError(null);
    setPacientes(null);
    setAtendidosAhora(new Set());
    fetchRadarResumen()
      .then((data) => setPacientes(ordenarPorPrioridad(data)))
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar Radar."));
    fetchEnSeguimiento()
      .then(setEnSeguimiento)
      .catch(() => setEnSeguimiento([]));
  }

  function manejarIntervencionRegistrada(pacienteId: string, alertaResueltaId: string | null) {
    // "En seguimiento" ahora se define por resultado_estado='pendiente' de
    // la intervención (R7), no por la alerta — reconstruirlo a mano aquí
    // implicaría duplicar esa fuente de verdad. Un refetch dirigido (no un
    // reload de página completo) es más simple y no puede desincronizarse.
    fetchEnSeguimiento().then(setEnSeguimiento).catch(() => {});

    if (!alertaResueltaId) return; // Sin alerta ligada: nada que ocultar de la lista de pendientes.

    setPacientes((prev) =>
      (prev ?? []).map((p) => {
        if (p.pacienteId !== pacienteId) return p;
        const restantes = p.alertasAbiertas.filter((a) => a.id !== alertaResueltaId);
        if (restantes.length === 0) {
          setAtendidosAhora((prevSet) => new Set(prevSet).add(pacienteId));
        }
        return { ...p, alertasAbiertas: restantes };
      })
    );
  }

  const pacientesVisibles = useMemo(
    () => (pacientes ?? []).filter((p) => !atendidosAhora.has(p.pacienteId)),
    [pacientes, atendidosAhora]
  );

  const grupos = useMemo(() => agruparPorResumen(pacientesVisibles), [pacientesVisibles]);
  const conteos = {
    rojo: grupos.rojo.length,
    naranja: grupos.naranja.length,
    amarillo: grupos.amarillo.length,
    verde: grupos.verde.length,
    blanco: grupos.blanco.length,
  };

  const filtrarPorBusqueda = (lista: PacienteRadar[]) => {
    if (!busqueda.trim()) return lista;
    const q = busqueda.trim().toLowerCase();
    return lista.filter((p) => (p.nombreCompleto ?? "").toLowerCase().includes(q));
  };

  // Por default se muestran expandidos rojo+naranja+amarillo (los 3
  // estados que implican algo por hacer); verde y blanco quedan
  // secundarios/colapsados. Un filtro de card específica anula esto.
  const principales = filtrarPorBusqueda(
    filtro ? grupos[filtro] : [...grupos.rojo, ...grupos.naranja, ...grupos.amarillo]
  );
  const secundarios = filtrarPorBusqueda(
    filtro ? [] : [...grupos.verde, ...grupos.blanco]
  );

  async function abrirPaciente(pacienteId: string) {
    setCargandoPerfil(pacienteId);
    try {
      const perfil = await fetchPerfil(pacienteId);
      setPerfilSeleccionado(perfil);
    } catch {
      setError("No se pudo abrir el detalle de este paciente.");
    } finally {
      setCargandoPerfil(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">MyFitTrack Radar</h1>
        <p className="text-secondary text-sm mt-1">Quién necesita tu atención hoy</p>
      </div>

      {error && (
        <div className="mb-4 bg-error-soft text-error text-sm rounded-lg px-4 py-3">
          {error}{" "}
          <button onClick={reintentar} className="underline font-semibold">
            Reintentar
          </button>
        </div>
      )}

      {pacientes === null && !error ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-surface-muted animate-pulse" />
            ))}
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-surface-muted animate-pulse" />
            ))}
          </div>
        </div>
      ) : pacientes !== null && pacientes.length === 0 ? (
        <div className="bg-surface-muted rounded-xl p-10 text-center">
          <p className="text-3xl mb-2">📡</p>
          <p className="font-semibold text-text-primary">Radar todavía no ha evaluado pacientes.</p>
          <p className="text-sm text-muted mt-1">
            Una vez que el motor corra para tus pacientes, aparecerán aquí automáticamente.
          </p>
        </div>
      ) : pacientes !== null ? (
        <>
          <ResumenEstados conteos={conteos} filtroActivo={filtro} onFiltrar={setFiltro} />

          <div className="mt-5 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar paciente por nombre…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-divider focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            {filtro && (
              <button onClick={() => setFiltro(null)} className="text-xs font-semibold text-primary hover:underline">
                Quitar filtro
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {principales.length === 0 ? (
              <div className="bg-surface-muted rounded-xl p-8 text-center">
                <p className="text-2xl mb-1">✅</p>
                <p className="font-semibold text-text-primary">
                  {filtro
                    ? "No hay pacientes en esta categoría."
                    : "Todo tranquilo por ahora. No hay pacientes que requieran atención inmediata."}
                </p>
              </div>
            ) : (
              principales.map((p) => (
                <PacienteRadarCard
                  key={p.pacienteId}
                  paciente={p}
                  onVerPaciente={abrirPaciente}
                  onIntervencionRegistrada={manejarIntervencionRegistrada}
                />
              ))
            )}
          </div>

          {!filtro && secundarios.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setVerSecundarios((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-surface-muted text-sm font-semibold text-secondary hover:text-text-primary"
              >
                <span>
                  {verSecundarios ? "Ocultar" : "Ver"} pacientes en buen camino y sin historial suficiente ({secundarios.length})
                </span>
                {verSecundarios ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {verSecundarios && (
                <div className="mt-3 space-y-3">
                  {secundarios.map((p) => (
                    <PacienteRadarCard
                      key={p.pacienteId}
                      paciente={p}
                      onVerPaciente={abrirPaciente}
                      onIntervencionRegistrada={manejarIntervencionRegistrada}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!filtro && enSeguimiento !== null && enSeguimiento.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setVerSeguimiento((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-surface-muted text-sm font-semibold text-secondary hover:text-text-primary"
              >
                <span>En seguimiento ({enSeguimiento.length})</span>
                {verSeguimiento ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {verSeguimiento && (
                <div className="mt-3 space-y-3">
                  {enSeguimiento.map((item) => (
                    <SeguimientoCard key={item.intervencion.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : null}

      {cargandoPerfil && (
        <div className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center">
          <div className="bg-white rounded-xl px-4 py-3 text-sm font-medium shadow-lg">Abriendo paciente…</div>
        </div>
      )}

      {perfilSeleccionado && (
        <UserModal
          perfil={perfilSeleccionado}
          initialTab="radar"
          onClose={() => setPerfilSeleccionado(null)}
        />
      )}
    </div>
  );
}
