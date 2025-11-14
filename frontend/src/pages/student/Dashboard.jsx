import { useEffect, useState } from 'react'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import ChatWidget from '../../components/ChatWidget.jsx'
import ChatPanel from '../../components/ChatPanel.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { apiFetch } from '../../api/client.js'

export default function StudentDashboard() {
  const [mastery, setMastery] = useState({})
  const [topics, setTopics] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showQuizModal, setShowQuizModal] = useState(false)
  const [quizConfig, setQuizConfig] = useState({ topic: '', questionCount: 5, mode: 'formative' })
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        // Get user and learnerProfile topics
        const me = await apiFetch('/api/auth/me')
        const topicMap = me.learnerProfile?.topics || {}
        // Convert Map-like structure to object if needed
        const masteryObj = topicMap instanceof Map ? Object.fromEntries(topicMap) : (typeof topicMap === 'object' ? topicMap : {})
        setMastery(masteryObj)
        setTopics(Object.keys(masteryObj))
        // Fetch last 5 completed assessment sessions
        let sessions = []
        if (me._id) {
          try {
            sessions = await apiFetch(`/api/assessment/sessions?status=completed&limit=5`)
          } catch (e) { /* backend may not have this endpoint yet */ }
        }
        setQuizzes((sessions && sessions.length) ? sessions.map(s=>({
          id: s._id,
          topic: s.metadata?.requestedTopics?.[0] || s.topics?.[0] || 'General',
          score: s.score || 0,
          difficulty: 'Adaptive', // Difficulty is now adaptive based on mastery
          time: s.completedAt && s.startedAt ? Math.round((new Date(s.completedAt) - new Date(s.startedAt))/60000)+"min" : '-',
          date: s.completedAt ? new Date(s.completedAt).toLocaleDateString() : new Date(s.createdAt).toLocaleDateString(),
        })) : [])
      } catch (e) {
        setError('Failed to load data. ' + (e.message||''))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleStartAssessment() {
    if (!quizConfig.topic.trim()) {
      setError('Please enter a topic')
      return
    }
    try {
      setError('')
      // Difficulty will be determined automatically by backend based on user mastery
      // Start assessment quickly; backend will queue generation if needed
      setIsStarting(true)
      const session = await apiFetch('/api/assessment/start', {
        method: 'POST',
        body: {
          mode: quizConfig.mode,
          requestedTopics: [quizConfig.topic],
          limit: quizConfig.questionCount
          // No difficulty parameter - backend will adapt based on user mastery
        },
      })
      // If background generation queued, poll a few times
      if (session?.queued) {
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 2500))
          try {
            const retried = await apiFetch('/api/assessment/start', {
              method: 'POST',
              body: {
                mode: quizConfig.mode,
                requestedTopics: [quizConfig.topic],
                limit: quizConfig.questionCount
                // No difficulty parameter - backend will adapt based on user mastery
              },
            })
            if (!retried?.queued) {
              sessionStorage.setItem('assessmentSession', JSON.stringify(retried))
              setShowQuizModal(false)
              setIsStarting(false)
              window.location.href = '/assessment'
              return
            }
          } catch {}
        }
        setIsStarting(false)
        setError('Still preparing questions… please try again in a moment.')
        return
      }
      sessionStorage.setItem('assessmentSession', JSON.stringify(session))
      setShowQuizModal(false)
      setIsStarting(false)
      window.location.href = '/assessment'
    } catch (e) {
      setIsStarting(false)
      setError('Failed to start assessment: ' + (e.message||''))
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center animate-fadeIn">
            <div className="flex-1">
              <div className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-2">
                Welcome back! 👋
              </div>
              <div className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
                Track your mastery progress across subjects and review your recent assessment attempts.
              </div>
            </div>
            <button 
              onClick={() => setShowQuizModal(true)} 
              className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 whitespace-nowrap shrink-0"
            >
              Start Assessment
            </button>
          </div>
          <section className="mb-10">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mastery Heatmap</h3>
              {topics.length > 0 && (
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 px-4 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 inline-block w-fit">
                  {topics.length} subject{topics.length !== 1 ? 's' : ''} tracked
                </span>
              )}
            </div>
            <div className="flex gap-4 sm:gap-6 overflow-x-auto rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 min-h-[240px] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
              {topics.length ? topics.map((topic) => {
                const m = mastery[topic] || { mastery: 0, attempts: 0 }
                // Handle both old (0-1) and new (0-100) formats
                let masteryPercent = m.mastery || 0;
                if (masteryPercent < 1 && masteryPercent > 0) {
                  masteryPercent = Math.round(masteryPercent * 100); // Old format: convert to percentage
                } else {
                  masteryPercent = Math.round(masteryPercent); // New format: already percentage
                }
                return (
                  <div 
                    key={topic} 
                    className="flex flex-col items-center gap-3 min-w-[140px] sm:min-w-[160px] p-5 rounded-xl hover:bg-white/90 dark:hover:bg-slate-700/50 transition-all duration-300 cursor-pointer group backdrop-blur-sm border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                    title={`${topic}: ${masteryPercent}% mastery | ${m.attempts || 0} attempts`}
                  >
                    <div className={
                      `h-28 w-28 sm:h-32 sm:w-32 rounded-full border-4 transition-all duration-300 flex items-center justify-center text-2xl sm:text-3xl font-extrabold shadow-xl group-hover:scale-110 group-hover:shadow-2xl ${
                        masteryPercent >= 80 ? 'bg-gradient-to-br from-green-400 via-emerald-500 to-green-600 text-white border-green-500 shadow-green-400/50 dark:shadow-green-600/50' :
                        masteryPercent >= 60 ? 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-amber-900 border-yellow-400 shadow-yellow-400/50 dark:shadow-yellow-600/50' :
                        masteryPercent > 0 ? 'bg-gradient-to-br from-rose-300 via-pink-400 to-rose-500 text-rose-900 border-rose-400 shadow-rose-400/50 dark:shadow-rose-600/50' :
                          'bg-gradient-to-br from-gray-300 via-slate-400 to-gray-500 text-gray-700 border-gray-400 shadow-gray-400/50 dark:shadow-gray-600/50'}
                    }`
                    }>
                      {masteryPercent}%
                    </div>
                    <div className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 text-center max-w-[140px] sm:max-w-[160px] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors px-2">{topic}</div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full whitespace-nowrap">{m.attempts || 0} attempt{m.attempts !== 1 ? 's' : ''}</div>
                  </div>
                )
              }) : (
                <div className="w-full py-12 text-center">
                  <div className="text-4xl mb-3">📚</div>
                  <p className="text-slate-500 dark:text-slate-400">No mastery data yet. Start your first assessment to begin tracking progress!</p>
                </div>
              )}
            </div>
          </section>
          <section>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Recent Assessment Attempts</h3>
            </div>
            {loading ? (
              <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 p-16 text-center">
                <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">Loading assessment history...</p>
              </div>
            ) : error ? (
              <div className="rounded-2xl border-2 border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 p-6 text-red-700 dark:text-red-400 shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <span className="font-semibold">{error}</span>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
                <table className="min-w-[600px] w-full text-sm">
                  <thead className="bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 dark:from-indigo-700 dark:via-blue-700 dark:to-indigo-800">
                    <tr>
                      <th className="p-5 font-bold text-left text-white">Topic</th>
                      <th className="p-5 font-bold text-left text-white">Score</th>
                      <th className="p-5 font-bold text-left text-white">Difficulty</th>
                      <th className="p-5 font-bold text-left text-white">Time</th>
                      <th className="p-5 font-bold text-left text-white">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzes.map(q => (
                      <tr key={q.id} className="border-t border-slate-200 dark:border-slate-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all duration-200">
                        <td className="p-5 font-semibold text-slate-900 dark:text-slate-100">{q.topic}</td>
                        <td className="p-5">
                          <span className={`font-extrabold text-2xl ${
                            q.score >= 80 ? 'text-green-600 dark:text-green-400' :
                            q.score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {q.score}%
                          </span>
                        </td>
                        <td className="p-5">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 capitalize">
                            {q.difficulty}
                          </span>
                        </td>
                        <td className="p-5 font-semibold text-slate-700 dark:text-slate-300">{q.time}</td>
                        <td className="p-5 font-semibold text-slate-700 dark:text-slate-300">{q.date}</td>
                      </tr>
                    ))}
                    {quizzes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-16">
                          <EmptyState 
                            icon="📝"
                            title="No assessments yet"
                            description="Start your first assessment to see your attempts here!"
                            action={() => setShowQuizModal(true)}
                            actionLabel="Start Assessment"
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </PageContainer>
        <ChatWidget />
      </main>
      {isStarting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="rounded-2xl bg-white px-10 py-8 text-center shadow-2xl dark:bg-slate-900 animate-slideIn">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <div className="text-base font-medium text-slate-900 dark:text-slate-100 mb-1">Preparing your assessment…</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">This may take a few seconds</div>
          </div>
        </div>
      )}
      {showQuizModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isStarting) {
              setShowQuizModal(false)
              setError('')
            }
          }}
        >
          <div 
            className="rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 w-full max-w-lg mx-4 animate-slideIn border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Configure Assessment</h3>
              <button
                onClick={() => { setShowQuizModal(false); setError('') }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-3xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                disabled={isStarting}
              >
                ×
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Topic *</label>
                <input
                  className="input-field focus-ring"
                  placeholder="e.g., Machine Learning, Algebra, Geometry"
                  value={quizConfig.topic}
                  onChange={e => setQuizConfig({...quizConfig, topic: e.target.value})}
                  disabled={isStarting}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Number of Questions</label>
                <input
                  type="number"
                  min="3"
                  max="20"
                  className="input-field focus-ring w-full"
                  value={quizConfig.questionCount}
                  onChange={e => setQuizConfig({...quizConfig, questionCount: parseInt(e.target.value) || 5})}
                  disabled={isStarting}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Difficulty will be automatically adjusted based on your mastery level
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Mode</label>
                <select
                  className="input-field focus-ring"
                  value={quizConfig.mode}
                  onChange={e => setQuizConfig({...quizConfig, mode: e.target.value})}
                  disabled={isStarting}
                >
                  <option value="formative">Formative</option>
                  <option value="diagnostic">Diagnostic</option>
                  <option value="summative">Summative</option>
                </select>
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-red-700 dark:text-red-400 text-sm animate-slideIn">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={handleStartAssessment} 
                  disabled={isStarting || !quizConfig.topic.trim()}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isStarting ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Starting...
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      Start Assessment
                    </>
                  )}
                </button>
                <button 
                  onClick={() => { setShowQuizModal(false); setError('') }} 
                  disabled={isStarting}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
