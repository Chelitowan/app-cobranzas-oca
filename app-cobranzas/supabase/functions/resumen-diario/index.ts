import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const peso = (n: number) => '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

const TIPOS: Record<string, string> = { deposito: 'Depósito', gestion: 'Gestión', retiro_documentacion: 'Retiro de documentación', entrega_documentacion: 'Entrega de documentación', otros: 'Otros' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'EMAIL_AUTORIZADO', 'RESEND_API_KEY', 'MAIL_FROM']
  const missing = required.filter((name) => !Deno.env.get(name))
  if (missing.length) return json({ error: `Faltan secretos de Supabase: ${missing.join(', ')}` }, 500)

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

  const { data: cobros, error: cobrosError } = await db.from('cobros')
    .select('monto,forma_pago,observaciones,clientes(nombre),cheques(numero,banco,titular,fecha_cobro,monto),cobro_factura(numero_factura,tipo)')
    .neq('estado', 'anulado').gte('creado_en', a).lt('creado_en', b).order('creado_en')
  if (cobrosError) return json({ error: `No se pudieron consultar los cobros: ${cobrosError.message}` }, 500)
  const { data: gestiones, error: gestionesError } = await db.from('gestiones')
    .select('tipo,estado,observaciones,contacto,clientes(nombre)').neq('estado', 'anulada').gte('creado_en', a).lt('creado_en', b)
  if (gestionesError) return json({ error: `No se pudieron consultar las gestiones: ${gestionesError.message}` }, 500)

  const total = (cobros ?? []).reduce((s, c) => s + Number(c.monto), 0)
  const filas = (cobros ?? []).map((c: any) => `<li><b>${esc(c.clientes?.nombre)}</b> — ${peso(c.monto)} (${c.forma_pago})
    ${c.cheques.map((k: any) => `<br>Cheque ${esc(k.numero)} · ${esc(k.banco)} · ${esc(k.titular)} · vence ${esc(k.fecha_cobro)}`).join('')}
    ${c.cobro_factura.map((f: any) => `<br>Factura ${esc(f.numero_factura)} (${f.tipo === 'parcial' ? 'pago parcial' : 'pagada'})`).join('')}
    ${c.observaciones ? `<br><i>${esc(c.observaciones)}</i>` : ''}</li>`).join('')
  const gs = (gestiones ?? []).map((g: any) => `<li>${esc(TIPOS[g.tipo] ?? g.tipo)} — ${esc(g.clientes?.nombre ?? g.contacto ?? '')} (${g.estado})${g.observaciones ? ': ' + esc(g.observaciones) : ''}</li>`).join('')
  const html = `<div style="font-family:Arial,sans-serif">
    <h2 style="color:#572A82">Resumen de cobranzas — ${esc(fecha)}</h2>
    <p>Total cobrado: <b>${peso(total)}</b> · Cobros: <b>${cobros?.length ?? 0}</b></p>
    <h3>Cobros</h3><ul>${filas || '<li>Sin cobros</li>'}</ul>
    <h3>Gestiones</h3><ul>${gs || '<li>Sin gestiones</li>'}</ul></div>`

  const { data: dests, error: destsError } = await db.from('destinatarios').select('id,correo').eq('activo', true).eq('recibe_resumen', true)
  if (destsError) return json({ error: `No se pudieron consultar los destinatarios: ${destsError.message}` }, 500)
  if (!dests?.length) return json({ error: 'No hay destinatarios activos' }, 400)

  let enviados = 0
  const fallidos: { correo: string; error: string }[] = []
  for (const d of dests) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('MAIL_FROM'), to: [d.correo], subject: `Resumen de cobranzas ${fecha}`, html }),
    })
    const fallo = r.ok ? null : await r.text()
    if (r.ok) enviados++
    else fallidos.push({ correo: d.correo, error: fallo ?? 'Error desconocido de Resend' })
    await db.from('envios').insert({ destinatario_id: d.id, destinatario_correo: d.correo, contenido: `Total ${peso(total)} · ${cobros?.length ?? 0} cobros`, estado: r.ok ? 'enviado' : 'error', error: fallo })
  }
  return json({ enviados, fallidos })
})
