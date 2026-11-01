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
  async function eliminar(d: D) {
    if (!confirm(`¿Eliminar a ${d.nombre} (${d.correo})? Dejará de recibir el resumen.`)) return
    const { error } = await supabase.from('destinatarios').delete().eq('id', d.id)
    if (error) setErr('No se pudo eliminar')
    cargar()
  }

  return (<>
    <p className="sub">El resumen diario se envía a las personas que figuran como "Recibe".</p>
    {lista.map(d => (
      <div key={d.id} className="card">
        <div><b>{d.nombre}</b><div className="sub">{d.correo}</div></div>
        <div className="fila">
          <button className={d.recibe_resumen ? 'chico' : 'chico suave'} onClick={() => alternar(d)}>{d.recibe_resumen ? 'Recibe' : 'Pausado'}</button>
          <button className="chico peligro" onClick={() => eliminar(d)}>Eliminar</button>
        </div>
      </div>
    ))}
    <div className="card">
      <b>Agregar destinatario</b>
      <label>Nombre<input value={nombre} onChange={e => setNombre(e.target.value)} /></label>
      <label>Correo<input type="email" value={correo} onChange={e => setCorreo(e.target.value)} /></label>
      {err && <div className="error">{err}</div>}
      <button onClick={agregar}>Agregar</button>
    </div>
  </>)
}
