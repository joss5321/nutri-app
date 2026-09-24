import type { Perfil } from "@/app/_data/perfiles";
import type {
  NutriologoConsultorio,
  NutriologoDisponibilidad,
  NutriologoExperiencia,
  NutriologoPerfil,
  NutriologoServicio,
  Especialidad,
} from "@/app/_data/nutriologo_perfiles";

/**
 * Indicador de completitud puramente de UX (no se persiste en BD, no es
 * lógica de negocio) — ayuda al superAdmin a ver qué le falta a un perfil.
 */
export function calcularCompletitud(params: {
  perfil: Perfil;
  np: NutriologoPerfil | null;
  especialidades: Especialidad[];
  servicios: NutriologoServicio[];
  experiencia: NutriologoExperiencia[];
  consultorios: NutriologoConsultorio[];
  disponibilidad: NutriologoDisponibilidad[];
}): { porcentaje: number; total: number; completados: number } {
  const { perfil, np, especialidades, servicios, experiencia, consultorios, disponibilidad } = params;

  const checks = [
    !!perfil.avatar_url,
    !!np?.titulo_profesional,
    !!np?.cedula_profesional,
    !!np?.biografia,
    especialidades.length > 0,
    servicios.length > 0,
    experiencia.length > 0,
    consultorios.length > 0 || np?.modalidad === "online" || np?.modalidad === "ambas",
    disponibilidad.some((d) => d.disponible),
  ];

  const completados = checks.filter(Boolean).length;
  const total = checks.length;
  return { porcentaje: Math.round((completados / total) * 100), total, completados };
}
