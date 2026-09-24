// components/PasswordInput.tsx
"use client";
import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";


export default function PasswordInput({ value, onChange, placeholder = "Contraseña" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="flex items-center gap-3 bg-surface-muted rounded-2xl px-4 h-14 border border-transparent focus-within:border-primary transition-colors">
      <Lock size={18} className="text-muted shrink-0" />
      <input
        type={showPass ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="flex-1 bg-transparent outline-none text-text-primary text-sm"
      />
      <span
        onMouseDown={(e) => {
          e.preventDefault();
          setShowPass((v) => !v);
        }}
        className="text-muted hover:text-secondary select-none cursor-pointer p-1"
      >
      
        {showPass ? (
            <EyeOff size={18} className="text-muted hover:text-secondary cursor-pointer" />
        ) : (
            <Eye size={18} className="text-muted hover:text-secondary cursor-pointer" />
        )}
      </span>
    </div>
  );
}