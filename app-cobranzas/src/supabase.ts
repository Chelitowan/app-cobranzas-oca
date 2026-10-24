import { createClient } from '@supabase/supabase-js'

// Solo clave PÚBLICA (anon). La seguridad real la da RLS en la base.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
export const EMAIL_OK = (import.meta.env.VITE_EMAIL_AUTORIZADO as string).toLowerCase()

export const peso = (n: number) => '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })

export const hoyAR = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

// Rango [00:00, 24:00) de un día en hora argentina (UTC-3)
export function rangoDia(fecha: string): [string, string] {
  const ini = new Date(`${fecha}T00:00:00-03:00`)
  return [ini.toISOString(), new Date(ini.getTime() + 864e5).toISOString()]
}

export const TIPOS_GESTION: Record<string, string> = {
  deposito: 'Depósito',
  gestion: 'Gestión',
  retiro_documentacion: 'Retiro de documentación',
  entrega_documentacion: 'Entrega de documentación',
  otros: 'Otros',
}
export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
