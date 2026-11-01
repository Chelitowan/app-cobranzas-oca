import { useEffect, useState } from 'react'
import { supabase, peso, hoyAR, rangoDia } from '../supabase'
import type { Vista } from '../App'

export default function Home({ ir }: { ir: (v: Vista) => void }) {
  const [total, setTotal] = useState(0)
  const [cobros, setCobros] = useState(0)
  const [gestiones, setGestiones] = useState(0)
  const fecha = hoyAR()

  useEffect(() => {
    const [a, b] = rangoDia(fecha)
    supabase.from('cobros').select('monto').neq('estado', 'anulado').gte('creado_en', a).lt('creado_en', b)
      .then(({ data }) => { setCobros(data?.length ?? 0); setTotal((data ?? []).reduce((s, c) => s + Number(c.monto), 0)) })
    supabase.from('gestiones').select('id', { count: 'exact', head: true }).neq('estado', 'anulada').gte('creado_en', a).lt('creado_en', b)
      .then(({ count }) => setGestiones(count ?? 0))
  }, [fecha])

  return (<>
    <div className="hero">
      <div className="fecha">{new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <div>Total cobrado hoy</div>
      <div className="total">{peso(total)}</div>
      <div>{cobros} cobros · {gestiones} gestiones</div>
    </div>
    <button className="primario" onClick={() => ir('cobro')}>＋ Nuevo cobro</button>
    <div className="grid">
      <button className="tile" onClick={() => ir('gestion')}><span>📝</span>Nueva gestión</button>
      <button className="tile" onClick={() => ir('historial')}><span>📋</span>Historial</button>
      <button className="tile" onClick={() => ir('destinatarios')}><span>✉️</span>Destinatarios</button>
    </div>
  </>)
}
