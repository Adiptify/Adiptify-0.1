import { useEffect, useState } from 'react'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { apiFetch } from '../../api/client.js'

export default function Performance() {
  const [stats, setStats] = useState({})
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const me = await apiFetch('/api/auth/me')
        const topicMap = me.learnerProfile?.topics || {}
        const masteryObj = topicMap instanceof Map ? Object.fromEntries(topicMap) : (typeof topicMap === 'object' ? topicMap : {})
        // Handle both old (0-1) and new (0-100) formats
        const allMasteries = Object.values(masteryObj).map(m => {
          let mastery = m.mastery || 0
          if (mastery < 1 && mastery > 0) mastery = mastery * 100 // Convert old format
          return mastery
        })
        const avgMastery = allMasteries.length ? Math.round((allMasteries.reduce((a,b)=>a+b,0)/allMasteries.length)) : 0
        const totalAttempts = Object.values(masteryObj).reduce((a, m) => a + (m.attempts || 0), 0)
        const totalTime = Object.values(masteryObj).reduce((a, m) => a + (m.timeOnTask || 0), 0)
        setStats({ avgMastery, totalAttempts, totalTime: Math.round(totalTime/60000) })
        
        const sess = await apiFetch('/api/assessment/sessions?limit=10')
        setSessions(sess)
      } catch (e) {
        console.error(e)
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
          <h2 className="mb-6 text-3xl font-semibold">Performance Analytics</h2>
          <div className="mb-8 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 p-6 shadow-lg dark:from-indigo-900 dark:to-slate-900">
              <div className="text-3xl font-bold">{stats.avgMastery || 0}%</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Average Mastery</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 p-6 shadow-lg dark:from-emerald-900 dark:to-slate-900">
              <div className="text-3xl font-bold">{stats.totalAttempts || 0}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Attempts</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 p-6 shadow-lg dark:from-blue-900 dark:to-slate-900">
              <div className="text-3xl font-bold">{stats.totalTime || 0} min</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Time Spent</div>
            </div>
          </div>
          <section>
            <h3 className="mb-4 text-xl font-medium">Recent Quiz Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm rounded-xl bg-slate-50 shadow-lg dark:bg-slate-900">
                <thead>
                  <tr className="text-slate-600 dark:text-slate-200">
                    <th className="p-3 font-medium text-left">Date</th>
                    <th className="p-3 font-medium text-left">Score</th>
                    <th className="p-3 font-medium text-left">Mode</th>
                    <th className="p-3 font-medium text-left">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.filter(s => s.status === 'completed').map(s => (
                    <tr key={s._id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="p-3">{new Date(s.completedAt || s.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 font-bold">{s.score || 0}%</td>
                      <td className="p-3 capitalize">{s.mode}</td>
                      <td className="p-3">{s.itemIds?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </PageContainer>
      </main>
    </div>
  )
}

