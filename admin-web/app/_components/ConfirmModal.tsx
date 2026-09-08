"use client";
import { Trash2, TriangleAlert, CircleCheck } from "lucide-react";

const VARIANTS = {
  danger: {
    btn: "bg-error text-white hover:opacity-90",
    iconBg: "bg-error-soft",
    iconColor: "text-error",
    Icon: Trash2,
  },
  warning: {
    btn: "bg-warning text-white hover:opacity-90",
    iconBg: "bg-warning-soft",
    iconColor: "text-warning",
    Icon: TriangleAlert,
  },
  success: {
    btn: "bg-primary text-white hover:bg-primary-dark",
    iconBg: "bg-brand-soft",
    iconColor: "text-primary",
    Icon: CircleCheck,
  },
} as const;

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "success";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const v = VARIANTS[variant];

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col items-center text-center gap-3">
          <div className={`w-14 h-14 rounded-full ${v.iconBg} flex items-center justify-center`}>
            <v.Icon size={26} className={v.iconColor} />
          </div>
          <h3 className="font-bold text-text-primary text-lg">{title}</h3>
          <p className="text-sm text-secondary leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-11 rounded-xl border border-border text-secondary text-sm font-semibold hover:bg-background-secondary transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${v.btn}`}
          >
            {loading ? "Guardando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
