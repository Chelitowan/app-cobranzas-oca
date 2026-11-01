import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

type D = { id: string; nombre: string; correo: string; recibe_resumen: boolean }
type ConfiguracionResumen = { habilitado: boolean; hora_envio: string }

export default function Destinatarios() {
  const [lista, setLista] = useState<D[]>([])
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [err, setErr] = useState('')
  const [configuracion, setConfiguracion] = useState<ConfiguracionResumen | null>(null)
  const [guardandoConfig, setGuardandoConfig] = useState(false)
  const [mensajeConfig, setMensajeConfig] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('destinatarios').select('id,nombre,correo,recibe_resumen').order('nombre')
    setLista(data ?? [])
  }, [])
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    let vigente = true
    supabase.from('configuracion_resumen_diario')
      .select('habilitado,hora_envio')
      .eq('id', true)
      .single()
      .then(({ data, error }) => {
        if (!vigente) return
        if (error) {
          setMensajeConfig({ tipo: 'error', texto: `No se pudo cargar la configuración del envío automático: ${error.message}` })
          return
        }
        setConfiguracion({ habilitado: data.habilitado, hora_envio: data.hora_envio.slice(0, 5) })
      })
    return () => { vigente = false }
  }, [])

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
    setErr('')
    const { data, error } = await supabase.from('destinatarios').delete().eq('id', d.id).select('id')
    if (error || !data?.length) setErr('No se pudo eliminar el destinatario')
    cargar()
  }

  async function guardarConfiguracion() {
    if (!configuracion) return
    setMensajeConfig(null)
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(configuracion.hora_envio)) {
      setMensajeConfig({ tipo: 'error', texto: 'Ingresá un horario válido.' })
      return
    }
    setGuardandoConfig(true)
    const { data, error } = await supabase.from('configuracion_resumen_diario')
      .update({ habilitado: configuracion.habilitado, hora_envio: configuracion.hora_envio })
      .eq('id', true)
      .select('id')
    setGuardandoConfig(false)
    if (error || !data?.length) {
      setMensajeConfig({ tipo: 'error', texto: `No se pudo guardar la configuración${error ? `: ${error.message}` : '.'}` })
      return
    }
    setMensajeConfig({ tipo: 'ok', texto: 'Configuración del envío automático guardada.' })
  }

  return (<>
    <div className="card">
      <b>Envío automático del resumen</b>
      <p className="sub">De lunes a viernes, hora de Argentina. Se envía a los destinatarios activos que reciben el resumen.</p>
      {configuracion ? <>
        <label>Horario<input
          type="time"
          value={configuracion.hora_envio}
          onChange={e => setConfiguracion({ ...configuracion, hora_envio: e.target.value })}
          disabled={guardandoConfig}
        /></label>
        <div className="fila">
          <span>{configuracion.habilitado ? 'Envío automático activado' : 'Envío automático desactivado'}</span>
          <button
            className={configuracion.habilitado ? 'chico suave' : 'chico'}
            onClick={() => setConfiguracion({ ...configuracion, habilitado: !configuracion.habilitado })}
            disabled={guardandoConfig}
          >{configuracion.habilitado ? 'Desactivar' : 'Activar'}</button>
        </div>
        <button className="primario" onClick={guardarConfiguracion} disabled={guardandoConfig}>
          {guardandoConfig ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </> : !mensajeConfig && <p className="sub">Cargando configuración…</p>}
      {mensajeConfig && <div className={mensajeConfig.tipo === 'ok' ? 'ok' : 'error'} role={mensajeConfig.tipo === 'ok' ? 'status' : 'alert'}>{mensajeConfig.texto}</div>}
    </div>

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
