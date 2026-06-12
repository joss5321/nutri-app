"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard",  icon: "📊" },
  { href: "/usuarios",  label: "Usuarios",   icon: "👥" },
  { href: "/rutinas",   label: "Rutinas",    icon: "🏋️" },
  { href: "/recetas",   label: "Recetas",    icon: "🥗" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-60 shrink-0 bg-sidebar h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-white font-bold">M</span>
        </div>
        <span className="text-white font-bold text-lg tracking-wide">MyFitTrack</span>
      </div>

      {/* Coach avatar */}
      <div className="flex flex-col items-center py-6 border-b border-white/10 gap-2">
        <div className="w-20 h-20 rounded-full bg-primary/30 border-2 border-primary flex items-center justify-center text-3xl">
          👨‍💼
        </div>
        <span className="text-white font-semibold text-sm">Coach Admin</span>
        <span className="text-white/50 text-xs">admin@myfittrack.com</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-4">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                active
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      {/* Cerrar sesión */}
      <div className="px-3 pb-6">
        <Link
          href="/login"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-white/10 hover:text-white text-sm font-semibold transition-colors"
        >
          <span>🚪</span>
          Cerrar sesión
        </Link>
      </div>
    </aside>
  );
}
