import { useEffect, useState } from 'react'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { apiFetch } from '../../api/client.js'
import IssueReportModal from '../../components/IssueReportModal.jsx'
import AssessmentReports from '../admin/AssessmentReports.jsx'

function StatCard({ label, value, accent }) {
  const bg = {
    indigo: "from-indigo-100 via-indigo-50 to-white dark:from-indigo-800 dark:via-slate-900",
    emerald: "from-emerald-100 via-emerald-50 to-white dark:from-emerald-800 dark:via-slate-900",
    blue: "from-blue-100 via-blue-50 to-white dark:from-blue-800 dark:via-slate-900",
    rose: "from-rose-100 via-rose-50 to-white dark:from-rose-800 dark:via-slate-900"
  }[accent];
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${bg} p-5 shadow-xl text-center`}>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-base text-slate-500">{label}</div>
    </div>
  )
}

export default function InstructorDashboard() {
  const [tab, setTab] = useState('overview') // 'overview' or 'reports'
  const [students, setStudents] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [topics, setTopics] = useState([])
  const [heatmap, setHeatmap] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ avgMastery: 0, quizzes: 0, learners: 0, flagged: 0 })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showIssueModal, setShowIssueModal] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        // Fetch all students (as admin); update endpoint to your API
        const users = await apiFetch('/api/admin/students')
        setStudents(users)
        // Example assumes students have mastery by topics; flat topics array
        let topicSet = new Set()
        users.forEach(u => {
          if (u.learnerProfile && u.learnerProfile.topics) Object.keys(u.learnerProfile.topics).forEach(t=>topicSet.add(t))
        })
        const topicArr = Array.from(topicSet)
        setTopics(topicArr)
        // Build heatmap: students × topics matrix, value = mastery %
        // Handle both old (0-1) and new (0-100) formats
        const matrix = users.map(u => topicArr.map(topic => {
          const rec = u.learnerProfile?.topics?.[topic] || { mastery: 0 }
          let mastery = rec.mastery || 0
          // If mastery is less than 1, it's in old format (0-1), convert to percentage
          if (mastery < 1 && mastery > 0) {
            mastery = Math.round(mastery * 100)
          } else {
            mastery = Math.round(mastery)
          }
          return mastery
        }))
        setHeatmap(matrix)
        // Stat tiles
        const learners = users.length
        // Fetch all assessments assigned
        let assessmentsData
        try { assessmentsData = await apiFetch('/api/assessment/list?status=published&limit=200') } catch { assessmentsData = [] }
        setQuizzes(assessmentsData)
        // Calculate average mastery (handle both formats)
        const allMasteries = users.flatMap(u => {
          const topics = u.learnerProfile?.topics || {}
          return Object.values(topics).map(m => {
            let mastery = m.mastery || 0
            if (mastery < 1 && mastery > 0) mastery = mastery * 100 // Convert old format
            return mastery
          })
        }).filter(Boolean)
        const avgMastery = allMasteries.length ? Math.round((allMasteries.reduce((a,c)=>a+c,0)/allMasteries.length)) : 0
        setStats({
          avgMastery,
          quizzes: assessmentsData.length,
          learners,
          flagged: users.filter(u => {
            const topics = u.learnerProfile?.topics || {}
            return Object.values(topics).some(m => {
              let mastery = m.mastery || 0
              if (mastery < 1 && mastery > 0) mastery = mastery * 100 // Convert old format
              return mastery < 50
            })
          }).length
        })
      } catch (e) {
        setError('Failed to load class/cohort data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <div className="mb-8 animate-fadeIn">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">Instructor Dashboard</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">Monitor student progress and manage assessments</p>
          </div>
          <div className="mb-6 flex gap-2 border-b pb-2 text-base font-medium">
            <button
              className={`rounded-t-lg px-6 py-2 transition-colors ${tab === 'overview' ? "bg-indigo-100 text-indigo-700 dark:bg-slate-800 dark:text-emerald-300 shadow-md" : "hover:bg-indigo-50 dark:hover:bg-slate-800/80 text-slate-500"}`}
              onClick={() => setTab('overview')}
            >
              Overview
            </button>
            <button
              className={`rounded-t-lg px-6 py-2 transition-colors ${tab === 'reports' ? "bg-indigo-100 text-indigo-700 dark:bg-slate-800 dark:text-emerald-300 shadow-md" : "hover:bg-indigo-50 dark:hover:bg-slate-800/80 text-slate-500"}`}
              onClick={() => setTab('reports')}
            >
              Assessment Reports
            </button>
          </div>
          {tab === 'reports' ? (
            <AssessmentReports />
          ) : (
            <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4 animate-fadeIn">
            <StatCard label="Avg. Mastery" value={stats.avgMastery+'%'} accent="indigo" />
            <StatCard label="Assessments Published" value={stats.quizzes} accent="emerald" />
            <StatCard label="Active Learners" value={stats.learners} accent="blue" />
            <StatCard label="Flagged Students" value={stats.flagged} accent="rose" />
          </div>
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cohort Mastery Heatmap</h3>
              <span className="text-sm text-slate-500 dark:text-slate-400">{students.length} students</span>
            </div>
            {topics.length && students.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg">
              <table className="min-w-[600px] w-full bg-white dark:bg-slate-900">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Student</th>
                    {topics.map(topic=>(<th key={topic} className="p-4 font-semibold text-center text-slate-700 dark:text-slate-300">{topic}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((u,i) => (
                    <tr key={u._id||u.name} className="table-row border-t border-slate-200 dark:border-slate-800">
                      <td className="p-4 font-semibold text-slate-900 dark:text-slate-100">{u.name}</td>
                      {topics.map((_,j) => (
                        <td key={j} className={`p-3 text-center font-bold rounded-lg transition-all ${
                          heatmap[i]?.[j] >= 80 ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-md' :
                          heatmap[i]?.[j] >= 60 ? 'bg-gradient-to-br from-yellow-300 to-amber-400 text-amber-900 shadow-md' :
                          heatmap[i]?.[j] > 0 ? 'bg-gradient-to-br from-rose-300 to-pink-400 text-rose-900 shadow-md' :
                          'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>{heatmap[i]?.[j]||0}%</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-slate-500 dark:text-slate-400">No cohort or mastery data available yet.</p>
              </div>
            )}
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Learner Analytics</h3>
              <button 
                onClick={() => setShowIssueModal(true)}
                className="btn-secondary text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              >
                Report Issue
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg">
              <table className="min-w-[470px] w-full text-sm bg-white dark:bg-slate-900">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Student</th>
                    <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Avg Mastery</th>
                    <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((u,i)=> {
                    // Handle both old (0-1) and new (0-100) formats
                    const allMasteries = Object.values(u.learnerProfile?.topics||{}).map(m => {
                      let mastery = m.mastery || 0
                      if (mastery < 1 && mastery > 0) mastery = mastery * 100 // Convert old format
                      return mastery
                    })
                    const avg = allMasteries.length ? Math.round((allMasteries.reduce((a,b)=>a+b,0)/allMasteries.length)) : 0
                    const flagged = allMasteries.some(m=>m<50)
                    return (
                    <tr key={u._id||u.name} className="table-row border-t border-slate-200 dark:border-slate-800">
                      <td className="p-4 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                      <td className="p-4">
                        <span className={`font-bold text-lg ${
                          avg >= 80 ? 'text-green-600 dark:text-green-400' :
                          avg >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {avg}%
                        </span>
                      </td>
                      <td className="p-4">
                        {flagged && <span className="badge badge-error">Low Mastery</span>}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            {error && <div className="text-rose-600 mt-2">{error}</div>}
          {success && (
            <div className="mt-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-green-700 dark:text-green-400">
              {success}
            </div>
          )}
          </section>
          <section className="mt-10">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xl font-medium">Assessment Builder (AI & Manual)</div>
              <div className="flex gap-2">
                <a
                  href="/instructor/assessment-review"
                  className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:brightness-105"
                >
                  Manage Assessments
                </a>
                <a
                  href="/instructor/proctor"
                  className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:brightness-105"
                >
                  Proctor Management
                </a>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Use the "Manage Assessments" button to view, preview, and publish AI-generated assessments.
              </p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                  placeholder="Enter topic for AI assessment generation..."
                  id="assessment-topic-input"
                />
                <button
                  onClick={async () => {
                    const input = document.getElementById('assessment-topic-input')
                    const topic = input?.value || 'General'
                    if (!topic.trim()) return
                    setLoading(true)
                    setError('')
                    try {
                      const res = await apiFetch('/api/assessment/generate', {
                        method: 'POST',
                        body: {
                          topic,
                          questionCount: 6
                        }
                      })
                      setSuccess(`Generated assessment: ${res.assessmentId || res.assessment?._id}. Check "Manage Assessments" to preview and publish.`)
                      if (input) input.value = ''
                      await load()
                    } catch (e) {
                      setError('Failed to generate assessment: ' + (e.message || ''))
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  className="rounded bg-green-600 px-4 py-2 text-white hover:brightness-105 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate Assessment'}
                </button>
              </div>
            </div>
          </section>
            </>
          )}
        </PageContainer>
      </main>
      <IssueReportModal 
        isOpen={showIssueModal} 
        onClose={() => setShowIssueModal(false)}
        panel="Instructor Dashboard"
      />
    </div>
  )
}
