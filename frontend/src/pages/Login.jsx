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
    <div className="mx-auto max-w-md py-12 animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold gradient-text mb-2">Welcome Back</h2>
        <p className="text-slate-600 dark:text-slate-400">Sign in to continue your learning journey</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Email</label>
          <input 
            className="input-field focus-ring" 
            type="email"
            placeholder="your.email@example.com" 
            value={email} 
            onChange={e=>setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Password</label>
          <input 
            type="password" 
            className="input-field focus-ring" 
            placeholder="Enter your password" 
            value={password} 
            onChange={e=>setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-red-700 dark:text-red-400 text-sm animate-slideIn">
            {error}
          </div>
        )}
        <button 
          type="submit"
          className="btn-primary w-full"
        >
          Sign In
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        No account? <Link className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline" to="/register">Create one here</Link>
      </p>
    </div>
  )
}


