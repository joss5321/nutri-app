import AsyncStorage from '@react-native-async-storage/async-storage'
import { registrarActividad } from '@/lib/api/perfiles'
import { getRadarToday } from '@/lib/radar-date'

// Radar (Blueprint v1.1, R3) — "PATIENT_ACTIVE": una señal por día, no
// tracking por pantalla. El guard local evita llamar al backend más de
// una vez por día por usuario; "hoy" se decide con la misma zona horaria
// oficial de Radar (America/Mexico_City) que el resto de la app, aunque
// lo que se guarda en el servidor es un timestamptz real (now()).
const GUARD_PREFIX = '@radar_last_active_registered_'

export async function registrarActividadSiCorresponde(userId: string): Promise<void> {
  if (!userId) return
  const key = GUARD_PREFIX + userId
  const today = getRadarToday()
  try {
    const last = await AsyncStorage.getItem(key)
    if (last === today) return
    await registrarActividad()
    await AsyncStorage.setItem(key, today)
  } catch {
    // Best-effort: nunca debe interrumpir el uso normal de la app. Si
    // falla, se reintenta en el siguiente mount/foreground.
  }
}
