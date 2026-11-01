import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const peso = (n: number) => '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const horaAR = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', {
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
})
const ubicacion = (lat: number | null, lon: number | null) =>
  lat === null || lon === null
    ? 'Ubicación no disponible'
    : `<a href="https://maps.google.com/?q=${encodeURIComponent(`${lat},${lon}`)}">Ver ubicación en el mapa</a>`

const TIPOS: Record<string, string> = { deposito: 'Depósito', gestion: 'Gestión', retiro_documentacion: 'Retiro de documentación', entrega_documentacion: 'Entrega de documentación', otros: 'Otros' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Autorización: viene del cron (secreto compartido) o del usuario autorizado (JWT)
  const secret = Deno.env.get('CRON_SECRET')
  const esCron = !!secret && req.headers.get('x-cron-secret') === secret
  let ok = esCron
  if (!ok) {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data } = await db.auth.getUser(jwt)
    ok = data.user?.email?.toLowerCase() === Deno.env.get('EMAIL_AUTORIZADO')!.toLowerCase()
  }
  if (!ok) return json({ error: 'No autorizado' }, 401)

  const body = await req.json().catch(() => ({}))
  let fecha: string
  if (body.automatico === true) {
    if (!esCron) return json({ error: 'No autorizado para ejecutar el envío automático' }, 401)
    const { data: fechaAutomatica, error: errorReclamo } = await db.rpc('reclamar_envio_resumen_automatico')
    if (errorReclamo) {
      console.error('No se pudo reclamar el envío automático:', errorReclamo.message)
      return json({ error: 'No se pudo comprobar el horario automático' }, 500)
    }
    if (!fechaAutomatica) return json({ enviado: false, motivo: 'No corresponde enviar ahora' })
    fecha = fechaAutomatica
  } else {
    fecha = body.fecha ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  }
  const ini = new Date(`${fecha}T00:00:00-03:00`)
  const a = ini.toISOString(), b = new Date(ini.getTime() + 864e5).toISOString()

  const { data: cobros } = await db.from('cobros')
    .select('monto,forma_pago,observaciones,clientes(nombre),cheques(numero,banco,titular,fecha_cobro,monto),cobro_factura(numero_factura,tipo)')
    .neq('estado', 'anulado').gte('creado_en', a).lt('creado_en', b).order('creado_en')
  const { data: gestiones } = await db.from('gestiones')
    .select('tipo,estado,observaciones,contacto,clientes(nombre)').neq('estado', 'anulada').gte('creado_en', a).lt('creado_en', b)
  const { data: almuerzos } = await db.from('almuerzos')
    .select('iniciado_en,finalizado_en,latitud_inicio,longitud_inicio,latitud_fin,longitud_fin')
    .gte('iniciado_en', a).lt('iniciado_en', b).order('iniciado_en')

  const total = (cobros ?? []).reduce((s, c) => s + Number(c.monto), 0)
  const filas = (cobros ?? []).map((c: any) => `<li><b>${esc(c.clientes?.nombre)}</b> — ${peso(c.monto)} (${c.forma_pago})
    ${c.cheques.map((k: any) => `<br>Cheque ${esc(k.numero || 's/n')} · ${peso(k.monto)}${k.banco ? ' · ' + esc(k.banco) : ''}${k.titular ? ' · ' + esc(k.titular) : ''}${k.fecha_cobro ? ' · vence ' + esc(k.fecha_cobro) : ''}`).join('')}
    ${c.cobro_factura.map((f: any) => `<br>Factura ${esc(f.numero_factura)} (${f.tipo === 'parcial' ? 'pago parcial' : 'pagada'})`).join('')}
    ${c.observaciones ? `<br><i>${esc(c.observaciones)}</i>` : ''}</li>`).join('')
  const gs = (gestiones ?? []).map((g: any) => `<li>${esc(TIPOS[g.tipo] ?? g.tipo)} — ${esc(g.clientes?.nombre ?? g.contacto ?? '')} (${g.estado})${g.observaciones ? ': ' + esc(g.observaciones) : ''}</li>`).join('')
  const als = (almuerzos ?? []).map((al: any) => {
    const termino = al.finalizado_en ? new Date(al.finalizado_en) : new Date()
    const inicio = new Date(al.iniciado_en)
    const minutos = Math.max(0, Math.floor((termino.getTime() - inicio.getTime()) / 60000))
    const tiempo = `${Math.floor(minutos / 60)} h ${minutos % 60} min`
    return `<li>${horaAR(al.iniciado_en)}–${al.finalizado_en ? horaAR(al.finalizado_en) : 'en curso'} · ${tiempo}<br>
      Inicio: ${ubicacion(al.latitud_inicio, al.longitud_inicio)}<br>
      Fin: ${ubicacion(al.latitud_fin, al.longitud_fin)}</li>`
  }).join('')
  const html = `<div style="font-family:Arial,sans-serif">
    <h2 style="color:#572A82">Resumen de cobranzas — ${esc(fecha)}</h2>
    <p>Total cobrado: <b>${peso(total)}</b> · Cobros: <b>${cobros?.length ?? 0}</b></p>
    <h3>Cobros</h3><ul>${filas || '<li>Sin cobros</li>'}</ul>
    <h3>Gestiones</h3><ul>${gs || '<li>Sin gestiones</li>'}</ul>
    <h3>Almuerzos</h3><ul>${als || '<li>Sin registros de almuerzo</li>'}</ul></div>`

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
        body: JSON.stringify({ from: Deno.env.get('MAIL_FROM'), to: [d.correo], subject: `Resumen de cobranzas ${fecha}`, html }),
      })
      if (!r.ok) fallo = (await r.text()).slice(0, 300)
    } catch (e) { fallo = String(e).slice(0, 300) }
    if (fallo) fallidos.push({ correo: d.correo, error: fallo }); else enviados++
    await db.from('envios').insert({ destinatario_id: d.id, destinatario_correo: d.correo, contenido: `Total ${peso(total)} · ${cobros?.length ?? 0} cobros`, estado: fallo ? 'error' : 'enviado', error: fallo })
  }
  return json({ enviados, fallidos })
})
