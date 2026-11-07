/// <reference path="./deno-shim.d.ts" />
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const peso = (n: number) => '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

const TIPOS: Record<string, string> = { deposito: 'Depósito', gestion: 'Gestión', retiro_documentacion: 'Retiro de documentación', entrega_documentacion: 'Entrega de documentación', otros: 'Otros' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Autorización: viene del cron (secreto compartido) o del usuario autorizado (JWT)
  const secret = Deno.env.get('CRON_SECRET')
  let ok = !!secret && req.headers.get('x-cron-secret') === secret
  if (!ok) {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data } = await db.auth.getUser(jwt)
    ok = data.user?.email?.toLowerCase() === Deno.env.get('EMAIL_AUTORIZADO')!.toLowerCase()
  }
  if (!ok) return json({ error: 'No autorizado' }, 401)

  const body = await req.json().catch(() => ({}))
  const fecha: string = body.fecha ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const ini = new Date(`${fecha}T00:00:00-03:00`)
  const a = ini.toISOString(), b = new Date(ini.getTime() + 864e5).toISOString()

  const { data: cobros } = await db.from('cobros')
    .select('monto,forma_pago,observaciones,clientes(nombre),cheques(numero,banco,titular,fecha_cobro,monto,foto_path),cobro_factura(numero_factura,tipo)')
    .neq('estado', 'anulado').gte('creado_en', a).lt('creado_en', b).order('creado_en')
  const { data: gestiones } = await db.from('gestiones')
    .select('tipo,estado,observaciones,contacto,clientes(nombre)').neq('estado', 'anulada').gte('creado_en', a).lt('creado_en', b)

  // Fotos de cheques: se descargan del almacenamiento privado y se incrustan en el correo (cid)
  const b64 = (u: Uint8Array) => {
    let t = ''
    for (let i = 0; i < u.length; i += 0x8000) t += String.fromCharCode(...u.subarray(i, i + 0x8000))
    return btoa(t)
  }
  const adjuntos: { filename: string; content: string; content_type: string; content_id: string }[] = []
  let bytes = 0, omitidas = 0
  for (const c of (cobros ?? []) as any[]) {
    for (const k of Array.isArray(c.cheques) ? c.cheques : []) {
      if (!k?.foto_path) continue
      const { data: blob, error } = await db.storage.from('cheques').download(k.foto_path)
      if (!blob || error) { omitidas++; continue }
      const buf = new Uint8Array(await blob.arrayBuffer())
      if (bytes + buf.length > 30_000_000) { omitidas++; continue }   // el correo admite ~40 MB en total
      bytes += buf.length
      k.cid = `cheque-${adjuntos.length + 1}`
      adjuntos.push({ filename: `${k.cid}.jpg`, content: b64(buf), content_type: 'image/jpeg', content_id: k.cid })
    }
  }

  const total = ((cobros ?? []) as any[]).reduce<number>((s: number, c: any) => s + Number(c?.monto ?? 0), 0)
  const filas = (cobros ?? []).map((c: any) => {
    const cheques = Array.isArray(c.cheques) ? c.cheques : []
    const facturas = Array.isArray(c.cobro_factura) ? c.cobro_factura : []
    return `<li><b>${esc(c.clientes?.nombre)}</b> — ${peso(c.monto)} (${c.forma_pago})
    ${cheques.map((k: any) => `<br>Cheque ${esc(k.numero || 's/n')} · ${peso(k.monto)}${k.banco ? ' · ' + esc(k.banco) : ''}${k.titular ? ' · ' + esc(k.titular) : ''}${k.fecha_cobro ? ' · vence ' + esc(k.fecha_cobro) : ''}${k.cid ? `<br><img src="cid:${k.cid}" alt="Cheque" style="max-width:320px;width:100%;border-radius:8px;margin-top:4px">` : ''}`).join('')}
    ${facturas.map((f: any) => `<br>Factura ${esc(f.numero_factura)} (${f.tipo === 'parcial' ? 'pago parcial' : 'pagada'})`).join('')}
    ${c.observaciones ? `<br><i>${esc(c.observaciones)}</i>` : ''}</li>`
  }).join('')
  const gs = (gestiones ?? []).map((g: any) => `<li>${esc(TIPOS[g.tipo] ?? g.tipo)} — ${esc(g.clientes?.nombre ?? g.contacto ?? '')} (${g.estado})${g.observaciones ? ': ' + esc(g.observaciones) : ''}</li>`).join('')
  const html = `<div style="font-family:Arial,sans-serif">
    <h2 style="color:#572A82">Resumen de cobranzas — ${esc(fecha)}</h2>
    <p>Total cobrado: <b>${peso(total)}</b> · Cobros: <b>${cobros?.length ?? 0}</b></p>
    <h3>Cobros</h3><ul>${filas || '<li>Sin cobros</li>'}</ul>
    <h3>Gestiones</h3><ul>${gs || '<li>Sin gestiones</li>'}</ul>${omitidas ? `<p>⚠ ${omitidas} foto(s) de cheque no se pudieron adjuntar.</p>` : ''}</div>`

  const { data: dests } = await db.from('destinatarios').select('id,correo').eq('activo', true).eq('recibe_resumen', true)
  if (!dests?.length) return json({ error: 'No hay destinatarios activos. Agregalos en "Destinatarios".', enviados: 0, fallidos: [] })

  let enviados = 0
  const fallidos: { correo: string; error: string }[] = []
  for (const d of dests) {
    let fallo: string | null = null
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: Deno.env.get('MAIL_FROM'), to: [d.correo], subject: `Resumen de cobranzas ${fecha}`, html, ...(adjuntos.length ? { attachments: adjuntos } : {}) }),
      })
      if (!r.ok) fallo = (await r.text()).slice(0, 300)
    } catch (e) { fallo = String(e).slice(0, 300) }
    if (fallo) fallidos.push({ correo: d.correo, error: fallo }); else enviados++
    await db.from('envios').insert({ destinatario_id: d.id, destinatario_correo: d.correo, contenido: `Total ${peso(total)} · ${cobros?.length ?? 0} cobros`, estado: fallo ? 'error' : 'enviado', error: fallo })
  }
  return json({ enviados, fallidos })
})
