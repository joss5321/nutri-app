import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  initialized: boolean
  // true mientras el usuario está en medio del flujo de recuperación de
  // contraseña (sesión creada vía el deep link de reset-password, no un
  // login normal). Mientras sea true, index.tsx/(auth)/(app) no deben
  // redirigir automáticamente a /(app) solo porque session existe.
  isPasswordRecovery: boolean
  setSession: (session: Session | null) => void
  setInitialized: (initialized: boolean) => void
  setPasswordRecovery: (value: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  initialized: false,
  isPasswordRecovery: false,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setInitialized: (initialized) => set({ initialized }),
  setPasswordRecovery: (value) => set({ isPasswordRecovery: value }),
}))
