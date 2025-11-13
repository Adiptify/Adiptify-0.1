import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { apiFetch } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { decodeJwt } from '../utils/jwt.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { setToken, setUser } = useAuth()

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const { token } = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } })
      setToken(token)
      const payload = decodeJwt(token)
      const role = payload?.role || 'student'
      setUser({ email: payload?.email || email, role, name: payload?.name || '' })
      const params = new URLSearchParams(location.search)
      const redirect = params.get('redirect')
      if (redirect) {
        navigate(redirect, { replace: true })
        return
      }
      if (role === 'admin') navigate('/admin', { replace: true })
      else if (role === 'instructor') navigate('/instructor', { replace: true })
      else navigate('/student', { replace: true })
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h2 className="mb-4 text-lg font-semibold">Login</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-slate-900 px-3 py-2 text-white dark:bg-slate-100 dark:text-slate-900">Sign in</button>
      </form>
      <p className="mt-3 text-sm">No account? <Link className="underline" to="/register">Register</Link></p>
    </div>
  )
}


