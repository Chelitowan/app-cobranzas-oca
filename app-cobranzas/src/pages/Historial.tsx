import { useCallback, useEffect, useState } from 'react'
import { supabase, peso, hoyAR, rangoDia, hora, TIPOS_GESTION } from '../supabase'

type Cobro = {
  id: string; monto: number; forma_pago: string; estado: string; observaciones: string | null; creado_en: string
  clientes: { nombre: string } | null
  cheques: { numero: string; banco: string; titular: string; fecha_cobro: string }[]
  cobro_factura: { numero_factura: string; tipo: string }[]
}
type Gestion = { id: string; tipo: string; contacto: string | null; observaciones: string | null; creado_en: string }
type Envio = { id: string; fecha_envio: string; destinatario_correo: string; estado: string }

export default function Historial() {
  const [fecha, setFecha] = useState(hoyAR())
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [gestiones, setGestiones] = useState<Gestion[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; s: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    const [a, b] = rangoDia(fecha)
    const c = await supabase.from('cobros')
      .select('id,monto,forma_pago,estado,observaciones,creado_en,clientes(nombre),cheques(numero,banco,titular,fecha_cobro),cobro_factura(numero_factura,tipo)')
      .gte('creado_en', a).lt('creado_en', b).order('creado_en', { ascending: false })
    setCobros((c.data as unknown as Cobro[]) ?? [])
    const g = await supabase.from('gestiones').select('id,tipo,contacto,observaciones,creado_en')
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
    let detalle = error?.message
    if (error?.context instanceof Response) {
      const respuesta = await error.context.clone().json().catch(() => null)
      if (typeof respuesta?.error === 'string') detalle = respuesta.error
    }

    if (error || data?.error) {
      setMsg({ t: 'error', s: detalle ?? data?.error ?? 'No se pudo enviar el resumen' })
    } else if (data?.fallidos?.length) {
      const fallos = data.fallidos.map((f: { correo: string; error: string }) => `${f.correo}: ${f.error}`).join(' · ')
      setMsg({ t: 'error', s: `Enviados: ${data.enviados}. Fallidos: ${fallos}` })
    } else {
      setMsg({ t: 'ok', s: `Resumen enviado a ${data.enviados} destinatario(s)` })
    }
    cargar()
  }

  return (<>
    <div className="card">
      <label>Día
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      </label>
    </div>

    <div className="summary">
      <div className="summary-top">
        <span>{vigentes.length} cobros · {gestiones.length} gestiones</span>
        <span className="hero-pill">Total</span>
      </div>
      <div className="summary-total">{peso(total)}</div>
    </div>

    <div className="section-row">
      <h3>Cobros</h3>
      <span className="count">{cobros.length}</span>
    </div>
    {cobros.length === 0 && <p className="empty">Sin cobros este día.</p>}
    {cobros.map(c => (
      <article key={c.id} className={`card entry ${c.estado === 'anulado' ? 'anulado' : ''}`}>
        <div className="entry-head">
          <b className="entry-title">{c.clientes?.nombre}</b>
          <span className="amount">{peso(c.monto)}</span>
        </div>
        <div className="entry-meta">
          <span className="chip">{c.forma_pago === 'cheque' ? 'Cheque' : 'Efectivo'}</span>
          <span>{hora(c.creado_en)}</span>
          {c.estado === 'anulado' && <span className="chip chip-danger">Anulado</span>}
        </div>
        {c.cheques.map((k, i) => (
          <div key={i} className="detail">Cheque {k.numero} · {k.banco} · {k.titular} · vence {k.fecha_cobro}</div>
        ))}
        {c.cobro_factura.map((f, i) => (
          <div key={i} className="detail">Factura {f.numero_factura} · {f.tipo === 'parcial' ? 'pago parcial' : 'pagada'}</div>
        ))}
        {c.observaciones && <p className="note">{c.observaciones}</p>}
        {c.estado !== 'anulado' && <button className="ghost danger" onClick={() => anular(c.id)}>Anular cobro</button>}
      </article>
    ))}

    <div className="section-row">
      <h3>Gestiones</h3>
      <span className="count">{gestiones.length}</span>
    </div>
    {gestiones.length === 0 && <p className="empty">Sin gestiones este día.</p>}
    {gestiones.map(g => (
      <article key={g.id} className="card entry">
        <div className="entry-head">
          <b className="entry-title">{TIPOS_GESTION[g.tipo] ?? g.tipo}</b>
          <span className="entry-time">{hora(g.creado_en)}</span>
        </div>
        {g.contacto && <div className="detail">{g.contacto}</div>}
        {g.observaciones && <p className="note">{g.observaciones}</p>}
      </article>
    ))}

    {msg && <div className={msg.t}>{msg.s}</div>}
    <button className="cta" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar resumen ahora'}</button>

    <div className="section-row">
      <h3>Últimos envíos</h3>
    </div>
    {envios.length === 0 && <p className="empty">Todavía no se envió ningún resumen.</p>}
    {envios.length > 0 && (
      <div className="card list">
        {envios.map(e => (
          <div key={e.id} className="list-item">
            <span className="pick-text">
              <b>{e.destinatario_correo}</b>
              <small>{new Date(e.fecha_envio).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</small>
            </span>
            <span className={`chip ${e.estado === 'enviado' ? 'chip-ok' : 'chip-danger'}`}>
              {e.estado === 'enviado' ? 'Enviado' : 'Error'}
            </span>
          </div>
        ))}
      </div>
    )}
  </>)
}
