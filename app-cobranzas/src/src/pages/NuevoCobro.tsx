import { useState } from 'react'
import { supabase, peso, comprimirFoto } from '../supabase'

type Cliente = { id: string; nombre: string; numero_sap: string | null }
type Fac = { numero: string; tipo: 'pagada' | 'parcial' }
type Ch = { numero: string; banco: string; titular: string; fecha: string; monto: string; foto: File | null; vista: string | null }
const CH0: Ch = { numero: '', banco: '', titular: '', fecha: '', monto: '', foto: null, vista: null }

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
  const [cheques, setCheques] = useState<Ch[]>([])
  const [ch, setCh] = useState<Ch>(CH0)
  const [obs, setObs] = useState('')
  const [ok, setOk] = useState(false)
  const [aviso, setAviso] = useState('')
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
  async function crearCliente() {
    const { data, error } = await supabase.from('clientes')
      .insert({ nombre: q.trim(), numero_sap: sap.trim() || null }).select('id,nombre,numero_sap').single()
    if (error) return setErr('No se pudo crear el cliente')
    elegir(data as Cliente)
  }
  function agregarFactura() {
    const n = nf.trim()
    if (!n) return
    setFacs([...facs, { numero: n, tipo: tf }]); setNf('')
  }

  function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (ch.vista) URL.revokeObjectURL(ch.vista)
    setCh({ ...ch, foto: f, vista: URL.createObjectURL(f) })
  }
  function agregarCheque() {
    setErr('')
    if (!(Number(ch.monto) > 0)) return setErr('Ingresá el monto del cheque')
    if (!ch.numero.trim() && !ch.foto) return setErr('Ingresá el número del cheque o sacale una foto')
    setCheques([...cheques, ch]); setCh(CH0)
  }
  function quitarCheque(i: number) {
    const v = cheques[i].vista
    if (v) URL.revokeObjectURL(v)
    setCheques(cheques.filter((_, j) => j !== i))
  }

  async function guardar() {
    setErr('')
    const m = Number(monto)
    if (!cli) return setErr('Elegí un cliente')
    if (!(m > 0)) return setErr('Ingresá el monto cobrado')
    if (forma === 'cheque' && (ch.numero.trim() || ch.monto || ch.foto))
      return setErr('Tenés un cheque a medio cargar: tocá "Agregar cheque" o vaciá sus campos')
    setBusy(true)
    const { data: cobro, error } = await supabase.from('cobros')
      .insert({ cliente_id: cli.id, monto: m, forma_pago: forma, observaciones: obs || null }).select('id').single()
    if (error || !cobro) { setBusy(false); return setErr('No se pudo guardar el cobro') }

    let fallos = 0
    for (const c of forma === 'cheque' ? cheques : []) {
      let foto_path: string | null = null
      if (c.foto) {
        try {
          const blob = await comprimirFoto(c.foto)
          const path = `${cobro.id}/${crypto.randomUUID()}.jpg`
          const { error: e } = await supabase.storage.from('cheques').upload(path, blob, { contentType: 'image/jpeg' })
          if (e) throw e
          foto_path = path
        } catch { fallos++ }
      }
      const { error: e2 } = await supabase.from('cheques').insert({
        cobro_id: cobro.id, numero: c.numero.trim() || null, banco: c.banco.trim() || null,
        titular: c.titular.trim() || null, fecha_cobro: c.fecha || null, monto: Number(c.monto), foto_path })
      if (e2) fallos++
    }
    const filas = facs.map(f => ({ cobro_id: cobro.id, numero_factura: f.numero, tipo: f.tipo }))
    if (filas.length) await supabase.from('cobro_factura').insert(filas)
    if (fallos) setAviso('El cobro se guardó, pero algún cheque o foto no se pudo guardar. Revisalo en el Historial.')
    setBusy(false); setOk(true)
  }

  if (ok) return (<>
    <div className="ok">Cobro registrado</div>
    {aviso && <div className="error">{aviso}</div>}
    <button onClick={volver}>Volver al inicio</button>
  </>)

  const suma = cheques.reduce((s, c) => s + Number(c.monto), 0)
  return (<>
    <div className="card">
      {!cli ? (<>
        <label>Cliente (nombre o N° SAP)<input value={q} onChange={e => setQ(e.target.value)} /></label>
        <button onClick={buscar}>Buscar</button>
        {res?.map(c => <button key={c.id} className="suave" onClick={() => elegir(c)}>{c.nombre} {c.numero_sap && `· SAP ${c.numero_sap}`}</button>)}
        {res?.length === 0 && (<>
          <p>No existe. Crear cliente nuevo con ese nombre:</p>
          <label>N° SAP (opcional)<input value={sap} onChange={e => setSap(e.target.value)} /></label>
          <button onClick={crearCliente}>Crear "{q.trim()}"</button>
        </>)}
      </>) : (
        <div className="fila"><b>{cli.nombre}</b><button className="chico suave" onClick={() => setCli(null)}>Cambiar</button></div>
      )}
    </div>

    {cli && (<div className="card">
      <label>Monto cobrado (total)<input inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} /></label>
      <b>Forma de pago</b>
      <div className="seg">
        <button className={forma === 'efectivo' ? 'on' : ''} onClick={() => setForma('efectivo')}>Efectivo</button>
        <button className={forma === 'cheque' ? 'on' : ''} onClick={() => setForma('cheque')}>Cheque físico</button>
      </div>

      {forma === 'cheque' && (<>
        <b>Cheques (opcional)</b>
        <span className="sub">Podés cargar uno, varios o ninguno.</span>
        {cheques.map((c, i) => (
          <div key={i} className="fila" style={{ justifyContent: 'flex-start' }}>
            {c.vista && <img className="mini" src={c.vista} alt="Cheque" />}
            <div style={{ flex: 1 }}>
              <b>Cheque {c.numero || 's/n'} · {peso(Number(c.monto))}</b>
              <div className="sub">{[c.banco, c.titular, c.fecha && `vence ${c.fecha}`].filter((t): t is string => !!t).join(' · ')}</div>
            </div>
            <button className="chico suave" onClick={() => quitarCheque(i)}>Quitar</button>
          </div>
        ))}
        {cheques.length > 0 && <div className="sub">{cheques.length} cheque(s) cargados · {peso(suma)}</div>}
        <div className="inset">
          <b>{cheques.length ? 'Agregar otro cheque' : 'Agregar cheque'}</b>
          {ch.vista && <img className="foto-grande" src={ch.vista} alt="Foto del cheque" />}
          <label className="btn-foto">📷 {ch.foto ? 'Cambiar foto' : 'Sacar foto del cheque'}
            <input type="file" accept="image/*" capture="environment" hidden onChange={elegirFoto} /></label>
          <label className="btn-foto">🖼️ Elegir de la galería
            <input type="file" accept="image/*" hidden onChange={elegirFoto} /></label>
          <label>N° de cheque<input value={ch.numero} onChange={e => setCh({ ...ch, numero: e.target.value })} /></label>
          <label>Monto del cheque<input inputMode="decimal" value={ch.monto} onChange={e => setCh({ ...ch, monto: e.target.value })} /></label>
          <label>Banco (opcional)<input value={ch.banco} onChange={e => setCh({ ...ch, banco: e.target.value })} /></label>
          <label>Titular (opcional)<input value={ch.titular} onChange={e => setCh({ ...ch, titular: e.target.value })} /></label>
          <label>Fecha de cobro o vencimiento (opcional)<input type="date" value={ch.fecha} onChange={e => setCh({ ...ch, fecha: e.target.value })} /></label>
          <button className="suave" onClick={agregarCheque}>＋ Agregar cheque</button>
        </div>
      </>)}

      <b>Facturas que abona</b>
      <label>N° de factura<input value={nf} onChange={e => setNf(e.target.value)} /></label>
      <div className="seg">
        <button className={tf === 'pagada' ? 'on' : ''} onClick={() => setTf('pagada')}>Pagada</button>
        <button className={tf === 'parcial' ? 'on' : ''} onClick={() => setTf('parcial')}>Pago parcial</button>
      </div>
      <button className="suave" onClick={agregarFactura}>Agregar factura</button>
      {facs.map((f, i) => (
        <div key={i} className="fila"><span>Factura {f.numero} · {f.tipo === 'parcial' ? 'pago parcial' : 'pagada'}</span>
          <button className="chico suave" onClick={() => setFacs(facs.filter((_, j) => j !== i))}>Quitar</button></div>
      ))}
      <label>Observaciones (opcional)<textarea value={obs} onChange={e => setObs(e.target.value)} /></label>
      {err && <div className="error">{err}</div>}
      <button className="primario" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar cobro'}</button>
    </div>)}
    {!cli && err && <div className="error">{err}</div>}
  </>)
}
