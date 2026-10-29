import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Elimina la cuenta del usuario autenticado (Guideline 5.1.1(v) de Apple).
 * A diferencia del resto de los wrappers de Edge Functions de este
 * archivo-hermano (pagos.ts), aquí sí importa mostrarle al usuario el
 * motivo real del rechazo (ej. "tienes pacientes asignados") — por eso se
 * lee el body del error en vez de conformarse con el mensaje genérico de
 * FunctionsHttpError ("Edge Function returned a non-2xx status code").
 */
export async function eliminarCuenta(): Promise<void> {
  const { error } = await supabase.functions.invoke('eliminar-cuenta', { body: {} })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      // El throw va FUERA del try: si quedara adentro, el catch de abajo
      // (pensado solo para un body que no es JSON válido) se atraparía a
      // sí mismo y nunca llegaría a mostrar el mensaje real.
      let mensaje: string | null = null
      try {
        const body = await error.context.json()
        mensaje = body?.error ?? null
      } catch {
        // El body no era JSON válido — sigue con el error genérico.
      }
      throw new Error(mensaje || error.message)
    }
    throw error
  }
}
