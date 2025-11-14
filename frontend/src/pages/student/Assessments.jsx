import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { apiFetch } from '../../api/client.js'

export default function Assessments() {
  const [sessions, setSessions] = useState([])
  const [generated, setGenerated] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const [sess, gen] = await Promise.all([
          apiFetch('/api/assessment/sessions?limit=20'),
          apiFetch('/api/assessment/list?status=published&limit=20').catch(()=>[])
        ])
        setSessions(sess || [])
        // Filter to only show published assessments with items
        const publishedAssessments = Array.isArray(gen) 
          ? gen.filter(g => g.status === 'published' && (g.itemCount > 0 || g.linkedItemIds?.length > 0))
          : []
        setGenerated(publishedAssessments.slice(0, 20))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const [showAssessmentModal, setShowAssessmentModal] = useState(false)
  const [assessmentConfig, setAssessmentConfig] = useState({ topic: '', questionCount: 5, mode: 'formative' })
  const [error, setError] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  async function startNew() {
    if (!assessmentConfig.topic.trim()) {
      setError('Please enter a topic')
      return
    }
    try {
      setError('')
      // Difficulty will be determined automatically by backend based on user mastery
      setIsStarting(true)
      const session = await apiFetch('/api/assessment/start', {
        method: 'POST',
        body: {
          mode: assessmentConfig.mode,
          requestedTopics: [assessmentConfig.topic],
          limit: assessmentConfig.questionCount
          // No difficulty parameter - backend will adapt based on user mastery
        }
      })
      if (session?.queued) {
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 2500))
          try {
            const retried = await apiFetch('/api/assessment/start', {
              method: 'POST',
              body: {
                mode: assessmentConfig.mode,
                requestedTopics: [assessmentConfig.topic],
                limit: assessmentConfig.questionCount
                // No difficulty parameter - backend will adapt based on user mastery
              },
            })
            if (!retried?.queued) {
              sessionStorage.setItem('assessmentSession', JSON.stringify(retried))
              setShowAssessmentModal(false)
              setIsStarting(false)
              navigate('/assessment')
              return
            }
          } catch {}
        }
        setIsStarting(false)
        setError('Still preparing questions… please try again in a moment.')
        return
      }
      sessionStorage.setItem('assessmentSession', JSON.stringify(session))
      setShowAssessmentModal(false)
      setIsStarting(false)
      navigate('/assessment')
    } catch (e) {
      setIsStarting(false)
      setError('Failed to start assessment: ' + e.message)
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <div className="mb-8 flex items-center justify-between animate-fadeIn">
            <div>
              <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">My Assessments</h2>
              <p className="text-slate-600 dark:text-slate-400">View your assessment history and start new sessions</p>
            </div>
            <button 
              onClick={() => setShowAssessmentModal(true)} 
              className="btn-primary"
            >
              Start New Assessment
            </button>
          </div>

          {generated.length > 0 && (
            <div className="mb-10">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Available Practice Sets</h3>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{generated.length} available</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg">
                  <table className="w-full text-sm bg-white dark:bg-slate-900">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Topic</th>
                        <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Title</th>
                        <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Status</th>
                        <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Items</th>
                        <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Created</th>
                        <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generated.map(g => (
                        <tr key={g._id} className="table-row border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-4 font-medium text-slate-900 dark:text-slate-100">{g.topic || '-'}</td>
                          <td className="p-4 font-medium text-slate-900 dark:text-slate-100">{g.title || g.topic || '-'}</td>
                          <td className="p-4">
                            <span className={`badge ${
                              g.status === 'published' ? 'badge-success' : 'badge-warning'
                            } capitalize`}>
                              {g.status || 'draft'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-400">
                            {g.itemCount || g.linkedItemIds?.length || 0} questions
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-400 text-xs">
                            {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="p-4">
                            <button
                              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                              onClick={async () => {
                                if (isStarting) return
                                setIsStarting(true)
                                try {
                                  const session = await apiFetch('/api/assessment/start', {
                                    method: 'POST',
                                    body: { mode: 'formative', requestedTopics: [g.topic], limit: Math.min(g.itemCount || 6, 10) }
                                    // No difficulty parameter - backend will adapt based on user mastery
                                  })
                                  if (session?.queued) {
                                    // Wait and retry once
                                    await new Promise(r => setTimeout(r, 3000))
                                    try {
                                      const retried = await apiFetch('/api/assessment/start', { 
                                        method: 'POST', 
                                        body: { 
                                          mode: 'formative', 
                                          requestedTopics: [g.topic], 
                                          limit: Math.min(g.itemCount || 6, 10) 
                                        } 
                                      })
                                      if (!retried?.queued) {
                                        sessionStorage.setItem('assessmentSession', JSON.stringify(retried))
                                        setIsStarting(false)
                                        navigate('/assessment')
                                        return
                                      }
                                    } catch {}
                                    setIsStarting(false)
                                    alert('Assessment is still being prepared. Please try again in a moment.')
                                  } else {
                                    sessionStorage.setItem('assessmentSession', JSON.stringify(session))
                                    setIsStarting(false)
                                    navigate('/assessment')
                                  }
                                } catch (e) {
                                  setIsStarting(false)
                                  alert('Failed to start practice: ' + (e.message || ''))
                                }
                              }}
                              disabled={isStarting || (g.itemCount === 0 && g.status !== 'published')}
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
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Assessment History</h3>
            <span className="text-sm text-slate-500 dark:text-slate-400">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg">
            <table className="w-full text-sm bg-white dark:bg-slate-900">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Date</th>
                  <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Mode</th>
                  <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Score</th>
                  <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Status</th>
                  <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Items</th>
                  <th className="p-4 font-semibold text-left text-slate-700 dark:text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s._id} className="table-row border-t border-slate-200 dark:border-slate-800">
                    <td className="p-4 text-slate-600 dark:text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className="badge badge-info capitalize">{s.mode}</span>
                    </td>
                    <td className="p-4">
                      <span className={`font-bold text-lg ${
                        s.score >= 80 ? 'text-green-600 dark:text-green-400' :
                        s.score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                        s.score > 0 ? 'text-red-600 dark:text-red-400' :
                        'text-slate-400'
                      }`}>
                        {s.score || '-'}%
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`badge ${
                        s.status === 'completed' ? 'badge-success' : 
                        s.status === 'active' ? 'badge-info' : 
                        'badge-warning'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">{s.itemIds?.length || 0}</td>
                    <td className="p-4">
                      {s.status === 'active' && (
                        <button 
                          onClick={() => {
                            sessionStorage.setItem('assessmentSession', JSON.stringify(s))
                            navigate('/assessment')
                          }} 
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                          Continue
                        </button>
                      )}
                      {s.status === 'completed' && (
                        <button 
                          onClick={() => navigate(`/student/assessment-results/${s._id}`)} 
                          className="btn-secondary text-sm"
                        >
                          View Results
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && sessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12">
                      <EmptyState 
                        icon="📝"
                        title="No assessments yet"
                        description="Start your first assessment to see your history here!"
                        action={() => setShowAssessmentModal(true)}
                        actionLabel="Start Assessment"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </PageContainer>
        {isStarting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="rounded-2xl bg-white px-10 py-8 text-center shadow-2xl dark:bg-slate-900 animate-slideIn">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              <div className="text-base font-medium text-slate-900 dark:text-slate-100 mb-1">Preparing your assessment…</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">This may take a few seconds</div>
            </div>
          </div>
        )}
        {showAssessmentModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isStarting) {
                setShowAssessmentModal(false)
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
                  onClick={() => { setShowAssessmentModal(false); setError('') }}
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
                    value={assessmentConfig.topic}
                    onChange={e => setAssessmentConfig({...assessmentConfig, topic: e.target.value})}
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
                    value={assessmentConfig.questionCount}
                    onChange={e => setAssessmentConfig({...assessmentConfig, questionCount: parseInt(e.target.value) || 5})}
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
                    value={assessmentConfig.mode}
                    onChange={e => setAssessmentConfig({...assessmentConfig, mode: e.target.value})}
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
                    onClick={startNew} 
                    disabled={isStarting || !assessmentConfig.topic.trim()}
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
                    onClick={() => { setShowAssessmentModal(false); setError('') }} 
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
      </main>
    </div>
  )
}

