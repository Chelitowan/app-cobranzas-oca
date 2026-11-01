import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, EMAIL_OK } from './supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import NuevoCobro from './pages/NuevoCobro'
import Gestion from './pages/Gestion'
import Historial from './pages/Historial'
import Destinatarios from './pages/Destinatarios'

export type Vista = 'home' | 'cobro' | 'gestion' | 'historial' | 'destinatarios'
const TITULOS: Record<Vista, string> = {
  home: 'App Cobranzas', cobro: 'Nuevo cobro', gestion: 'Nueva gestión',
  historial: 'Historial', destinatarios: 'Destinatarios',
}
export const Logo = () => (
  <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden>
    <path d="M0 0h8l7 11-7 11H0l7-11z" fill="#F39430" /><path d="M12 0h8l7 11-7 11h-8l7-11z" fill="#fff" />
  </svg>
)

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [listo, setListo] = useState(false)
  const [vista, setVista] = useState<Vista>('home')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setListo(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!listo) return <p className="centro">Cargando…</p>
  if (!session) return <Login />

  const salir = () => supabase.auth.signOut()
  if (session.user.email?.toLowerCase() !== EMAIL_OK)
    return (
      <main className="centro">
        <h2>Cuenta sin acceso</h2>
        <p>Esta cuenta no está autorizada para usar la app.</p>
        <button onClick={salir}>Cerrar sesión</button>
      </main>
    )

  const volver = () => setVista('home')
  return (
    <>
      <header>
        {vista === 'home' ? <Logo /> : <button onClick={volver}>‹ Inicio</button>}
        <h1>{TITULOS[vista]}</h1>
        <button onClick={salir}>Cerrar sesión</button>
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
