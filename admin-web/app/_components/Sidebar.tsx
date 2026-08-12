"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  Users,
  Utensils,
  CalendarDays,
  Pill,
  Apple,
  ChefHat,
  Dumbbell,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type LucideIcon = React.ComponentType<{
  size?: number;
  className?: string;
  strokeWidth?: number;
}>;

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavSection = { label: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    label: "GENERAL",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/usuarios", label: "Pacientes", icon: Users },
    ],
  },
  {
    label: "PLANES",
    items: [
      { href: "/nutricion", label: "Nutrición", icon: Utensils },
      { href: "/rutinas", label: "Rutinas", icon: CalendarDays },
    ],
  },
  {
    label: "CATÁLOGOS",
    items: [
      { href: "/alimentos", label: "Alimentos", icon: Apple },
      { href: "/recetas", label: "Recetas", icon: ChefHat },
      { href: "/ejercicios", label: "Ejercicios", icon: Dumbbell },
      { href: "/suplementos", label: "Suplementos", icon: Pill },
    ],
  },
  {
    label: "ADMINISTRACIÓN",
    items: [
      { href: "/administradores", label: "Administradores", icon: ShieldCheck },
      { href: "/mi-perfil", label: "Configuración", icon: Settings },
    ],
  },
];

/* ── Tooltip para estado colapsado ───────────────────────────────────── */
function Tooltip({ label }: { label: string }) {
  return (
    <div
      className="
        absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
        px-2.5 py-1.5 rounded-md bg-gray-900/95 text-white text-xs font-medium
        whitespace-nowrap shadow-xl pointer-events-none
        opacity-0 group-hover:opacity-100 transition-opacity duration-150
      "
      role="tooltip"
    >
      {label}
      {/* Caret apuntando hacia la izquierda (hacia el ícono) */}
      <span className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-4 border-transparent border-r-gray-900" />
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState("Coach Admin");
  const [rol, setRol] = useState<string>("admin");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Seguro: el Sidebar solo monta en el cliente (el AdminLayout muestra
  // un spinner hasta resolver la autenticación), por lo que leer
  // localStorage en el inicializador de estado no causa hydration mismatch.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch { /* noop */ }
      return next;
    });
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setName(user.user_metadata?.full_name || user.email || "Coach Admin");
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("avatar_url, nombre_completo, rol")
        .eq("id", user.id)
        .single();
      if (perfil) {
        if (perfil.nombre_completo) setName(perfil.nombre_completo);
        if (perfil.avatar_url) setAvatarUrl(perfil.avatar_url);
        if (perfil.rol) setRol(perfil.rol);
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const rolLabel = rol === "superadmin" ? "SuperAdmin" : "Administrador";

  // Ref al <nav> para manipular su clase directamente desde los eventos
  // del <aside> sin provocar re-renders de React.
  const navRef = useRef<HTMLElement>(null);
  const showScrollbar = () => navRef.current?.classList.add("sidebar-scrollbar-visible");
  const hideScrollbar = () => navRef.current?.classList.remove("sidebar-scrollbar-visible");

  return (
    <aside
      onMouseEnter={showScrollbar}
      onMouseLeave={hideScrollbar}
      className={`
        flex flex-col shrink-0 h-full bg-sidebar overflow-hidden
        transition-[width] duration-200 ease-in-out
        ${collapsed ? "w-16" : "w-56"}
      `}
    >
      {/* ── Logo / Header ─────────────────────────────────────────── */}
      <div
        className={`
          flex items-center shrink-0 h-14 border-b border-white/8
          ${collapsed ? "justify-center px-2" : "px-4"}
        `}
      >
        {collapsed ? (
          <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0">
            <Image
              src="/myFitTrackLogo.PNG"
              alt="MyFitTrack"
              fill
              className="object-cover object-left"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/myFitTrackLogo.PNG"
              alt="MyFitTrack"
              width={160}
              height={40}
              style={{ height: 34, width: "auto" }}
              className="object-contain shrink-0"
            />
            <div className="min-w-0 overflow-hidden">
              <p className="text-white font-bold text-sm leading-tight tracking-tight">
                MyFitTrack
              </p>
              <p className="text-white/35 text-[10px] leading-tight tracking-[0.18em] uppercase">
                Fitness Management
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Perfil de usuario ──────────────────────────────────────── */}
      <div
        className={`
          flex items-center shrink-0 h-14 border-b border-white/8
          ${collapsed ? "justify-center" : "px-4 gap-3"}
        `}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name}
            width={34}
            height={34}
            className="w-[34px] h-[34px] rounded-full object-cover border border-white/20 shrink-0"
          />
        ) : (
          <div className="w-[34px] h-[34px] rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-300 font-semibold text-xs shrink-0 select-none">
            {initials}
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-white text-sm font-semibold leading-tight truncate">
              {name}
            </p>
            <p className="text-white/40 text-xs leading-tight">{rolLabel}</p>
          </div>
        )}
      </div>

      {/* ── Navegación (scrollable) ────────────────────────────────── */}
      <nav ref={navRef} className="sidebar-nav flex-1 overflow-y-auto overflow-x-hidden py-2 flex flex-col">
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.label} className={si > 0 ? "mt-4" : ""}>

            {/* Etiqueta de sección */}
            {!collapsed ? (
              <p className="px-4 mb-1 text-[10px] font-semibold tracking-widest text-white/28 uppercase select-none">
                {section.label}
              </p>
            ) : (
              si > 0 && (
                <div className="mx-auto mb-2.5 w-5 h-px bg-white/10" />
              )
            )}

            {/* Items */}
            <div className={`flex flex-col gap-0.5 ${collapsed ? "items-center px-2" : "px-2"}`}>
              {section.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <div key={item.href} className="relative group w-full">

                    {/* Barra vertical activa (estilo Notion/Linear) — solo en modo expandido */}
                    {isActive && !collapsed && (
                      <span
                        className="absolute left-0 top-[18%] bottom-[18%] w-[3px] bg-green-400 rounded-r-full pointer-events-none z-10"
                        aria-hidden
                      />
                    )}

                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`
                        flex items-center rounded-lg outline-none
                        transition-colors duration-150
                        focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-1
                        ${collapsed
                          ? "justify-center w-10 h-10 mx-auto"
                          : "gap-3 px-3 py-1.5 w-full"
                        }
                        ${isActive
                          ? "bg-green-500/15 text-white"
                          : "text-white/55 hover:bg-sidebar-hover hover:text-white"
                        }
                      `}
                    >
                      <Icon
                        size={16}
                        strokeWidth={isActive ? 2.5 : 2}
                        className={`shrink-0 transition-colors duration-150 ${
                          isActive ? "text-green-400" : ""
                        }`}
                      />
                      {!collapsed && (
                        <>
                          <span className="text-sm font-medium flex-1 truncate">
                            {item.label}
                          </span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                          )}
                        </>
                      )}
                    </Link>

                    {/* Tooltip (solo en modo colapsado) */}
                    {collapsed && <Tooltip label={item.label} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Acciones inferiores (fijo) ─────────────────────────────── */}
      <div className="shrink-0 border-t border-white/8 px-2 py-2">

        {/* Toggle contraer/expandir */}
        <div className="relative group">
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            className={`
              flex items-center rounded-lg text-white/35
              hover:text-white/70 hover:bg-white/6
              transition-colors duration-150 w-full outline-none
              focus-visible:ring-2 focus-visible:ring-green-400
              ${collapsed
                ? "justify-center w-10 h-9 mx-auto"
                : "gap-2.5 px-3 py-1.5"
              }
            `}
          >
            {collapsed ? (
              <ChevronRight size={15} strokeWidth={2} />
            ) : (
              <>
                <ChevronLeft size={15} strokeWidth={2} />
                <span className="text-xs font-medium">Contraer menú</span>
              </>
            )}
          </button>
          {collapsed && <Tooltip label="Expandir menú" />}
        </div>

        {/* Cerrar sesión */}
        <div className="relative group mt-0.5">
          <button
            onClick={handleLogout}
            className={`
              flex items-center rounded-lg text-white/35
              hover:text-red-400 hover:bg-red-500/8
              transition-colors duration-150 w-full outline-none
              focus-visible:ring-2 focus-visible:ring-red-400
              ${collapsed
                ? "justify-center w-10 h-9 mx-auto"
                : "gap-2.5 px-3 py-1.5"
              }
            `}
          >
            <LogOut size={15} strokeWidth={2} className="shrink-0" />
            {!collapsed && (
              <span className="text-xs font-medium">Cerrar sesión</span>
            )}
          </button>
          {collapsed && <Tooltip label="Cerrar sesión" />}
        </div>
      </div>
    </aside>
  );
}
