import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, NavLink, Outlet, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { ToastContainer } from './components/Toast.jsx'
import { useToast } from './hooks/useToast.js'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import StudentDashboard from './pages/student/Dashboard.jsx'
import StudentLearning from './pages/student/Learning.jsx'
import StudentAssessments from './pages/student/Assessments.jsx'
import StudentPerformance from './pages/student/Performance.jsx'
import StudentChat from './pages/student/Chat.jsx'
import StudentProfile from './pages/student/Profile.jsx'
import AssessmentResults from './pages/student/AssessmentResults.jsx'
import AssessmentPage from './pages/AssessmentPage.jsx'
import InstructorDashboard from './pages/instructor/Dashboard.jsx'
import ProctorManagement from './pages/instructor/ProctorManagement.jsx'
import InstructorAssessmentGenerator from './pages/instructor/AssessmentGenerator.jsx'
import InstructorAssessmentReview from './pages/instructor/AssessmentReview.jsx'
import AdminDashboard from './pages/admin/Dashboard.jsx'
import QuestionBank from './pages/admin/QuestionBank.jsx'
import Home from './pages/Home.jsx'

function useTheme() {
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || 'light'
  )

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  return { theme, setTheme }
}

function Layout({ children }) {
  const { theme, setTheme } = useTheme()
  const { token, user, setToken, setUser } = useAuth()
  // Add the useToast hook call here
  const { toasts, removeToast } = useToast();

  useEffect(() => {}, [])

  return (
    <div className="min-h-screen bg-white text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Adiptify — Adaptive Learning</h1>
          <div className="flex items-center gap-3">
            <nav className="hidden gap-4 sm:flex text-sm">
              <NavLink to="/" end className={({isActive})=>isActive?"underline":undefined}>Home</NavLink>
              {user?.role === 'student' && (
                <NavLink to="/student" className={({isActive})=>isActive?"underline":undefined}>Student</NavLink>
              )}
              {user?.role === 'instructor' && (
                <NavLink to="/instructor" className={({isActive})=>isActive?"underline":undefined}>Instructor</NavLink>
              )}
              {user?.role === 'admin' && (
                <NavLink to="/admin" className={({isActive})=>isActive?"underline":undefined}>Admin</NavLink>
              )}
            </nav>
            <button
              className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            </button>
            {!token ? (
              <Link to="/login" className="text-sm underline">Login</Link>
            ) : (
              <button onClick={() => { setToken(''); setUser(null) }} className="text-sm underline">Logout</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10 p-[1px]">
          <div className="rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <Outlet />
          </div>
        </div>
      </main>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}> 
            <Route index element={<Home />} />
            <Route element={<ProtectedRoute roles={["student"]} />}> 
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/learning" element={<StudentLearning />} />
              <Route path="/student/assessments" element={<StudentAssessments />} />
              <Route path="/student/performance" element={<StudentPerformance />} />
              <Route path="/student/chat" element={<StudentChat />} />
              <Route path="/student/profile" element={<StudentProfile />} />
              <Route path="/student/assessment-results/:sessionId" element={<AssessmentResults />} />
              <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
            </Route>
            <Route element={<ProtectedRoute roles={["student","instructor","admin"]} />}> 
              <Route path="/assessment" element={<AssessmentPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={["instructor","admin"]} />}> 
              <Route path="/instructor" element={<InstructorDashboard />} />
              <Route path="/instructor/proctor" element={<ProctorManagement />} />
              <Route path="/instructor/assessment-generator" element={<InstructorAssessmentGenerator />} />
              <Route path="/instructor/assessment-review" element={<InstructorAssessmentReview />} />
              <Route path="/instructor/question-bank" element={<QuestionBank />} />
            </Route>
            <Route element={<ProtectedRoute roles={["admin"]} />}> 
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/question-bank" element={<QuestionBank />} />
            </Route>
            {/** Role-branded login shortcuts */}
            <Route path="/student-login" element={<Navigate to="/login?redirect=/student" replace />} />
            <Route path="/instructor-login" element={<Navigate to="/login?redirect=/instructor" replace />} />
            <Route path="/admin-login" element={<Navigate to="/login?redirect=/admin" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}


