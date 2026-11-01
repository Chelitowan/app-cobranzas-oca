import { useState } from 'react'
import { supabase, TIPOS_GESTION } from '../supabase'

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

  if (ok) return (<><div className="ok">Gestión registrada</div><button onClick={volver}>Volver al inicio</button></>)
  return (<>
    <div className="card">
      <b>¿Qué hiciste?</b>
      <div className="opts">
        {Object.entries(TIPOS_GESTION).map(([k, v]) => (
          <button key={k} className={tipo === k ? 'opt on' : 'opt'} onClick={() => setTipo(k)}>{v}</button>
        ))}
      </div>
    </div>
    {tipo && (<div className="card">
      <label>Cliente o contacto (opcional)<input value={contacto} onChange={e => setContacto(e.target.value)} /></label>
      <label>{tipo === 'otros' ? 'Descripción de lo que hiciste' : 'Observaciones (opcional)'}
        <textarea rows={4} value={obs} onChange={e => setObs(e.target.value)} /></label>
      {err && <div className="error">{err}</div>}
      <button className="primario" disabled={busy} onClick={guardar}>Guardar gestión</button>
    </div>)}
    {!tipo && err && <div className="error">{err}</div>}
  </>)
}
