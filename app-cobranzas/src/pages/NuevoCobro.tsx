import { useEffect, useState, type ChangeEvent } from 'react'
import { supabase, peso, parseImporte, comprimirFoto } from '../supabase'
import { useClientesSugeridos, type Cliente } from '../useClientesSugeridos'

type Fac = { numero: string; tipo: 'pagada' | 'parcial' }
type Ch = { numero: string; banco: string; titular: string; fecha: string; monto: string; foto: File | null; fotoComprimida: Blob | null; vista: string | null }
const CH0: Ch = { numero: '', banco: '', titular: '', fecha: '', monto: '', foto: null, fotoComprimida: null, vista: null }

function idArchivo(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export default function NuevoCobro({ volver }: { volver: () => void }) {
  const [q, setQ] = useState('')
  const [sap, setSap] = useState('')
  const [cli, setCli] = useState<Cliente | null>(null)
  const [facs, setFacs] = useState<Fac[]>([])
  const [nf, setNf] = useState('')
  const [facturasSugeridas, setFacturasSugeridas] = useState<string[]>([])
  const [buscandoFacturas, setBuscandoFacturas] = useState(false)
  const [errorFacturas, setErrorFacturas] = useState('')
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
  const [paso, setPaso] = useState('')
  const sugerenciasCliente = useClientesSugeridos(q)

  function elegir(c: Cliente) { setCli(c); setQ('') }
  async function crearCliente() {
    const { data, error } = await supabase.from('clientes')
      .insert({ nombre: q.trim(), numero_sap: sap.trim() || null }).select('id,nombre,numero_sap').single()
    if (error) return setErr(`No se pudo crear el cliente: ${error.message}`)
    elegir(data as Cliente)
  }
  useEffect(() => {
    let vigente = true
    const texto = nf.trim().replace(/[%_,()\\]/g, '')
    setFacturasSugeridas([])
    setErrorFacturas('')
    if (!texto) {
      setBuscandoFacturas(false)
      return
    }
    setBuscandoFacturas(true)
    const temporizador = window.setTimeout(async () => {
      const { data, error } = await supabase.from('cobro_factura')
        .select('numero_factura')
        .ilike('numero_factura', `${texto}%`)
        .order('creado_en', { ascending: false })
        .limit(30)
      if (!vigente) return
      if (error) setErrorFacturas(`No se pudieron consultar facturas anteriores: ${error.message}`)
      else setFacturasSugeridas([...new Set((data ?? []).map(f => f.numero_factura))].slice(0, 8))
      setBuscandoFacturas(false)
    }, 250)
    return () => {
      vigente = false
      window.clearTimeout(temporizador)
    }
  }, [nf])
  function agregarFactura() {
    const n = nf.trim()
    if (!n) return
    setFacs([...facs, { numero: n, tipo: tf }]); setNf('')
  }

  async function elegirFoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (ch.vista) URL.revokeObjectURL(ch.vista)
    setErr('')
    setCh({ ...ch, foto: f, fotoComprimida: null, vista: null })
    try {
      const fotoComprimida = await comprimirFoto(f)
      const vista = URL.createObjectURL(fotoComprimida)
      setCh(actual => {
        if (actual.foto !== f) {
          URL.revokeObjectURL(vista)
          return actual
        }
        return { ...actual, foto: null, fotoComprimida, vista }
      })
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e)
      setCh(actual => actual.foto === f ? { ...actual, foto: null, fotoComprimida: null, vista: null } : actual)
      setErr(`No se pudo preparar la foto: ${detalle}`)
    }
  }
  function agregarCheque() {
    setErr('')
    if (ch.foto && !ch.fotoComprimida) return setErr('Esperá a que termine de prepararse la foto')
    const importe = parseImporte(ch.monto)
    if (importe === null || !(importe > 0)) return setErr('Ingresá un monto válido para el cheque')
    if (!ch.numero.trim() && !ch.fotoComprimida) return setErr('Ingresá el número del cheque o sacale una foto')
    setCheques([...cheques, ch]); setCh(CH0)
  }
  function quitarCheque(i: number) {
    const v = cheques[i].vista
    if (v) URL.revokeObjectURL(v)
    setCheques(cheques.filter((_, j) => j !== i))
  }

  async function limpiarFotos(paths: string[]): Promise<string | null> {
    if (!paths.length) return null
    try {
      const { error } = await supabase.storage.from('cheques').remove(paths)
      return error?.message ?? null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }

  async function guardar() {
    setErr('')
    const m = parseImporte(monto)
    if (!cli) return setErr('Elegí un cliente')
    if (m === null || !(m > 0)) return setErr('Ingresá un monto válido')
    if (forma === 'cheque' && (ch.numero.trim() || ch.monto || ch.foto || ch.fotoComprimida))
      return setErr('Tenés un cheque a medio cargar: tocá "Agregar cheque" o vaciá sus campos')
    setBusy(true)
    setPaso('')
    const fotosSubidas: string[] = []
    const chequesGuardar: {
      numero: string | null; banco: string | null; titular: string | null
      fecha_cobro: string | null; monto: number; foto_path: string | null
    }[] = []

    for (const c of forma === 'cheque' ? cheques : []) {
      let foto_path: string | null = null
      if (c.fotoComprimida) {
        try {
          setPaso('Subiendo la foto del cheque…')
          const path = `${idArchivo()}.jpg`
          const { error } = await supabase.storage.from('cheques').upload(path, c.fotoComprimida, { contentType: 'image/jpeg' })
          if (error) throw error
          foto_path = path
          fotosSubidas.push(path)
        } catch (e) {
          const errorLimpieza = await limpiarFotos(fotosSubidas)
          const detalle = e instanceof Error ? e.message : String(e)
          setErr(`No se pudo preparar o subir la foto del cheque: ${detalle}.${errorLimpieza ? ` No se pudieron limpiar las fotos subidas: ${errorLimpieza}` : ''}`)
          setBusy(false)
          setPaso('')
          return
        }
      }
      chequesGuardar.push({
        numero: c.numero.trim() || null, banco: c.banco.trim() || null,
        titular: c.titular.trim() || null, fecha_cobro: c.fecha || null,
        monto: parseImporte(c.monto) ?? 0, foto_path,
      })
    }

    try {
      setPaso('Guardando el cobro y sus detalles…')
      const { error } = await supabase.rpc('registrar_cobro', {
        p_cliente_id: cli.id,
        p_monto: m,
        p_forma_pago: forma,
        p_observaciones: obs.trim() || null,
        p_cheques: chequesGuardar,
        p_facturas: facs.map(f => ({ numero_factura: f.numero, tipo: f.tipo })),
      })
      if (error) {
        const errorLimpieza = await limpiarFotos(fotosSubidas)
        setErr(`No se guardó el cobro ni sus cheques o facturas: ${error.message}.${errorLimpieza ? ` No se pudieron limpiar las fotos subidas: ${errorLimpieza}` : ''}`)
        setBusy(false)
        setPaso('')
        return
      }
      setBusy(false)
      setPaso('')
      setOk(true)
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e)
      setErr(`No se pudo confirmar el guardado del cobro: ${detalle}. Revisá el Historial antes de volver a intentarlo; si el servidor llegó a guardarlo, las fotos deben permanecer disponibles.`)
      setBusy(false)
      setPaso('')
    }
  }

  if (ok) return (<>
    <div className="ok">Cobro registrado</div>
    {aviso && <div className="error">{aviso}</div>}
    <button onClick={volver}>Volver al inicio</button>
  </>)

  const suma = cheques.reduce((s, c) => s + (parseImporte(c.monto) ?? 0), 0)
  return (<>
    <div className="card">
      {!cli ? (<>
        <label>Cliente (nombre o N° SAP)<input value={q} onChange={e => { setQ(e.target.value); setErr('') }} autoComplete="off" /></label>
        {sugerenciasCliente.buscando && <div className="sub" role="status">Buscando clientes…</div>}
        {sugerenciasCliente.error && <div className="error">No se pudieron buscar clientes: {sugerenciasCliente.error}</div>}
        {sugerenciasCliente.clientes.length > 0 && <div className="sugerencias" aria-label="Clientes sugeridos">
          {sugerenciasCliente.clientes.map(c => <button type="button" key={c.id} className="suave" onClick={() => elegir(c)}>
            {c.nombre}{c.numero_sap && ` · SAP ${c.numero_sap}`}
          </button>)}
        </div>}
        {q.trim() && sugerenciasCliente.consultado && !sugerenciasCliente.buscando && !sugerenciasCliente.error && sugerenciasCliente.clientes.length === 0 && (<>
          <p>No existe. Crear cliente nuevo con ese nombre:</p>
          <label>N° SAP (opcional)<input value={sap} onChange={e => setSap(e.target.value)} /></label>
          <button onClick={crearCliente}>Crear "{q.trim()}"</button>
        </>)}
      </>) : (
        <div className="fila"><b>{cli.nombre}</b><button className="chico suave" onClick={() => setCli(null)}>Cambiar</button></div>
      )}
    </div>

    {cli && (<div className="card">
      <label>Monto cobrado (total)<input type="text" inputMode="decimal" placeholder="Ej.: 1250,50" value={monto} onChange={e => setMonto(e.target.value)} /></label>
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
              <b>Cheque {c.numero || 's/n'} · {peso(parseImporte(c.monto) ?? 0)}</b>
              <div className="sub">{[c.banco, c.titular, c.fecha && `vence ${c.fecha}`].filter((t): t is string => !!t).join(' · ')}</div>
            </div>
            <button className="chico suave" onClick={() => quitarCheque(i)}>Quitar</button>
          </div>
        ))}
        {cheques.length > 0 && <div className="sub">{cheques.length} cheque(s) cargados · {peso(suma)}</div>}
        <div className="inset">
          <b>{cheques.length ? 'Agregar otro cheque' : 'Agregar cheque'}</b>
          {ch.foto && <div className="sub" role="status" aria-live="polite">Optimizando la foto para el celular…</div>}
          {ch.vista && <img className="foto-grande" src={ch.vista} alt="Foto del cheque" />}
          <label className="btn-foto">📷 {ch.fotoComprimida ? 'Cambiar foto' : 'Sacar foto del cheque'}
            <input type="file" accept="image/*" capture="environment" hidden onChange={elegirFoto} /></label>
          <label className="btn-foto">🖼️ Elegir de la galería
            <input type="file" accept="image/*" hidden onChange={elegirFoto} /></label>
          <label>N° de cheque<input value={ch.numero} onChange={e => setCh({ ...ch, numero: e.target.value })} /></label>
          <label>Monto del cheque<input type="text" inputMode="decimal" placeholder="Ej.: 1250,50" value={ch.monto} onChange={e => setCh({ ...ch, monto: e.target.value })} /></label>
          <label>Banco (opcional)<input value={ch.banco} onChange={e => setCh({ ...ch, banco: e.target.value })} /></label>
          <label>Titular (opcional)<input value={ch.titular} onChange={e => setCh({ ...ch, titular: e.target.value })} /></label>
          <label>Fecha de cobro o vencimiento (opcional)<input type="date" value={ch.fecha} onChange={e => setCh({ ...ch, fecha: e.target.value })} /></label>
          <button className="suave" disabled={!!ch.foto} onClick={agregarCheque}>＋ Agregar cheque</button>
        </div>
      </>)}

      <b>Facturas que abona</b>
      <label>N° de factura<input value={nf} onChange={e => setNf(e.target.value)} autoComplete="off" /></label>
      {buscandoFacturas && <div className="sub" role="status">Buscando facturas anteriores…</div>}
      {errorFacturas && <div className="error">{errorFacturas}</div>}
      {facturasSugeridas.length > 0 && <div className="sugerencias" aria-label="Facturas ya cargadas">
        <span className="sub">Facturas ya cargadas (seleccioná para completar)</span>
        {facturasSugeridas.map(n => <button type="button" key={n} className="suave" onClick={() => setNf(n)}>{n}</button>)}
      </div>}
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
      {busy && paso && <div className="sub" role="status" aria-live="polite">{paso}</div>}
      <button className="primario" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar cobro'}</button>
    </div>)}
    {!cli && err && <div className="error">{err}</div>}
  </>)
}
