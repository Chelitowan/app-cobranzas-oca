import { createClient } from '@supabase/supabase-js'

// Solo clave PÚBLICA (anon). La seguridad real la da RLS en la base.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
export const EMAIL_OK = (import.meta.env.VITE_EMAIL_AUTORIZADO as string).toLowerCase()

export const peso = (n: number) => '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })

export function parseImporte(valor: string): number | null {
  let normalizado = valor.trim().replace(/[\s\u00a0$]/g, '')
  if (!normalizado) return null

  const coma = normalizado.lastIndexOf(',')
  const punto = normalizado.lastIndexOf('.')
  if (coma >= 0 && punto >= 0) {
    normalizado = coma > punto
      ? normalizado.replace(/\./g, '').replace(',', '.')
      : normalizado.replace(/,/g, '')
  } else if (coma >= 0) {
    normalizado = normalizado.replace(',', '.')
  }

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizado)) return null
  const importe = Number(normalizado)
  return Number.isFinite(importe) ? importe : null
}

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

// Achica la foto (máx. 1600 px, JPEG) para que suba rápido desde el celular
export async function comprimirFoto(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const c = document.createElement('canvas')
  try {
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    c.width = Math.max(1, Math.round(bmp.width * k))
    c.height = Math.max(1, Math.round(bmp.height * k))
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('No se pudo preparar el lienzo para comprimir la foto')
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    return await new Promise((res, rej) =>
      c.toBlob(blob => (blob ? res(blob) : rej(new Error('No se pudo comprimir la foto'))), 'image/jpeg', 0.7)
    )
  } finally {
    bmp.close()
    c.width = 0
    c.height = 0
  }
}
