import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

type D = { id: string; nombre: string; correo: string; recibe_resumen: boolean }

export default function Destinatarios() {
  const [lista, setLista] = useState<D[]>([])
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [err, setErr] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('destinatarios').select('id,nombre,correo,recibe_resumen').order('nombre')
    setLista(data ?? [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function agregar() {
    setErr('')
    if (!nombre.trim() || !correo.includes('@')) return setErr('Completá el nombre y un correo válido')
    const { error } = await supabase.from('destinatarios').insert({ nombre: nombre.trim(), correo: correo.trim() })
    if (error) return setErr('No se pudo agregar')
    setNombre(''); setCorreo(''); cargar()
  }
  async function alternar(d: D) {
    // "Recibe" = activo y recibe resumen; "Pausado" = ninguno de los dos
    await supabase.from('destinatarios').update({ activo: !d.recibe_resumen, recibe_resumen: !d.recibe_resumen }).eq('id', d.id)
    cargar()
  }

  return (<>
    <p className="hint">El resumen diario se envía a las personas marcadas como “Recibe”.</p>

    {lista.length > 0 && (
      <div className="card list">
        {lista.map(d => (
          <div key={d.id} className="list-item">
            <span className="avatar">{d.nombre.slice(0, 1).toUpperCase()}</span>
            <span className="pick-text">
              <b>{d.nombre}</b>
              <small>{d.correo}</small>
            </span>
            <button className={`pill ${d.recibe_resumen ? 'pill-on' : ''}`} onClick={() => alternar(d)}>
              {d.recibe_resumen ? 'Recibe' : 'Pausado'}
            </button>
          </div>
        ))}
      </div>
    )}

    <div className="card">
      <h2>Agregar destinatario</h2>
      <label>Nombre<input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" /></label>
      <label>Correo<input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="nombre@oca.com.ar" /></label>
      {err && <div className="error">{err}</div>}
      <button className="btn-soft" onClick={agregar}>Agregar destinatario</button>
    </div>
  </>)
}
