import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500/15 via-fuchsia-500/15 to-violet-500/15 p-[1px] shadow-2xl">
        <div className="rounded-3xl bg-white/70 p-10 backdrop-blur dark:bg-slate-900/70">
          <h2 className="text-center text-2xl font-semibold">Directory</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-600 dark:text-slate-400">
            Choose your portal below. Only students can register (must enter Student ID).
          </p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3 mt-8">
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
    <div className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-xl ring-1 ring-black/5 transition-all hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 text-lg font-medium">{title}</div>
      <p className="mb-5 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
      <div className="flex flex-col gap-2">
        {showRegister && registerLink && (
          <a href={registerLink} className="rounded bg-green-600 px-4 py-2 text-white shadow-md hover:shadow-lg transition">Register</a>
        )}
        {loginLink && (
          <a href={loginLink} className="rounded border px-4 py-2 text-blue-700 border-blue-600 dark:border-slate-700 dark:text-blue-300 shadow">Login</a>
        )}
      </div>
    </div>
  )
}


