import { NavLink } from 'react-router-dom'

import { useAuth } from '../context/AuthContext.jsx'

export default function Sidebar() {
  const { user } = useAuth()
  const role = user?.role || 'student'
  
  if (role === 'student') {
    return (
      <aside className="hidden md:block h-full w-56 shrink-0 rounded-2xl bg-gradient-to-b from-slate-50 to-white p-4 shadow ring-1 ring-black/5 dark:from-slate-800 dark:to-slate-900 dark:ring-slate-800">
        <nav className="flex flex-col gap-2">
          <SidebarLink to="/student/dashboard" label="Dashboard" />
          <SidebarLink to="/student/learning" label="Learning" />
          <SidebarLink to="/student/assessments" label="Assessments" />
          <SidebarLink to="/student/performance" label="Performance" />
          <SidebarLink to="/student/chat" label="Chat" />
          <SidebarLink to="/student/profile" label="Profile" />
        </nav>
      </aside>
    )
  }
  
  // For instructor/admin, show minimal sidebar or none
  return null
}

function SidebarLink({ to, label }) {
  return (
    <NavLink to={to} className={({isActive})=>
      `flex items-center gap-3 rounded-lg px-4 py-2 font-medium transition-all ${isActive?'bg-indigo-50 dark:bg-emerald-900 text-indigo-700 dark:text-emerald-200 border-l-4 border-indigo-500 dark:border-emerald-400 shadow':'hover:bg-indigo-50 dark:hover:bg-emerald-950/20 text-gray-600 dark:text-slate-200'}`
    }>{label}</NavLink>
  )
}
