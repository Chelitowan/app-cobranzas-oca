import { useState } from 'react'
import { supabase, TIPOS_GESTION } from '../supabase'
import { IconCheck } from '../icons'

export default function Gestion({ volver }: { volver: () => void }) {
  const [tipo, setTipo] = useState('')
  const [contacto, setContacto] = useState('')
  const [obs, setObs] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)

  async function guardar() {
    setErr('')
    if (!tipo) return setErr('Elegí qué hiciste')
    if (tipo === 'otros' && !obs.trim()) return setErr('Escribí una descripción de lo que hiciste')
    setBusy(true)
    const { error } = await supabase.from('gestiones').insert({
      tipo, contacto: contacto.trim() || null, observaciones: obs.trim() || null, estado: 'realizada' })
    setBusy(false)
    if (error) return setErr('No se pudo guardar la gestión')
    setOk(true)
  }

  if (ok) return (
    <div className="success">
      <div className="success-ico"><IconCheck size={30} /></div>
      <h2>Gestión registrada</h2>
      <p className="muted">La gestión ya forma parte del resumen del día.</p>
      <button className="cta" onClick={volver}>Volver al inicio</button>
    </div>
  )

  return (<>
    <div className="card">
      <h2>¿Qué hiciste?</h2>
      <div className="opts">
        {Object.entries(TIPOS_GESTION).map(([k, v]) => (
          <button key={k} className={tipo === k ? 'opt on' : 'opt'} onClick={() => setTipo(k)}>{v}</button>
        ))}
      </div>
      {!tipo && err && <div className="error">{err}</div>}
    </div>

    {tipo && (
      <div className="card">
        <label>Cliente o contacto (opcional)
          <input value={contacto} onChange={e => setContacto(e.target.value)} placeholder="Nombre o N° SAP" />
        </label>
        <label>{tipo === 'otros' ? 'Descripción de lo que hiciste' : 'Observaciones (opcional)'}
          <textarea rows={4} value={obs} onChange={e => setObs(e.target.value)} placeholder="Detalle de la gestión" />
        </label>
        {err && <div className="error">{err}</div>}
        <button className="cta" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar gestión'}</button>
      </div>
    )}
  </>)
}
