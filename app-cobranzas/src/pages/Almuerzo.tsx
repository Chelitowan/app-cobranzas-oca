import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

type AlmuerzoActivo = {
  id: string
  iniciado_en: string
  latitud_inicio: number
  longitud_inicio: number
}

function obtenerUbicacion(): Promise<{ latitud: number; longitud: number }> {
  if (!window.isSecureContext) {
    return Promise.reject(new Error('La ubicación requiere HTTPS. Abrí la app desde su dirección segura, no desde la IP local HTTP.'))
  }
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Este navegador no permite acceder a la ubicación.'))
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitud: position.coords.latitude,
        longitud: position.coords.longitude,
      }),
      error => reject(new Error(
        error.code === error.PERMISSION_DENIED
          ? 'Permití el acceso a la ubicación en la configuración del navegador.'
          : error.code === error.TIMEOUT
            ? 'No se pudo obtener la ubicación a tiempo. Verificá el GPS y volvé a intentar.'
            : 'No se pudo obtener la ubicación. Verificá que el GPS esté habilitado y volvé a intentar.'
      )),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    )
  })
}

function tiempoTranscurrido(inicio: string, ahora: number): string {
  const segundos = Math.max(0, Math.floor((ahora - new Date(inicio).getTime()) / 1000))
  const horas = Math.floor(segundos / 3600).toString().padStart(2, '0')
  const minutos = Math.floor((segundos % 3600) / 60).toString().padStart(2, '0')
  const resto = (segundos % 60).toString().padStart(2, '0')
  return `${horas}:${minutos}:${resto}`
}

export default function Almuerzo() {
  const [activo, setActivo] = useState<AlmuerzoActivo | null>(null)
  const [ahora, setAhora] = useState(Date.now())
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let vigente = true
    supabase.from('almuerzos')
      .select('id,iniciado_en,latitud_inicio,longitud_inicio')
      .is('finalizado_en', null)
      .maybeSingle()
      .then(({ data, error: errorConsulta }) => {
        if (!vigente) return
        if (errorConsulta) {
          setErrorCarga(errorConsulta.message)
        }
        else setActivo(data)
        setCargando(false)
      })
    return () => { vigente = false }
  }, [])

  useEffect(() => {
    if (!activo) return
    const timer = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activo])

  async function iniciar() {
    setError('')
    setAviso('')
    setOcupado(true)
    try {
      const ubicacion = await obtenerUbicacion()
      const { data: existente, error: errorConsulta } = await supabase.from('almuerzos')
        .select('id,iniciado_en,latitud_inicio,longitud_inicio')
        .is('finalizado_en', null)
        .maybeSingle()
      if (errorConsulta) {
        throw new Error(`No se pudo consultar el estado del almuerzo: ${errorConsulta.message || errorCarga}`)
      }
      if (existente) {
        setActivo(existente)
        return
      }
      const { data, error: errorInicio } = await supabase.from('almuerzos')
        .insert({
          latitud_inicio: ubicacion.latitud,
          longitud_inicio: ubicacion.longitud,
        })
        .select('id,iniciado_en,latitud_inicio,longitud_inicio')
        .single()
      if (errorInicio) throw new Error(errorInicio.message)
      setActivo(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  async function finalizar() {
    if (!activo) return
    setError('')
    setAviso('')
    setOcupado(true)
    let ubicacionFinal: { latitud: number; longitud: number } | null = null
    let errorUbicacion = ''
    try {
      ubicacionFinal = await obtenerUbicacion()
    } catch (e) {
      errorUbicacion = e instanceof Error ? e.message : String(e)
    }

    try {
      const { data, error: errorFin } = await supabase.from('almuerzos')
        .update({
          finalizado_en: new Date().toISOString(),
          latitud_fin: ubicacionFinal?.latitud ?? null,
          longitud_fin: ubicacionFinal?.longitud ?? null,
        })
        .eq('id', activo.id)
        .is('finalizado_en', null)
        .select('id')
      if (errorFin) throw new Error(errorFin.message)
      if (!data?.length) throw new Error('No se pudo confirmar el cierre del almuerzo. Recargá para comprobar su estado.')
      setActivo(null)
      if (errorUbicacion) {
        setAviso(`Duración y ubicación inicial guardadas; no se pudo registrar la ubicación final. ${errorUbicacion}`)
      } else {
        setAviso('Almuerzo finalizado. El tiempo y las ubicaciones se incluirán en el resumen diario por correo.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="almuerzo" aria-label="Control de almuerzo">
      <div className="almuerzo-accion">
        {activo && <div className="almuerzo-tiempo" role="timer" aria-live="off">
          {tiempoTranscurrido(activo.iniciado_en, ahora)}
        </div>}
        <button className={activo ? 'suave' : 'primario'} disabled={cargando || ocupado} onClick={activo ? finalizar : iniciar}>
          {cargando ? 'Consultando…' : ocupado ? (activo ? 'Finalizando…' : 'Obteniendo ubicación…') : activo ? 'Finalizar almuerzo' : 'Iniciar almuerzo'}
        </button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {aviso && <div className="ok" role="status">{aviso}</div>}
    </section>
  )
}
