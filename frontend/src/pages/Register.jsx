import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../api/client.js'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!studentId) return setError('Student ID (Roll No) is required')
    try {
      await apiFetch('/api/auth/register', { method: 'POST', body: { name, email, password, studentId, role: 'student' } })
      navigate('/login')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="mx-auto max-w-md py-12 animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold gradient-text mb-2">Create Account</h2>
        <p className="text-slate-600 dark:text-slate-400">Join Adiptify and start your learning journey</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Full Name</label>
          <input 
            className="input-field focus-ring" 
            placeholder="John Doe" 
            value={name} 
            onChange={e=>setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Email</label>
          <input 
            type="email"
            className="input-field focus-ring" 
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
            placeholder="Create a secure password" 
            value={password} 
            onChange={e=>setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Student ID (Roll No) *</label>
          <input 
            className="input-field focus-ring" 
            placeholder="e.g., STU2024001" 
            value={studentId} 
            onChange={e=>setStudentId(e.target.value)}
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
          Register as Student
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account? <Link className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline" to="/login">Sign in here</Link>
      </p>
    </div>
  )
}


