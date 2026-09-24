"use client";
import { Check, Lock, Loader2 } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Barra de "Guardar cambios" por sección — nunca autosave (decisión explícita del producto). */
export function SectionSaveBar({
  dirty,
  state,
  errorMessage,
  onSave,
  disabled,
}: {
  dirty: boolean;
  state: SaveState;
  errorMessage?: string | null;
  onSave: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <div className="text-xs">
        {state === "error" && errorMessage && <span className="text-error font-medium">{errorMessage}</span>}
        {state === "saved" && !dirty && <span className="text-success font-medium inline-flex items-center gap-1"><Check size={12} /> Guardado</span>}
        {dirty && state !== "saving" && <span className="text-warning font-medium">Tienes cambios sin guardar</span>}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || state === "saving" || disabled}
        className="flex items-center gap-2 px-4 h-9 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      >
        {state === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        {state === "saving" ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}

/** Marca visual para campos reservados a superAdmin (verificado/destacado/orden_directorio). */
export function AdminOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
      <Lock size={10} /> Solo superAdmin
    </span>
  );
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="text-xs text-secondary font-medium block mb-1">
      {children} {hint && <span className="text-muted font-normal">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full h-10 border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-primary disabled:bg-background-secondary disabled:text-muted";
export const textareaCls =
  "w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none disabled:bg-background-secondary disabled:text-muted";

export function EmptyListState({ text }: { text: string }) {
  return <p className="text-sm text-muted text-center py-8">{text}</p>;
}
