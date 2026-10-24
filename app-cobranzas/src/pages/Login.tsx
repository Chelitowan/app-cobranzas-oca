import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function entrar() {
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
    if (error) setError('Correo o contraseña incorrectos')
    setBusy(false)
  }

  return (
    <div className="login">
      <div className="login-inner">
        <div className="login-brand">
          <svg width="46" height="46" viewBox="0 0 34 34" aria-hidden>
            <rect width="34" height="34" rx="10" fill="#fff" />
            <path d="M8 9h5l4.5 8L13 25H8l4.5-8z" fill="#F39430" />
            <path d="M16 9h5l4.5 8-4.5 8h-5l4.5-8z" fill="#572A82" />
          </svg>
          <span>Cobranzas<small>OCA</small></span>
        </div>

        <div className="login-card">
          <h1>Ingresá a tu cuenta</h1>
          <p className="muted">Registrá los cobros y gestiones del día.</p>
          <label>Correo
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" placeholder="nombre@oca.com.ar" />
          </label>
          <label>Contraseña
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" placeholder="Tu contraseña"
              onKeyDown={e => { if (e.key === 'Enter' && email && pass && !busy) entrar() }} />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="cta" disabled={busy || !email || !pass} onClick={entrar}>
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </div>

        <p className="login-foot">OCA · Gestión de cobranzas</p>
      </div>
    </div>
  )
}
