"use client";
import { AtSign, Globe, Music2, ThumbsUp } from "lucide-react";
import type { NutriologoPerfil } from "@/app/_data/nutriologo_perfiles";
import { FieldLabel, inputCls, SectionSaveBar, type SaveState } from "./shared";

const CAMPOS = [
  { key: "instagram_url" as const, label: "Instagram", icon: AtSign, placeholder: "https://instagram.com/tu-usuario" },
  { key: "facebook_url" as const, label: "Facebook", icon: ThumbsUp, placeholder: "https://facebook.com/tu-pagina" },
  { key: "tiktok_url" as const, label: "TikTok", icon: Music2, placeholder: "https://tiktok.com/@tu-usuario" },
  { key: "sitio_web_url" as const, label: "Sitio web", icon: Globe, placeholder: "https://tu-sitio.com" },
];

export default function RedesTab({
  np,
  onChange,
  dirty,
  saveState,
  errorMessage,
  onSave,
  canEdit,
}: {
  np: NutriologoPerfil;
  onChange: (patch: Partial<NutriologoPerfil>) => void;
  dirty: boolean;
  saveState: SaveState;
  errorMessage: string | null;
  onSave: () => void;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      {CAMPOS.map((c) => (
        <div key={c.key}>
          <FieldLabel>
            <span className="inline-flex items-center gap-1.5"><c.icon size={13} /> {c.label}</span>
          </FieldLabel>
          <input
            disabled={!canEdit}
            value={np[c.key] ?? ""}
            onChange={(e) => onChange({ [c.key]: e.target.value || null })}
            placeholder={c.placeholder}
            className={inputCls}
          />
        </div>
      ))}
      <p className="text-xs text-muted">Las URLs deben comenzar con http:// o https://.</p>
      {canEdit && <SectionSaveBar dirty={dirty} state={saveState} errorMessage={errorMessage} onSave={onSave} />}
    </div>
  );
}
