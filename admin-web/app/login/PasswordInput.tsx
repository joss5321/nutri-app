// components/PasswordInput.tsx
"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";


export default function PasswordInput({ value, onChange }: { 
  value: string; 
  onChange: (v: string) => void 
}) {
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 h-14 border border-transparent focus-within:border-primary transition-colors">
      <span className="text-gray-400 text-lg">🔒</span>
      <input
        type={showPass ? "text" : "password"}
        placeholder="Contraseña"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
      />
      <span
        onMouseDown={(e) => {
          e.preventDefault();
          setShowPass((v) => !v);
        }}
        className="text-gray-400 hover:text-gray-600 select-none cursor-pointer p-1"
      >
      
        {showPass ? (
            <EyeOff size={18} className="text-gray-400 hover:text-gray-600 cursor-pointer" />
        ) : (
            <Eye size={18} className="text-gray-400 hover:text-gray-600 cursor-pointer" />
        )}
      </span>
    </div>
  );
}