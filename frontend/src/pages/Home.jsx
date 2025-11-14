import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/20 via-emerald-500/20 to-blue-500/20 p-[1px] shadow-2xl animate-fadeIn">
        <div className="rounded-3xl bg-white/80 p-12 backdrop-blur dark:bg-slate-900/80">
          <div className="text-center">
            <h1 className="text-4xl font-bold gradient-text mb-3">Adiptify</h1>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-3">Adaptive Learning Platform</h2>
            <p className="mx-auto max-w-2xl text-center text-slate-600 dark:text-slate-400 leading-relaxed">
              Choose your portal below. Only students can register (must enter Student ID).
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3 mt-10">
        <PortalCard
          title="Student Portal"
          desc="Register with your Student ID/Roll No. or login to access quizzes, mastery, and AI support."
          registerLink="/register"
          loginLink="/login?redirect=/student"
          cta="Go to Student"
          showRegister
        />
        <PortalCard
          title="Instructor Portal"
          desc="Login to manage and assign quizzes to your students. No public registration."
          loginLink="/login?redirect=/instructor"
          cta="Go to Instructor"
        />
        <PortalCard
          title="Admin Portal"
          desc="Login for admin controls, publishing, and moderation. No public registration."
          loginLink="/login?redirect=/admin"
          cta="Go to Admin"
        />
      </section>
    </div>
  )
}

function PortalCard({ title, desc, registerLink, loginLink, cta, showRegister }) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-xl ring-1 ring-black/5 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-900 card-hover">
      <div className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</div>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{desc}</p>
      <div className="flex flex-col gap-3">
        {showRegister && registerLink && (
          <a 
            href={registerLink} 
            className="btn-primary text-center"
          >
            Register
          </a>
        )}
        {loginLink && (
          <a 
            href={loginLink} 
            className="btn-secondary text-center"
          >
            Login
          </a>
        )}
      </div>
    </div>
  )
}


