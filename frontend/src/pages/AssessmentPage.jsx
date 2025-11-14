import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client.js'
import ProctorGuard from '../components/ProctorGuard.jsx'

export default function AssessmentPage() {
  const [session, setSession] = useState(null)
  const [item, setItem] = useState(null)
  const [answerIndex, setAnswerIndex] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [matchPairs, setMatchPairs] = useState([]) // For match questions: [{key, value}]
  const [reorderItems, setReorderItems] = useState([]) // For reorder questions: array of items
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [proctorConfig, setProctorConfig] = useState(null)
  const [sessionInvalidated, setSessionInvalidated] = useState(false)

  async function loadCurrent(sessionId) {
    if (!sessionId) {
      const saved = sessionStorage.getItem('assessmentSession')
      if (saved) {
        const parsed = JSON.parse(saved)
        sessionId = parsed.sessionId || parsed._id
      }
    }
    if (!sessionId) {
      setError('No session found. Please start an assessment from the dashboard.')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError('')
      const cur = await apiFetch(`/api/assessment/current?sessionId=${encodeURIComponent(sessionId)}`, { timeout: 15000 })
      if (!cur.item || !cur.item.question) {
        // Soft-retry a few times in case generation just finished
        if (retryCount < 8) {
          setRetryCount(retryCount + 1)
          setTimeout(() => loadCurrent(sessionId), 2000)
          return
        } else {
          setError('No question found. The assessment may still be generating. Please try again in a moment or start a new assessment.')
          setLoading(false)
          return
        }
      }
      setSession({ sessionId: cur.sessionId || sessionId, currentIndex: cur.currentIndex, total: cur.total })
      setItem(cur.item)
      
      // Initialize answer state based on question type
      if (cur.item?.type === 'match') {
        // For match: answer is array of [key, value] pairs, choices might be keys or both sides
        if (Array.isArray(cur.item.choices) && cur.item.choices.length > 0) {
          setMatchPairs(cur.item.choices.map((choice, idx) => ({ id: idx, key: String(choice), value: '' })))
        }
      } else if (cur.item?.type === 'reorder' && cur.item.choices) {
        // For reorder: choices are the items, shuffle them for user to reorder
        const shuffled = [...cur.item.choices].sort(() => Math.random() - 0.5)
        setReorderItems(shuffled.map((item, idx) => ({ id: idx, value: item })))
      }
      setLoading(false)
      setRetryCount(0)
    } catch (e) {
      console.error('Failed to load assessment:', e)
      if (retryCount < 8) {
        setRetryCount(retryCount + 1)
        setTimeout(() => loadCurrent(sessionId), 2000)
      } else {
        setError('Failed to load assessment: ' + (e.message || 'Unknown error') + '. Please try starting a new assessment.')
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('assessmentSession')
    if (saved) {
      const parsed = JSON.parse(saved)
      const sessionId = parsed.sessionId || parsed._id
      if (sessionId) {
        setSession({ sessionId, currentIndex: parsed.currentIndex || 0, total: parsed.itemIds?.length || 0 })
        // Check if proctored and get proctorConfig
        if (parsed.proctorConfig) {
          setProctorConfig(parsed.proctorConfig)
        }
        loadCurrent(sessionId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit() {
    if (!session?.sessionId) return
    setMessage('')
    const body = { sessionId: session.sessionId }
    
    // Handle different question types
    if (item?.type === 'mcq' && item.choices?.length && (answerIndex !== null || answerIndex !== undefined)) {
      body.answerIndex = Number(answerIndex)
    } else if (item?.type === 'fill_blank' || item?.type === 'short_answer') {
      if (!answerText.trim()) {
        setMessage('Please enter an answer')
        return
      }
      body.answer = answerText
    } else if (item?.type === 'match') {
      // Match: send array of [key, value] pairs
      const pairs = matchPairs.filter(p => p.value.trim())
      if (pairs.length === 0) {
        setMessage('Please match at least one pair')
        return
      }
      body.answer = pairs.map(p => [p.key, p.value])
    } else if (item?.type === 'reorder') {
      // Reorder: send array of reordered items
      if (reorderItems.length === 0) {
        setMessage('Please reorder the items')
        return
      }
      body.answer = reorderItems.map(item => item.value)
    } else if (item?.choices?.length && (answerIndex !== null || answerIndex !== undefined)) {
      // Fallback for MCQ
      body.answerIndex = Number(answerIndex)
    } else {
      // Fallback for any other question type - use text answer
      if (!answerText.trim()) {
        setMessage('Please enter an answer')
        return
      }
      body.answer = answerText
    }
    
    try {
      setSubmitting(true)
      const r = await apiFetch('/api/assessment/answer', { method: 'POST', body, timeout: 12000 })
      if (r.hasMore) {
        setAnswerIndex(null); setAnswerText(''); setMatchPairs([]); setReorderItems([])
        setSession({ ...session, currentIndex: r.currentIndex })
        await loadCurrent(session.sessionId)
        setMessage(r.isCorrect ? 'Correct! ✓' : 'Incorrect ✗')
      } else {
        setMessage(`Finished! Score: ${r.score || 0}%`)
        const finishResult = await apiFetch('/api/assessment/finish', { method: 'POST', body: { sessionId: session.sessionId }, timeout: 10000 })
        sessionStorage.removeItem('assessmentSession')
        const sessionIdStr = String(session.sessionId || finishResult?.sessionId || r.sessionId || '')
        if (sessionIdStr) {
          setTimeout(() => {
            window.location.href = `/student/assessment-results/${sessionIdStr}`
          }, 1500)
        } else {
          setTimeout(() => {
            window.location.href = '/student/assessments'
          }, 1500)
        }
      }
    } catch (e) {
      if (e.status === 403 && e.message?.includes('invalidated')) {
        setSessionInvalidated(true)
        setError('Session invalidated due to proctor violations. Please contact your instructor.')
      } else if (e.name === 'AbortError') {
        setMessage('Request timed out. Please try again.')
      } else {
        setMessage('Error: ' + (e.message||''))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <div className="text-slate-600 dark:text-slate-400">Loading question...</div>
    </div>
  )

  if (error) return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-400">
        {error}
      </div>
      <button onClick={() => window.location.href = '/student'} className="mt-4 rounded bg-indigo-600 px-4 py-2 text-white">
        Go to Dashboard
      </button>
    </div>
  )

  if (!item || !item.question) return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 text-yellow-700 dark:text-yellow-400">
        No active question found. Please start an assessment from the dashboard.
      </div>
      <button onClick={() => window.location.href = '/student'} className="mt-4 rounded bg-indigo-600 px-4 py-2 text-white">
        Go to Dashboard
      </button>
    </div>
  )

  const handleInvalidated = (result) => {
    setSessionInvalidated(true)
    setError('Session invalidated due to proctor violations. Please contact your instructor.')
  }

  const assessmentContent = (
    <div className="mx-auto max-w-2xl py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Question {Number(session?.currentIndex || 0) + 1} of {session?.total || 0}
        </div>
        {item.topics && item.topics.length > 0 && (
          <div className="text-xs text-slate-400">
            Topic: {item.topics.join(', ')}
          </div>
        )}
      </div>
      
      <div className="rounded-xl bg-white dark:bg-slate-800 p-8 shadow-xl border border-slate-200 dark:border-slate-700 mb-6 card-hover">
        <div className="mb-4 flex items-center gap-2">
          <span className="badge badge-info capitalize">{item.type || 'question'}</span>
          {item.difficulty && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Difficulty: {item.difficulty}/5
            </span>
          )}
        </div>
        <h2 className="mb-6 text-2xl font-bold text-slate-900 dark:text-slate-100 leading-relaxed">{item.question}</h2>
        
        {/* MCQ Questions */}
        {item.type === 'mcq' && Array.isArray(item.choices) && item.choices.length > 0 && (
          <div className="space-y-3">
            {item.choices.map((choice, i) => (
              <label
                key={i}
                className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-5 transition-all duration-200 ${
                  Number(answerIndex) === i
                    ? 'bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-900/30 dark:to-emerald-900/20 border-indigo-500 dark:border-indigo-600 shadow-md scale-[1.02]'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <input
                  type="radio"
                  name="choice"
                  value={i}
                  checked={Number(answerIndex) === i}
                  onChange={() => setAnswerIndex(i)}
                  className="mt-1 w-5 h-5 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <span className="flex-1 text-base text-slate-700 dark:text-slate-300 font-medium">{choice}</span>
              </label>
            ))}
          </div>
        )}

        {/* Fill in the Blank and Short Answer */}
        {item.type === 'fill_blank' && (
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Your Answer:
              </label>
              <textarea
                className="input-field focus-ring resize-none w-full px-6 py-4 text-base leading-relaxed border-2 border-indigo-200 dark:border-indigo-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                rows={4}
                value={answerText}
                onChange={e => setAnswerText(e.target.value)}
                placeholder="Enter your answer here..."
                style={{ minHeight: '120px' }}
              />
            </div>
            {item.hints && item.hints.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <strong className="font-semibold">💡 Hint:</strong> <span className="ml-2">{item.hints[0]}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Short Answer Questions */}
        {item.type === 'short_answer' && (
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Type your detailed answer below:
              </label>
              <textarea
                className="input-field focus-ring resize-y w-full px-6 py-5 text-base leading-relaxed border-2 border-indigo-200 dark:border-indigo-700 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-xl"
                rows={10}
                value={answerText}
                onChange={e => setAnswerText(e.target.value)}
                placeholder="Type your detailed answer here. Be thorough and explain your reasoning..."
                style={{ minHeight: '250px', maxHeight: '500px' }}
              />
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {answerText.length} characters
              </div>
            </div>
            {item.hints && item.hints.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <strong className="font-semibold">💡 Hint:</strong> <span className="ml-2">{item.hints[0]}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Match Questions */}
        {item.type === 'match' && matchPairs.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Match each item on the left with its corresponding item on the right by typing the matching value.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Items to Match</h4>
                {matchPairs.map((pair, idx) => (
                  <div key={pair.id} className="p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-2 border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{pair.key}</span>
                    </div>
                    <input
                      type="text"
                      className="input-field focus-ring w-full"
                      placeholder="Enter matching value..."
                      value={pair.value}
                      onChange={e => {
                        const updated = [...matchPairs]
                        updated[idx].value = e.target.value
                        setMatchPairs(updated)
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Instructions</h4>
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    For each item on the left, type the corresponding matching value in the input field.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fallback for unknown question types - show textarea */}
        {!['mcq', 'fill_blank', 'short_answer', 'match', 'reorder'].includes(item.type) && (
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Your Answer:
              </label>
              <textarea
                className="input-field focus-ring resize-y w-full px-6 py-5 text-base leading-relaxed border-2 border-indigo-200 dark:border-indigo-700 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-xl"
                rows={6}
                value={answerText}
                onChange={e => setAnswerText(e.target.value)}
                placeholder="Enter your answer here..."
                style={{ minHeight: '150px' }}
              />
            </div>
            {item.hints && item.hints.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <strong className="font-semibold">💡 Hint:</strong> <span className="ml-2">{item.hints[0]}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reorder Questions */}
        {item.type === 'reorder' && Array.isArray(item.choices) && item.choices.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Drag and drop the items below to put them in the correct order.
            </p>
            <div className="space-y-2">
              {reorderItems.map((orderItem, idx) => (
                <div
                  key={orderItem.id}
                  className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 cursor-move hover:border-indigo-400 dark:hover:border-indigo-600 transition-all"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', idx.toString())
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'))
                    const dropIndex = idx
                    if (dragIndex !== dropIndex) {
                      const updated = [...reorderItems]
                      const [removed] = updated.splice(dragIndex, 1)
                      updated.splice(dropIndex, 0, removed)
                      setReorderItems(updated)
                    }
                  }}
                >
                  <span className="text-slate-400 dark:text-slate-500 text-lg">☰</span>
                  <span className="flex-1 text-base text-slate-700 dark:text-slate-300 font-medium">
                    {orderItem.value}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">#{idx + 1}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              <strong>Tip:</strong> Drag items to reorder them
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <button
          onClick={submit}
          disabled={
            (item.type === 'mcq' && (answerIndex === null || answerIndex === undefined)) ||
            ((item.type === 'fill_blank' || item.type === 'short_answer') && !answerText.trim()) ||
            (item.type === 'match' && matchPairs.filter(p => p.value.trim()).length === 0) ||
            (item.type === 'reorder' && reorderItems.length === 0) ||
            submitting
          }
          className="btn-primary flex items-center gap-2 text-lg px-8 py-4"
        >
          {submitting ? (
            <>
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Submitting…
            </>
          ) : (
            <>
              <span>✓</span>
              Submit Answer
            </>
          )}
        </button>
        {message && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
            message.includes('Correct') 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
              : message.includes('Incorrect') 
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
          } animate-slideIn`}>
            <span className="text-lg">{message.includes('Correct') ? '✓' : message.includes('Incorrect') ? '✗' : '📊'}</span>
            <span>{message}</span>
          </div>
        )}
      </div>
      
      {item.explanation && (
        <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4 text-sm text-slate-600 dark:text-slate-400">
          <strong>Note:</strong> {item.explanation}
        </div>
      )}
    </div>
  )

  // ALWAYS wrap with ProctorGuard if proctored - this is required for proctoring enforcement
  if (proctorConfig && session?.sessionId) {
    return (
      <ProctorGuard 
        sessionId={session.sessionId} 
        proctorConfig={proctorConfig}
        onInvalidated={handleInvalidated}
      >
        {assessmentContent}
      </ProctorGuard>
    )
  }

  // If not proctored, return content directly
  return assessmentContent
}

