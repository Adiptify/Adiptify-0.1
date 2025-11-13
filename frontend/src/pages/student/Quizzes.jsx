import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { apiFetch } from '../../api/client.js'

export default function Quizzes() {
  const [sessions, setSessions] = useState([])
  const [generated, setGenerated] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const [sess, gen] = await Promise.all([
          apiFetch('/api/quiz/sessions?limit=20'),
          apiFetch('/api/quizzes').catch(()=>[])
        ])
        setSessions(sess || [])
        setGenerated(Array.isArray(gen) ? gen.slice(0, 10) : [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const [showQuizModal, setShowQuizModal] = useState(false)
  const [quizConfig, setQuizConfig] = useState({ topic: '', questionCount: 5, difficulty: 'medium', mode: 'formative' })
  const [error, setError] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  async function startNew() {
    if (!quizConfig.topic.trim()) {
      setError('Please enter a topic')
      return
    }
    try {
      setError('')
      const difficultyMap = { easy: [1,2], medium: [2,3], hard: [4,5] }
      setIsStarting(true)
      const session = await apiFetch('/api/quiz/start', {
        method: 'POST',
        body: {
          mode: quizConfig.mode,
          requestedTopics: [quizConfig.topic],
          limit: quizConfig.questionCount,
          difficulty: difficultyMap[quizConfig.difficulty]
        }
      })
      if (session?.queued) {
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 2500))
          try {
            const retried = await apiFetch('/api/quiz/start', {
              method: 'POST',
              body: {
                mode: quizConfig.mode,
                requestedTopics: [quizConfig.topic],
                limit: quizConfig.questionCount,
                difficulty: difficultyMap[quizConfig.difficulty]
              }
            })
            if (!retried?.queued) {
              sessionStorage.setItem('session', JSON.stringify(retried))
              setShowQuizModal(false)
              setIsStarting(false)
              navigate('/quiz')
              return
            }
          } catch {}
        }
        setIsStarting(false)
        setError('Still preparing questions… please try again in a moment.')
        return
      }
      sessionStorage.setItem('session', JSON.stringify(session))
      setShowQuizModal(false)
      setIsStarting(false)
      navigate('/quiz')
    } catch (e) {
      setIsStarting(false)
      setError('Failed to start quiz: ' + e.message)
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-3xl font-semibold">My Quizzes</h2>
            <button onClick={() => setShowQuizModal(true)} className="rounded-lg bg-gradient-to-r from-indigo-600 to-emerald-500 px-6 py-3 font-bold text-white shadow hover:brightness-105">Start New Quiz</button>
          </div>

          {generated.length > 0 && (
            <div className="mb-8">
              <div className="mb-2 text-xl font-medium">Available Practice Sets</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm rounded-xl bg-slate-50 shadow-lg dark:bg-slate-900">
                  <thead>
                    <tr className="text-slate-600 dark:text-slate-200">
                      <th className="p-3 text-left">Topic</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Items</th>
                      <th className="p-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generated.map(g => (
                      <tr key={g._id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20">
                        <td className="p-3">{g.topic || '-'}</td>
                        <td className="p-3 capitalize">{g.status || 'draft'}</td>
                        <td className="p-3">{g.parsedItems?.length || g.items?.length || 0}</td>
                        <td className="p-3">
                          <button
                            className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            onClick={async () => {
                              if (isStarting) return
                              setIsStarting(true)
                              try {
                                const session = await apiFetch('/api/quiz/start', {
                                  method: 'POST',
                                  body: { mode: 'formative', requestedTopics: [g.topic], limit: 6 }
                                })
                                if (session?.queued) {
                                  // Wait and retry once
                                  await new Promise(r => setTimeout(r, 3000))
                                  try {
                                    const retried = await apiFetch('/api/quiz/start', { method: 'POST', body: { mode: 'formative', requestedTopics: [g.topic], limit: 6 } })
                                    if (!retried?.queued) {
                                      sessionStorage.setItem('session', JSON.stringify(retried))
                                      setIsStarting(false)
                                      navigate('/quiz')
                                      return
                                    }
                                  } catch {}
                                  setIsStarting(false)
                                  alert('Quiz is still being prepared. Please try again in a moment.')
                                } else {
                                  sessionStorage.setItem('session', JSON.stringify(session))
                                  setIsStarting(false)
                                  navigate('/quiz')
                                }
                              } catch (e) {
                                setIsStarting(false)
                                alert('Failed to start practice: ' + (e.message || ''))
                              }
                            }}
                            disabled={isStarting}
                          >
                            {isStarting ? 'Starting...' : 'Start Practice'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm rounded-xl bg-slate-50 shadow-lg dark:bg-slate-900">
              <thead>
                <tr className="text-slate-600 dark:text-slate-200">
                  <th className="p-3 font-medium text-left">Date</th>
                  <th className="p-3 font-medium text-left">Mode</th>
                  <th className="p-3 font-medium text-left">Score</th>
                  <th className="p-3 font-medium text-left">Status</th>
                  <th className="p-3 font-medium text-left">Items</th>
                  <th className="p-3 font-medium text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s._id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20">
                    <td className="p-3">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 capitalize">{s.mode}</td>
                    <td className="p-3 font-bold">{s.score || '-'}%</td>
                    <td className="p-3">
                      <span className={`rounded px-2 py-1 text-xs ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3">{s.itemIds?.length || 0}</td>
                    <td className="p-3">
                      {s.status === 'active' && (
                        <button onClick={() => {
                          sessionStorage.setItem('session', JSON.stringify(s))
                          navigate('/quiz')
                        }} className="rounded bg-indigo-600 px-3 py-1 text-xs text-white">Continue</button>
                      )}
                      {s.status === 'completed' && (
                        <button onClick={() => navigate(`/student/performance`)} className="rounded border px-3 py-1 text-xs">View Results</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && sessions.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-6">No quizzes yet. Start one!</td></tr>}
              </tbody>
            </table>
          </div>
        </PageContainer>
      </main>
      {isStarting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-2xl dark:bg-slate-900">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <div className="text-sm text-slate-600 dark:text-slate-300">Preparing your quiz…</div>
          </div>
        </div>
      )}
      {showQuizModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isStarting) {
              setShowQuizModal(false)
              setError('')
            }
          }}
        >
          <div 
            className="rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Configure Quiz</h3>
              <button
                onClick={() => { setShowQuizModal(false); setError('') }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none"
                disabled={isStarting}
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Topic *</label>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                  placeholder="e.g., Machine Learning, Algebra, Geometry"
                  value={quizConfig.topic}
                  onChange={e => setQuizConfig({...quizConfig, topic: e.target.value})}
                  disabled={isStarting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Number of Questions</label>
                <input
                  type="number"
                  min="3"
                  max="20"
                  className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                  value={quizConfig.questionCount}
                  onChange={e => setQuizConfig({...quizConfig, questionCount: parseInt(e.target.value) || 5})}
                  disabled={isStarting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Difficulty</label>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                  value={quizConfig.difficulty}
                  onChange={e => setQuizConfig({...quizConfig, difficulty: e.target.value})}
                  disabled={isStarting}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mode</label>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                  value={quizConfig.mode}
                  onChange={e => setQuizConfig({...quizConfig, mode: e.target.value})}
                  disabled={isStarting}
                >
                  <option value="formative">Formative</option>
                  <option value="diagnostic">Diagnostic</option>
                  <option value="summative">Summative</option>
                </select>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={startNew} 
                  disabled={isStarting || !quizConfig.topic.trim()}
                  className="flex-1 rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 transition flex items-center justify-center gap-2"
                >
                  {isStarting ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Starting...
                    </>
                  ) : 'Start Quiz'}
                </button>
                <button 
                  onClick={() => { setShowQuizModal(false); setError('') }} 
                  disabled={isStarting}
                  className="rounded border px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition"
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

