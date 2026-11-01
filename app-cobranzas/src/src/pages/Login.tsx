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
      <div className="login-box">
        <svg className="logo" width="72" height="52" viewBox="0 0 27 22" aria-hidden>
          <path d="M0 0h8l7 11-7 11H0l7-11z" fill="#F39430" /><path d="M12 0h8l7 11-7 11h-8l7-11z" fill="#fff" />
        </svg>
        <h1 aria-label="App Cobranzas OCA">
          <span className="t1">APP</span><span className="t2">COBRANZAS</span><span className="t3">OCA</span>
        </h1>
        <div className="card">
          <label>Correo<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" /></label>
          <label>Contraseña<input type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password"
            onKeyDown={e => { if (e.key === 'Enter' && email && pass && !busy) entrar() }} /></label>
          {error && <div className="error">{error}</div>}
          <button className="primario" disabled={busy || !email || !pass} onClick={entrar}>Ingresar</button>
        </div>
      </div>
    </div>
  )
}
