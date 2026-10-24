import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, EMAIL_OK } from './supabase'
import { IconBack, IconLogout } from './icons'
import Login from './pages/Login'
import Home from './pages/Home'
import NuevoCobro from './pages/NuevoCobro'
import Gestion from './pages/Gestion'
import Historial from './pages/Historial'
import Destinatarios from './pages/Destinatarios'

export type Vista = 'home' | 'cobro' | 'gestion' | 'historial' | 'destinatarios'
const TITULOS: Record<Vista, string> = {
  home: 'Cobranzas', cobro: 'Nuevo cobro', gestion: 'Nueva gestión',
  historial: 'Historial', destinatarios: 'Destinatarios',
}
export const Logo = () => (
  <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
    <rect width="34" height="34" rx="10" fill="#572A82" />
    <path d="M8 9h5l4.5 8L13 25H8l4.5-8z" fill="#F39430" />
    <path d="M16 9h5l4.5 8-4.5 8h-5l4.5-8z" fill="#fff" />
  </svg>
)

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [listo, setListo] = useState(false)
  const preview = import.meta.env.DEV && location.search.includes('preview')
  const [vista, setVista] = useState<Vista>(() =>
    (import.meta.env.DEV ? new URLSearchParams(location.search).get('vista') as Vista : null) || 'home')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setListo(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!preview && !listo) return <div className="boot"><span className="spinner" /></div>
  if (!preview && !session) return <Login />

  const salir = () => supabase.auth.signOut()
  if (!preview && session?.user.email?.toLowerCase() !== EMAIL_OK)
    return (
      <main className="centro">
        <h2>Cuenta sin acceso</h2>
        <p className="muted">Esta cuenta no está autorizada para usar la app.</p>
        <button onClick={salir}>Cerrar sesión</button>
      </main>
    )

  const volver = () => setVista('home')
  return (
    <>
      <header className="topbar">
        {vista === 'home' ? (
          <div className="brand">
            <Logo />
            <span className="brand-name">Cobranzas<small>OCA</small></span>
          </div>
        ) : (
          <div className="topbar-page">
            <button className="icon-btn" onClick={volver} aria-label="Volver al inicio"><IconBack /></button>
            <h1>{TITULOS[vista]}</h1>
          </div>
        )}
        <button className="icon-btn" onClick={salir} aria-label="Cerrar sesión"><IconLogout /></button>
      </header>
      <main>
        {vista === 'home' && <Home ir={setVista} />}
        {vista === 'cobro' && <NuevoCobro volver={volver} />}
        {vista === 'gestion' && <Gestion volver={volver} />}
        {vista === 'historial' && <Historial />}
        {vista === 'destinatarios' && <Destinatarios />}
      </main>
    </>
  )
}
