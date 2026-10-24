import { useState } from 'react'
import { supabase } from '../supabase'
import { IconCheck, IconChevron, IconSearch, IconX } from '../icons'

type Cliente = { id: string; nombre: string; numero_sap: string | null }
type Fac = { numero: string; tipo: 'pagada' | 'parcial' }

export default function NuevoCobro({ volver }: { volver: () => void }) {
  const [q, setQ] = useState('')
  const [sap, setSap] = useState('')
  const [res, setRes] = useState<Cliente[] | null>(null)
  const [cli, setCli] = useState<Cliente | null>(null)
  const [facs, setFacs] = useState<Fac[]>([])
  const [nf, setNf] = useState('')
  const [tf, setTf] = useState<'pagada' | 'parcial'>('pagada')
  const [monto, setMonto] = useState('')
  const [forma, setForma] = useState<'efectivo' | 'cheque'>('efectivo')
  const [ch, setCh] = useState({ numero: '', banco: '', titular: '', fecha: '' })
  const [obs, setObs] = useState('')
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function buscar() {
    const t = q.trim().replace(/[%,()]/g, '')
    if (!t) return
    const { data } = await supabase.from('clientes').select('id,nombre,numero_sap')
      .or(`nombre.ilike.%${t}%,numero_sap.ilike.%${t}%`).limit(8)
    setRes(data ?? [])
  }
  function elegir(c: Cliente) { setCli(c); setRes(null) }
  function agregarFactura() {
    const n = nf.trim()
    if (!n) return
    setFacs([...facs, { numero: n, tipo: tf }]); setNf('')
  }
  async function crearCliente() {
    const { data, error } = await supabase.from('clientes')
      .insert({ nombre: q.trim(), numero_sap: sap.trim() || null }).select('id,nombre,numero_sap').single()
    if (error) return setErr('No se pudo crear el cliente')
    elegir(data as Cliente)
  }

  async function guardar() {
    setErr('')
    const m = Number(monto)
    if (!cli) return setErr('Elegí un cliente')
    if (!(m > 0)) return setErr('Ingresá el monto cobrado')
    if (forma === 'cheque' && (!ch.numero || !ch.banco || !ch.titular || !ch.fecha)) return setErr('Completá los datos del cheque')
    setBusy(true)
    const { data: cobro, error } = await supabase.from('cobros')
      .insert({ cliente_id: cli.id, monto: m, forma_pago: forma, observaciones: obs || null }).select('id').single()
    if (error || !cobro) { setBusy(false); return setErr('No se pudo guardar el cobro') }
    if (forma === 'cheque') await supabase.from('cheques').insert({
      cobro_id: cobro.id, numero: ch.numero, banco: ch.banco, titular: ch.titular, fecha_cobro: ch.fecha, monto: m })
    const filas = facs.map(f => ({ cobro_id: cobro.id, numero_factura: f.numero, tipo: f.tipo }))
    if (filas.length) await supabase.from('cobro_factura').insert(filas)
    setBusy(false); setOk(true)
  }

  if (ok) return (
    <div className="success">
      <div className="success-ico"><IconCheck size={30} /></div>
      <h2>Cobro registrado</h2>
      <p className="muted">El cobro ya forma parte del resumen del día.</p>
      <button className="cta" onClick={volver}>Volver al inicio</button>
    </div>
  )

  return (<>
    <div className="card">
      <div className="card-head">
        <h2>Cliente</h2>
        {cli && <button className="ghost" onClick={() => setCli(null)}>Cambiar</button>}
      </div>

      {!cli ? (<>
        <div className="field">
          <span className="field-label">Buscar por nombre o N° SAP</span>
          <div className="input-action">
            <input value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') buscar() }} placeholder="Ej. Transporte del Norte" />
            <button className="btn-search" onClick={buscar} aria-label="Buscar cliente"><IconSearch /></button>
          </div>
        </div>

        {res?.map(c => (
          <button key={c.id} className="pick" onClick={() => elegir(c)}>
            <span className="pick-text">
              <b>{c.nombre}</b>
              {c.numero_sap && <small>SAP {c.numero_sap}</small>}
            </span>
            <IconChevron size={18} />
          </button>
        ))}

        {res?.length === 0 && (
          <div className="create-box">
            <p>No encontramos ese cliente. Podés crearlo ahora.</p>
            <label>N° SAP (opcional)<input value={sap} onChange={e => setSap(e.target.value)} /></label>
            <button className="btn-soft" onClick={crearCliente}>Crear “{q.trim()}”</button>
          </div>
        )}
      </>) : (
        <div className="selected">
          <span className="selected-ico">{cli.nombre.slice(0, 1).toUpperCase()}</span>
          <span className="pick-text">
            <b>{cli.nombre}</b>
            <small>{cli.numero_sap ? `SAP ${cli.numero_sap}` : 'Sin N° SAP'}</small>
          </span>
        </div>
      )}

      {!cli && err && <div className="error">{err}</div>}
    </div>

    {cli && (<>
      <div className="card">
        <h2>Datos del cobro</h2>
        <label>Monto cobrado
          <input inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} placeholder="$ 0,00" />
        </label>

        <div className="field">
          <span className="field-label">Forma de pago</span>
          <div className="segmented">
            <button className={forma === 'efectivo' ? 'on' : ''} onClick={() => setForma('efectivo')}>Efectivo</button>
            <button className={forma === 'cheque' ? 'on' : ''} onClick={() => setForma('cheque')}>Cheque físico</button>
          </div>
        </div>

        {forma === 'cheque' && (
          <div className="sub-block">
            <label>N° de cheque<input value={ch.numero} onChange={e => setCh({ ...ch, numero: e.target.value })} /></label>
            <label>Banco<input value={ch.banco} onChange={e => setCh({ ...ch, banco: e.target.value })} /></label>
            <label>Titular<input value={ch.titular} onChange={e => setCh({ ...ch, titular: e.target.value })} /></label>
            <label>Fecha de cobro o vencimiento<input type="date" value={ch.fecha} onChange={e => setCh({ ...ch, fecha: e.target.value })} /></label>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Facturas que abona</h2>
        <div className="field">
          <span className="field-label">N° de factura</span>
          <div className="input-action">
            <input value={nf} onChange={e => setNf(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') agregarFactura() }} placeholder="Ej. 0001-00012345" />
            <button className="btn-search" onClick={agregarFactura} aria-label="Agregar factura">Agregar</button>
          </div>
        </div>

        <div className="segmented">
          <button className={tf === 'pagada' ? 'on' : ''} onClick={() => setTf('pagada')}>Pagada</button>
          <button className={tf === 'parcial' ? 'on' : ''} onClick={() => setTf('parcial')}>Pago parcial</button>
        </div>

        {facs.length > 0 && (
          <div className="list">
            {facs.map((f, i) => (
              <div key={i} className="list-item">
                <span className="pick-text">
                  <b>Factura {f.numero}</b>
                  <small>{f.tipo === 'parcial' ? 'Pago parcial' : 'Pagada'}</small>
                </span>
                <button className="btn-x" onClick={() => setFacs(facs.filter((_, j) => j !== i))} aria-label="Quitar factura"><IconX size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <label>Observaciones (opcional)
          <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Notas del cobro" />
        </label>
        {err && <div className="error">{err}</div>}
        <button className="cta" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar cobro'}</button>
      </div>
    </>)}
  </>)
}
