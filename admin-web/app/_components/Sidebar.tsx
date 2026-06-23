"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { label: string; icon: string; children: NavItem[] };
type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

const NAV: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/usuarios", label: "Usuarios", icon: "👥" },
  {
    label: "Asignación de planes", icon: "📋",
    children: [
      { href: "/rutinas", label: "Rutinas", icon: "🏋️" },
      { href: "/nutricion", label: "Nutrición", icon: "🥗" },
    ],
  },
  {
    label: "Catálogos", icon: "📂",
    children: [
      { href: "/ejercicios", label: "Ejercicios", icon: "💪" },
      { href: "/recetas", label: "Recetas", icon: "🍽" },
      { href: "/suplementos", label: "Suplementos", icon: "💊" },
    ],
  },
  {
    label: "Configuración", icon: "⚙️",
    children: [
      { href: "/administradores", label: "Admins", icon: "🛡️" },
      { href: "/mi-perfil", label: "Mi Perfil", icon: "👤" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState("Coach Admin");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const entry of NAV) {
      if (isGroup(entry) && entry.children.some((c) => pathname.startsWith(c.href))) {
        initial[entry.label] = true;
      }
    }
    return initial;
  });
  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setName(user.user_metadata?.full_name || user.email || "Coach Admin");
      setEmail(user.email ?? "");
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("avatar_url, nombre_completo")
        .eq("id", user.id)
        .single();
      if (perfil) {
        if (perfil.nombre_completo) setName(perfil.nombre_completo);
        if (perfil.avatar_url) setAvatarUrl(perfil.avatar_url);
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="flex flex-col w-60 shrink-0 bg-sidebar h-full">
      {/* Logo */}
      <div className="flex items-center justify-center px-6 py-6 border-b border-white/10">
        <Image
          src="/logo-icon.png"
          alt="MyFitTrack"
          width={140}
          height={140}
          className="rounded-xl object-contain"
        />
      </div>

      {/* Coach avatar */}
      <div className="flex flex-col items-center py-6 border-b border-white/10 gap-2">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={80} height={80} className="w-20 h-20 rounded-full object-cover border-2 border-primary" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary/30 border-2 border-primary flex items-center justify-center text-white font-bold text-2xl">
            {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="text-white font-semibold text-sm">{name}</span>
        {email && <span className="text-white/50 text-xs">{email}</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-4">
        {NAV.map((entry) => {
          if (isGroup(entry)) {
            const groupActive = entry.children.some((c) => pathname.startsWith(c.href));
            return (
              <div key={entry.label}>
                <button
                  onClick={() => toggleGroup(entry.label)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    groupActive ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="text-base">{entry.icon}</span>
                  {entry.label}
                  <span className={`ml-auto text-xs transition-transform ${openGroups[entry.label] ? "rotate-180" : ""}`}>▾</span>
                </button>
                {openGroups[entry.label] && (
                  <div className="flex flex-col gap-0.5 mt-0.5 ml-4 pl-3 border-l border-white/10">
                    {entry.children.map((child) => {
                      const active = pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                            active ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span className="text-base">{child.icon}</span>
                          {child.label}
                          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = pathname.startsWith(entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                active ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base">{entry.icon}</span>
              {entry.label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      {/* Cerrar sesión */}
      <div className="px-3 pb-6">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-white/10 hover:text-white text-sm font-semibold transition-colors"
        >
          <span>🚪</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
