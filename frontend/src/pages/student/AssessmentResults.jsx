import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { apiFetch } from '../../api/client.js'
import ReactMarkdown from 'react-markdown'

export default function AssessmentResults() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [results, setResults] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [errorsByTopic, setErrorsByTopic] = useState({})
  const [remediation, setRemediation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingRemediation, setLoadingRemediation] = useState(false)
  const [error, setError] = useState('')
  const [generatingNotes, setGeneratingNotes] = useState(false)
  const [notesId, setNotesId] = useState(null)
  const [notesMarkdown, setNotesMarkdown] = useState(null)

  useEffect(() => {
    async function load() {
      if (!sessionId) {
        setError('No session ID provided')
        setLoading(false)
        return
      }

      try {
        // Validate sessionId format (MongoDB ObjectId is 24 hex characters)
        if (!sessionId || !/^[0-9a-fA-F]{24}$/.test(sessionId)) {
          setError('Invalid session ID format. Please check the URL and try again.')
          setLoading(false)
          return
        }
        
        // Fetch assessment session details
        const data = await apiFetch(`/api/assessment/session/${sessionId}/details`)
        
        if (!data) {
          setError('Failed to load assessment results. Please try again or contact support.')
          setLoading(false)
          return
        }
        
        if (!data.session) {
          setError('Assessment session not found. The session may have been deleted or you may not have access.')
          setLoading(false)
          return
        }
        
        setSession(data.session)
        setResults(Array.isArray(data.results) ? data.results : [])
        setStatistics(data.statistics || {
          total: data.results?.length || 0,
          correct: 0,
          incorrect: 0,
          unanswered: 0,
          accuracy: 0,
          score: data.session?.score || 0
        })
        setErrorsByTopic(data.errorsByTopic || {})
      } catch (e) {
        console.error('Assessment results error:', e)
        // Provide more helpful error messages
        if (e.status === 404 || e.message?.includes('not found')) {
          setError('Assessment results not found. The session may have been deleted or you may not have access.')
        } else if (e.status === 400 || e.message?.includes('Invalid')) {
          setError('Invalid session ID. Please check the URL and try again.')
        } else {
          setError('Failed to load assessment results: ' + (e.message || 'Unknown error. Please try again or contact support.'))
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId])

  async function loadRemediation() {
    if (!sessionId || loadingRemediation) return
    setLoadingRemediation(true)
    try {
      const data = await apiFetch(`/api/assessment/session/${sessionId}/remediation`)
      setRemediation(data)
    } catch (e) {
      console.error('Failed to load remediation:', e)
      setError('Failed to load remediation suggestions.')
    } finally {
      setLoadingRemediation(false)
    }
  }

  async function generateStudyNotes() {
    if (!sessionId || generatingNotes) return
    setGeneratingNotes(true)
    setError('')
    try {
      // Get mistakes from errorsByTopic or from results
      let mistakes = []
      if (Object.keys(errorsByTopic).length > 0) {
        mistakes = Object.entries(errorsByTopic).flatMap(([topic, errors]) =>
          errors.map(err => ({
            topic,
            question: err.question,
            userAnswer: err.userAnswer,
            correctAnswer: err.correctAnswer
          }))
        )
      } else {
        // Fallback: get mistakes from results
        mistakes = results
          .filter(r => r.attempt && !r.attempt.isCorrect)
          .map(r => ({
            topic: r.topics?.[0] || 'General',
            question: r.question,
            userAnswer: r.attempt.userAnswer,
            correctAnswer: r.correctAnswer
          }))
      }

      if (mistakes.length === 0) {
        setError('No mistakes found to generate notes from')
        setGeneratingNotes(false)
        return
      }

      // Get the main topic from session metadata or first error topic
      const mainTopic = session?.metadata?.requestedTopics?.[0] || Object.keys(errorsByTopic)[0] || mistakes[0]?.topic || 'General'

      const data = await apiFetch('/api/ai/notes', {
        method: 'POST',
        body: {
          topic: mainTopic,
          mistakes
        }
      })

      setNotesId(data.notesId)
      setNotesMarkdown(data.markdown)
    } catch (e) {
      setError('Failed to generate study notes: ' + (e.message || ''))
    } finally {
      setGeneratingNotes(false)
    }
  }

  async function downloadNotes() {
    if (!notesId) return
    try {
      const apiBase = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:4000' : '')
      const token = localStorage.getItem('token')
      
      const response = await fetch(`${apiBase}/api/notes/${notesId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const topicName = session?.metadata?.requestedTopics?.[0] || 'study'
        a.download = `${topicName.replace(/[^a-z0-9]/gi, '_')}_notes.html`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        setError('Failed to download notes')
      }
    } catch (e) {
      setError('Failed to download notes: ' + (e.message || ''))
    }
  }

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <PageContainer>
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
              <p className="mt-2 text-slate-600 dark:text-slate-400">Loading results...</p>
            </div>
          </PageContainer>
        </main>
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <PageContainer>
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-400">
              {error}
            </div>
            <button onClick={() => navigate('/student/assessments')} className="mt-4 rounded bg-indigo-600 px-4 py-2 text-white">
              Back to Assessments
            </button>
          </PageContainer>
        </main>
      </div>
    )
  }

  const correctCount = results.length > 0 ? results.filter(r => r.attempt?.isCorrect).length : (statistics?.correct || 0)
  const incorrectCount = results.length > 0 ? results.filter(r => r.attempt && !r.attempt.isCorrect).length : (statistics?.incorrect || 0)
  const unansweredCount = results.length > 0 ? results.filter(r => !r.attempt).length : (statistics?.unanswered || 0)
  
  // Show empty state if no results
  if (!loading && !error && results.length === 0 && !session) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <PageContainer>
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📊</div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">No Results Available</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                This assessment session may not have been completed or results are not yet available.
              </p>
              <button onClick={() => navigate('/student/assessments')} className="btn-primary">
                Back to Assessments
              </button>
            </div>
          </PageContainer>
        </main>
      </div>
    )
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-semibold">Assessment Results</h2>
              <p className="text-slate-600 dark:text-slate-400">
                {session?.completedAt ? new Date(session.completedAt).toLocaleString() : 'Completed'}
              </p>
            </div>
            <button onClick={() => navigate('/student/assessments')} className="rounded border px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              Back to Assessments
            </button>
          </div>

          {/* Statistics Cards */}
          {statistics && (
            <div className="mb-10 grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
              <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 shadow-xl text-white card-hover">
                <div className="text-4xl font-bold mb-2">{statistics.score || session?.score || 0}%</div>
                <div className="text-sm font-medium text-indigo-100">Overall Score</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 shadow-xl text-white card-hover">
                <div className="text-4xl font-bold mb-2">{statistics.correct || correctCount}</div>
                <div className="text-sm font-medium text-green-100">Correct</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-red-500 to-rose-600 p-6 shadow-xl text-white card-hover">
                <div className="text-4xl font-bold mb-2">{statistics.incorrect || incorrectCount}</div>
                <div className="text-sm font-medium text-red-100">Incorrect</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 p-6 shadow-xl text-white card-hover">
                <div className="text-4xl font-bold mb-2">{statistics.unanswered || unansweredCount}</div>
                <div className="text-sm font-medium text-yellow-100">Unanswered</div>
              </div>
            </div>
          )}

          {/* Study Notes Section */}
          {incorrectCount > 0 && (
            <div className="mb-8 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 p-6 shadow-xl card-hover">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">📚 Study Notes</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Personalized notes based on your mistakes</p>
                </div>
                <div className="flex gap-2">
                  {!notesMarkdown && (
                    <button
                      onClick={generateStudyNotes}
                      disabled={generatingNotes}
                      className="btn-primary flex items-center gap-2"
                    >
                      {generatingNotes ? (
                        <>
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <span>✨</span>
                          Generate Notes
                        </>
                      )}
                    </button>
                  )}
                  {notesId && (
                    <button
                      onClick={downloadNotes}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <span>📥</span>
                      Download
                    </button>
                  )}
                </div>
              </div>
              {notesMarkdown ? (
                <div className="prose dark:prose-invert max-w-none bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <ReactMarkdown>{notesMarkdown}</ReactMarkdown>
                </div>
              ) : (
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    Generate personalized study notes based on your mistakes. The notes will include key concepts, examples, and practice exercises to help you improve.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Remediation Section */}
          {incorrectCount > 0 && (
            <div className="mb-8 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-6 shadow-xl card-hover">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">💡 AI Improvement Suggestions</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Personalized recommendations to help you improve</p>
                </div>
                {!remediation && (
                  <button
                    onClick={loadRemediation}
                    disabled={loadingRemediation}
                    className="btn-primary flex items-center gap-2"
                  >
                    {loadingRemediation ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <span>🤖</span>
                        Get Suggestions
                      </>
                    )}
                  </button>
                )}
              </div>
              {remediation ? (
                <div className="space-y-4 animate-fadeIn">
                  <div className="rounded-lg bg-white dark:bg-slate-800 p-6 border border-slate-200 dark:border-slate-700 shadow-md">
                    <ReactMarkdown className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                      {remediation.remediation}
                    </ReactMarkdown>
                  </div>
                  {remediation.weakTopics && remediation.weakTopics.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                      <h4 className="font-bold mb-3 text-slate-900 dark:text-slate-100">Weak Topics:</h4>
                      <div className="flex flex-wrap gap-2">
                        {remediation.weakTopics.map(topic => (
                          <span key={topic} className="badge badge-error">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {remediation.recommendations && remediation.recommendations.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                      <h4 className="font-bold mb-3 text-slate-900 dark:text-slate-100">Recommendations:</h4>
                      <ul className="space-y-3">
                        {remediation.recommendations.map((rec, i) => (
                          <li key={i} className="border-l-4 border-indigo-500 pl-4">
                            <strong className="text-indigo-600 dark:text-indigo-400">{rec.topic}:</strong>
                            <p className="text-slate-700 dark:text-slate-300 mt-1">{rec.action}</p>
                            {rec.practiceSuggestions && rec.practiceSuggestions.length > 0 && (
                              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                                {rec.practiceSuggestions.map((suggestion, j) => (
                                  <li key={j} className="text-sm text-slate-600 dark:text-slate-400">{suggestion}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-600 dark:text-slate-400">
                  Click "Get AI Suggestions" to receive personalized remediation advice based on your mistakes.
                </p>
              )}
            </div>
          )}

          {/* Errors by Topic */}
          {Object.keys(errorsByTopic).length > 0 && (
            <div className="mb-8 rounded-xl border-2 border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 p-6 shadow-xl card-hover">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">❌ Errors by Topic</h3>
              {Object.entries(errorsByTopic).map(([topic, errors]) => (
                <div key={topic} className="mb-6 last:mb-0 bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-lg text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                    <span className="badge badge-error">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>
                    {topic}
                  </h4>
                  <ul className="space-y-3">
                    {errors.map((err, i) => (
                      <li key={i} className="border-l-4 border-red-400 pl-4 py-2">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                          <strong>Q:</strong> {err.question}
                        </div>
                        <div className="text-xs space-y-1">
                          <div>
                            <span className="font-semibold text-red-600 dark:text-red-400">Your Answer:</span>
                            <span className="ml-2 text-slate-700 dark:text-slate-300">{String(err.userAnswer)}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-green-600 dark:text-green-400">Correct:</span>
                            <span className="ml-2 text-slate-700 dark:text-slate-300">{String(err.correctAnswer)}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Detailed Results */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Question-by-Question Review</h3>
            <div className="space-y-4">
              {results.map((result, idx) => (
                <div
                  key={result.itemId || idx}
                  className={`rounded-xl border-2 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl ${
                    result.attempt?.isCorrect
                      ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20'
                      : result.attempt
                      ? 'border-red-400 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20'
                      : 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">Question {result.index + 1}</span>
                        {result.attempt?.isCorrect ? (
                          <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                            ✓ Correct
                          </span>
                        ) : result.attempt ? (
                          <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">
                            ✗ Incorrect
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                            ○ Unanswered
                          </span>
                        )}
                        {result.difficulty && (
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs">
                            Difficulty: {result.difficulty}/5
                          </span>
                        )}
                        <span className="badge badge-info capitalize">{result.type}</span>
                      </div>
                      <h4 className="text-lg font-medium mb-3">{result.question}</h4>
                      {result.topics && result.topics.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {result.topics.map(topic => (
                            <span key={topic} className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 text-xs">
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {result.type === 'mcq' && result.choices && result.choices.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm font-medium mb-2">Options:</div>
                      <div className="space-y-2">
                        {result.choices.map((choice, i) => {
                          const isCorrect = String(choice) === String(result.correctAnswer)
                          const isUserAnswer = result.attempt && String(choice) === String(result.attempt.userAnswer)
                          return (
                            <div
                              key={i}
                              className={`p-2 rounded ${
                                isCorrect
                                  ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                                  : isUserAnswer
                                  ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
                                  : 'bg-slate-100 dark:bg-slate-800'
                              }`}
                            >
                              {choice}
                              {isCorrect && <span className="ml-2 text-green-600 dark:text-green-400">✓ Correct</span>}
                              {isUserAnswer && !isCorrect && <span className="ml-2 text-red-600 dark:text-red-400">✗ Your Answer</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {result.attempt && (
                    <div className="mb-3 space-y-2">
                      <div>
                        <span className="font-medium">Your Answer: </span>
                        <span className={result.attempt.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {Array.isArray(result.attempt.userAnswer) 
                            ? JSON.stringify(result.attempt.userAnswer) 
                            : String(result.attempt.userAnswer)}
                        </span>
                      </div>
                      {!result.attempt.isCorrect && (
                        <div>
                          <span className="font-medium">Correct Answer: </span>
                          <span className="text-green-600 dark:text-green-400">
                            {Array.isArray(result.correctAnswer) 
                              ? JSON.stringify(result.correctAnswer) 
                              : String(result.correctAnswer)}
                          </span>
                        </div>
                      )}
                      {result.attempt.score !== undefined && result.attempt.score < 1 && (
                        <div>
                          <span className="font-medium">Score: </span>
                          <span>{Math.round(result.attempt.score * 100)}%</span>
                        </div>
                      )}
                      {result.attempt.timeTakenMs && (
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          Time taken: {Math.round(result.attempt.timeTakenMs / 1000)}s
                        </div>
                      )}
                    </div>
                  )}

                  {(result.explanation || result.attempt?.explanation) && (
                    <div className="mt-4 rounded-lg bg-slate-100 dark:bg-slate-800 p-4">
                      <div className="font-medium mb-2">Explanation:</div>
                      <ReactMarkdown className="prose dark:prose-invert max-w-none text-sm">
                        {result.attempt?.explanation || result.explanation}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => navigate('/student/assessments')}
              className="btn-secondary"
            >
              ← Back to Assessments
            </button>
            {session?.metadata?.requestedTopics && session.metadata.requestedTopics.length > 0 && (
              <button
                onClick={() => {
                  const topic = session.metadata.requestedTopics[0]
                  navigate(`/student/learning?topic=${encodeURIComponent(topic)}`)
                }}
                className="btn-primary"
              >
                📖 Review Learning Module
              </button>
            )}
          </div>
        </PageContainer>
      </main>
    </div>
  )
}

