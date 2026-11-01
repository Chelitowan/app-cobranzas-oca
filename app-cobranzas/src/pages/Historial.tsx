import { useCallback, useEffect, useState } from 'react'
import { supabase, peso, hoyAR, rangoDia, hora, TIPOS_GESTION } from '../supabase'

type Cobro = {
  id: string; monto: number; forma_pago: string; estado: string; observaciones: string | null; creado_en: string
  clientes: { nombre: string } | null
  cheques: { numero: string | null; banco: string | null; titular: string | null; fecha_cobro: string | null; monto: number; foto_path: string | null }[]
  cobro_factura: { numero_factura: string; tipo: string }[]
}
type Gestion = {
  id: string; tipo: string; contacto: string | null; observaciones: string | null; creado_en: string
  clientes: { nombre: string }[] | null
}
type Envio = { id: string; fecha_envio: string; destinatario_correo: string; estado: string }

export default function Historial() {
  const [fecha, setFecha] = useState(hoyAR())
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [gestiones, setGestiones] = useState<Gestion[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; s: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [fotos, setFotos] = useState<Record<string, string>>({})

  const cargar = useCallback(async () => {
    const [a, b] = rangoDia(fecha)
    const c = await supabase.from('cobros')
      .select('id,monto,forma_pago,estado,observaciones,creado_en,clientes(nombre),cheques(numero,banco,titular,fecha_cobro,monto,foto_path),cobro_factura(numero_factura,tipo)')
      .gte('creado_en', a).lt('creado_en', b).order('creado_en', { ascending: false })
    const lista = (c.data as unknown as Cobro[]) ?? []
    setCobros(lista)
    const paths = lista.flatMap(x => x.cheques.map(k => k.foto_path).filter((p): p is string => !!p))
    if (paths.length) {
      const { data } = await supabase.storage.from('cheques').createSignedUrls(paths, 3600)
      setFotos((data ?? []).reduce<Record<string, string>>((urls, d) => {
        if (d.path && d.signedUrl) urls[d.path] = d.signedUrl
        return urls
      }, {}))
    } else setFotos({})
    const g = await supabase.from('gestiones').select('id,tipo,contacto,observaciones,creado_en,clientes(nombre)')
      .neq('estado', 'anulada').gte('creado_en', a).lt('creado_en', b).order('creado_en', { ascending: false })
    setGestiones(g.data ?? [])
    const e = await supabase.from('envios').select('id,fecha_envio,destinatario_correo,estado').order('fecha_envio', { ascending: false }).limit(5)
    setEnvios(e.data ?? [])
  }, [fecha])
  useEffect(() => { cargar() }, [cargar])

  const vigentes = cobros.filter(c => c.estado !== 'anulado')
  const total = vigentes.reduce((s, c) => s + Number(c.monto), 0)

  async function anular(id: string) {
    if (!confirm('¿Anular este cobro? No se borra, queda marcado como anulado.')) return
    await supabase.from('cobros').update({ estado: 'anulado' }).eq('id', id)
    cargar()
  }
  async function enviar() {
    setEnviando(true); setMsg(null)
    const { data, error } = await supabase.functions.invoke('resumen-diario', { body: { fecha } })
    setEnviando(false)
    const fallidos: { correo: string; error: string }[] = data?.fallidos ?? []
    const enviados: number = data?.enviados ?? 0
    if (error) setMsg({ t: 'error', s: 'No se pudo enviar el resumen. Revisá la conexión y que la función esté publicada.' })
    else if (data?.error) setMsg({ t: 'error', s: data.error })
    else if (enviados === 0) setMsg({ t: 'error', s: 'No se envió ningún correo. Fallaron: ' + fallidos.map(x => x.correo).join(', ') })
    else if (fallidos.length) setMsg({ t: 'error', s: `Enviado a ${enviados}, pero falló para: ${fallidos.map(x => x.correo).join(', ')}` })
    else setMsg({ t: 'ok', s: `Resumen enviado a ${enviados} destinatario(s)` })
    cargar()
  }

  return (<>
    <label>Día<input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
    <div className="card"><div className="sub">{vigentes.length} cobros · {gestiones.length} gestiones</div><div className="total">{peso(total)}</div></div>

    <h3>Cobros</h3>
    {cobros.length === 0 && <p className="sub">Sin cobros este día.</p>}
    {cobros.map(c => (
      <div key={c.id} className={`card ${c.estado === 'anulado' ? 'anulado' : ''}`}>
        <div className="fila"><b>{c.clientes?.nombre}</b><b>{peso(c.monto)}</b></div>
        <div className="sub">{hora(c.creado_en)} · {c.forma_pago === 'cheque' ? 'Cheque' : 'Efectivo'} · {c.estado}</div>
        {c.cheques.map((k, i) => (
          <div key={i} className="fila" style={{ justifyContent: 'flex-start' }}>
            {k.foto_path && fotos[k.foto_path] && <a href={fotos[k.foto_path]} target="_blank" rel="noreferrer"><img className="mini" src={fotos[k.foto_path]} alt="Cheque" /></a>}
            <span>Cheque {k.numero || 's/n'} · {peso(k.monto)}{[k.banco, k.titular, k.fecha_cobro && `vence ${k.fecha_cobro}`].filter((t): t is string => !!t).map(t => ' · ' + t).join('')}</span>
          </div>
        ))}
        {c.cobro_factura.map((f, i) => <div key={i}>Factura {f.numero_factura} · {f.tipo === 'parcial' ? 'pago parcial' : 'pagada'}</div>)}
        {c.observaciones && <i>{c.observaciones}</i>}
        {c.estado !== 'anulado' && <button className="chico suave" onClick={() => anular(c.id)}>Anular</button>}
      </div>
    ))}

    <h3>Gestiones</h3>
    {gestiones.length === 0 && <p className="sub">Sin gestiones este día.</p>}
    {gestiones.map(g => (
      <div key={g.id} className="card">
        <div className="fila"><b>{TIPOS_GESTION[g.tipo] ?? g.tipo}</b><span className="sub">{hora(g.creado_en)}</span></div>
        {(g.clientes?.[0]?.nombre || g.contacto) && <div>{g.clientes?.[0]?.nombre ?? g.contacto}</div>}
        {g.observaciones && <i>{g.observaciones}</i>}
      </div>
    ))}

    {msg && <div className={msg.t}>{msg.s}</div>}
    <button className="primario" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar resumen ahora'}</button>

    <h3>Últimos envíos</h3>
    {envios.length === 0 && <p className="sub">Todavía no se envió ningún resumen.</p>}
    {envios.map(e => (
      <div key={e.id} className="fila sub"><span>{new Date(e.fecha_envio).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} · {e.destinatario_correo}</span><b>{e.estado === 'enviado' ? '✔ enviado' : '✖ error'}</b></div>
    ))}
  </>)
}
