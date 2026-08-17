"use client";
import type { Exercise } from "@/app/_data/exercises";
import {
  tx,
  MUSCLE_ES,
  DIFFICULTY_ES,
  BODY_PART_ES,
  EQUIPMENT_ES,
  CATEGORY_ES,
  MECHANIC_ES,
  FORCE_ES,
} from "@/app/_data/workoutx-i18n";
import { proxyGifUrl } from "@/app/_data/gif-proxy";

export default function EjercicioDetalleModal({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const isWorkoutX = exercise.source === "workoutx";

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl shrink-0">{exercise.emoji || "💪"}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-gray-900 text-xl leading-tight">{exercise.nombre}</h2>
                {isWorkoutX && (
                  <span className="shrink-0 text-xs bg-violet-100 text-violet-700 font-bold px-2.5 py-0.5 rounded-full">
                    WorkoutX
                  </span>
                )}
              </div>
              {exercise.category && (
                <p className="text-sm text-gray-500 mt-0.5">{tx(CATEGORY_ES, exercise.category)}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl ml-3"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* GIF / video / emoji */}
          <div className="bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center h-56">
            {proxyGifUrl(exercise.gif_url) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={proxyGifUrl(exercise.gif_url)!}
                alt={exercise.nombre}
                className="h-full w-full object-contain"
              />
            ) : exercise.video_url ? (
              <video src={exercise.video_url} className="h-full w-full object-cover" autoPlay loop muted playsInline />
            ) : (
              <span className="text-6xl">{exercise.emoji || "💪"}</span>
            )}
          </div>

          {/* Tags rápidos */}
          <div className="flex flex-wrap gap-2">
            {exercise.grupo_muscular && (
              <Chip color="primary">{tx(MUSCLE_ES, exercise.grupo_muscular)}</Chip>
            )}
            {exercise.grupos_secundarios?.map((m) => (
              <Chip key={m} color="gray">{tx(MUSCLE_ES, m)}</Chip>
            ))}
            {exercise.difficulty && (
              <Chip color="amber">{tx(DIFFICULTY_ES, exercise.difficulty)}</Chip>
            )}
            {exercise.body_part && (
              <Chip color="blue">{tx(BODY_PART_ES, exercise.body_part)}</Chip>
            )}
            {exercise.equipment && (
              <Chip color="teal">{tx(EQUIPMENT_ES, exercise.equipment)}</Chip>
            )}
          </div>

          {/* Descripción */}
          {exercise.descripcion && (
            <div>
              <Label>Descripción</Label>
              <p className="text-sm text-gray-700 leading-relaxed">{exercise.descripcion}</p>
            </div>
          )}

          {/* Instrucciones */}
          {exercise.instrucciones && exercise.instrucciones.length > 0 && (
            <div>
              <Label>Instrucciones</Label>
              <ol className="space-y-2">
                {exercise.instrucciones.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Datos de entrenamiento */}
          {(exercise.recommended_sets || exercise.recommended_reps) && (
            <div className="grid grid-cols-2 gap-3">
              {exercise.recommended_sets && (
                <Stat label="Series recomendadas">{exercise.recommended_sets}</Stat>
              )}
              {exercise.recommended_reps && (
                <Stat label="Repeticiones recomendadas">{exercise.recommended_reps}</Stat>
              )}
            </div>
          )}

          {/* Métricas avanzadas */}
          {(exercise.met || exercise.calories_per_minute || exercise.mechanic || exercise.force) && (
            <div>
              <Label>Métricas</Label>
              <div className="grid grid-cols-2 gap-3">
                {exercise.mechanic && (
                  <Stat label="Mecánica">{tx(MECHANIC_ES, exercise.mechanic)}</Stat>
                )}
                {exercise.force && (
                  <Stat label="Tipo de fuerza">{tx(FORCE_ES, exercise.force)}</Stat>
                )}
                {exercise.met && <Stat label="MET">{exercise.met}</Stat>}
                {exercise.calories_per_minute && (
                  <Stat label="Cal/min">{exercise.calories_per_minute}</Stat>
                )}
              </div>
            </div>
          )}

          {/* Tags de movimiento */}
          {exercise.movement_tags && exercise.movement_tags.length > 0 && (
            <div>
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap gap-1.5">
                {exercise.movement_tags.map((t) => (
                  <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {exercise.is_unilateral && (
            <p className="text-xs text-gray-400 italic">Ejercicio unilateral</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Átomos de UI locales ──────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{children}</p>;
}

const CHIP_COLORS = {
  primary: "bg-primary/10 text-primary",
  gray:    "bg-gray-100 text-gray-600",
  amber:   "bg-amber-50 text-amber-700",
  blue:    "bg-blue-50 text-blue-700",
  teal:    "bg-teal-50 text-teal-700",
};

function Chip({
  children,
  color = "gray",
}: {
  children: React.ReactNode;
  color?: keyof typeof CHIP_COLORS;
}) {
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${CHIP_COLORS[color]}`}>
      {children}
    </span>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{children}</p>
    </div>
  );
}
