import { useEffect, useState } from 'react'
import { supabase, peso, hoyAR, rangoDia } from '../supabase'
import type { Vista } from '../App'
import { IconPen, IconHistory, IconMail, IconPlus, IconChevron } from '../icons'

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
      <div className="hero-top">
        <span className="hero-date">{new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span className="hero-pill">Hoy</span>
      </div>
      <p className="hero-label">Total cobrado</p>
      <div className="hero-total">{peso(total)}</div>
      <div className="hero-stats">
        <div className="stat"><b>{cobros}</b><span>cobros</span></div>
        <span className="stat-sep" />
        <div className="stat"><b>{gestiones}</b><span>gestiones</span></div>
      </div>
    </div>

    <button className="cta" onClick={() => ir('cobro')}>
      <IconPlus size={22} /> Nuevo cobro
    </button>

    <p className="section-title">Accesos rápidos</p>
    <div className="menu">
      <button className="menu-item" onClick={() => ir('gestion')}>
        <span className="menu-ico"><IconPen /></span>
        <span className="menu-text">
          <span className="menu-title">Nueva gestión</span>
          <span className="menu-sub">Llamada, depósito o visita</span>
        </span>
        <IconChevron size={18} />
      </button>
      <button className="menu-item" onClick={() => ir('historial')}>
        <span className="menu-ico"><IconHistory /></span>
        <span className="menu-text">
          <span className="menu-title">Historial</span>
          <span className="menu-sub">Cobros y gestiones del día</span>
        </span>
        <IconChevron size={18} />
      </button>
      <button className="menu-item" onClick={() => ir('destinatarios')}>
        <span className="menu-ico"><IconMail /></span>
        <span className="menu-text">
          <span className="menu-title">Destinatarios</span>
          <span className="menu-sub">Quién recibe el resumen diario</span>
        </span>
        <IconChevron size={18} />
      </button>
    </div>
  </>)
}
