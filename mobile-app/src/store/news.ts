import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

type NewsState = {
  hasNewRutinas: boolean
  hasNewNutricion: boolean
  checkAll: (userId: string) => Promise<void>
  markRutinasViewed: (userId: string) => Promise<void>
  markNutricionViewed: (userId: string) => Promise<void>
}

export const useNewsStore = create<NewsState>((set) => ({
  hasNewRutinas: false,
  hasNewNutricion: false,

  checkAll: async (userId: string) => {
    try {
      const [storedRutinas, storedNutricion] = await Promise.all([
        AsyncStorage.getItem(`last_viewed_rutinas_${userId}`),
        AsyncStorage.getItem(`last_viewed_nutricion_${userId}`),
      ])
      const lastRutinas = storedRutinas ? new Date(storedRutinas) : new Date(0)
      const lastNutricion = storedNutricion ? new Date(storedNutricion) : new Date(0)

      const [{ data: rutina }, { data: plan }] = await Promise.all([
        supabase
          .from('rutinas')
          .select('created_at')
          .eq('user_id', userId)
          .eq('activa', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('planes_nutricionales')
          .select('created_at')
          .eq('user_id', userId)
          .eq('activo', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      set({
        hasNewRutinas: rutina?.created_at ? new Date(rutina.created_at) > lastRutinas : false,
        hasNewNutricion: plan?.created_at ? new Date(plan.created_at) > lastNutricion : false,
      })
    } catch {}
  },

  markRutinasViewed: async (userId: string) => {
    try {
      await AsyncStorage.setItem(`last_viewed_rutinas_${userId}`, new Date().toISOString())
    } catch {}
    set({ hasNewRutinas: false })
  },

  markNutricionViewed: async (userId: string) => {
    try {
      await AsyncStorage.setItem(`last_viewed_nutricion_${userId}`, new Date().toISOString())
    } catch {}
    set({ hasNewNutricion: false })
  },
}))
