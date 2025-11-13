import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client.js'

export default function QuizPage() {
  const [session, setSession] = useState(null)
  const [item, setItem] = useState(null)
  const [answerIndex, setAnswerIndex] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  async function loadCurrent(sessionId) {
    if (!sessionId) {
      const saved = sessionStorage.getItem('session')
      if (saved) {
        const parsed = JSON.parse(saved)
        sessionId = parsed.sessionId || parsed._id
      }
    }
    if (!sessionId) {
      setError('No session found. Please start a quiz from the dashboard.')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError('')
      const cur = await apiFetch(`/api/quiz/current?sessionId=${encodeURIComponent(sessionId)}`, { timeout: 15000 })
      if (!cur.item || !cur.item.question) {
        // Soft-retry a few times in case generation just finished
        if (retryCount < 8) {
          setRetryCount(retryCount + 1)
          setTimeout(() => loadCurrent(sessionId), 2000)
          return
        } else {
          setError('No question found. The quiz may still be generating. Please try again in a moment or start a new quiz.')
          setLoading(false)
          return
        }
      }
      setSession({ sessionId: cur.sessionId || sessionId, currentIndex: cur.currentIndex, total: cur.total })
      setItem(cur.item)
      setLoading(false)
      setRetryCount(0) // Reset retry count on success
    } catch (e) {
      console.error('Failed to load quiz:', e)
      if (retryCount < 8) {
        setRetryCount(retryCount + 1)
        setTimeout(() => loadCurrent(sessionId), 2000)
      } else {
        setError('Failed to load quiz: ' + (e.message || 'Unknown error') + '. Please try starting a new quiz.')
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('session')
    if (saved) {
      const parsed = JSON.parse(saved)
      const sessionId = parsed.sessionId || parsed._id
      if (sessionId) {
        setSession({ sessionId, currentIndex: parsed.currentIndex || 0, total: parsed.itemIds?.length || 0 })
        loadCurrent(sessionId)
      }
    }
  }, [])

  async function submit() {
    if (!session?.sessionId) return
    setMessage('')
    const body = { sessionId: session.sessionId }
    if (item?.choices?.length && answerIndex !== null) body.answerIndex = Number(answerIndex)
    else if (answerText) body.answer = answerText
    else {
      setMessage('Please select an answer')
      return
    }
    try {
      setSubmitting(true)
      const r = await apiFetch('/api/quiz/answer', { method: 'POST', body, timeout: 12000 })
      if (r.hasMore) {
        setAnswerIndex(null); setAnswerText('')
        setSession({ ...session, currentIndex: r.currentIndex })
        await loadCurrent(session.sessionId)
        setMessage(r.isCorrect ? 'Correct! ✓' : 'Incorrect ✗')
      } else {
        setMessage(`Finished! Score: ${r.score || 0}%`)
        await apiFetch('/api/quiz/finish', { method: 'POST', body: { sessionId: session.sessionId }, timeout: 10000 })
        sessionStorage.removeItem('session')
        setTimeout(() => window.location.href = '/student', 2000)
      }
    } catch (e) {
      if (e.name === 'AbortError') setMessage('Request timed out. Please try again.')
      else setMessage('Error: ' + (e.message||''))
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
        No active question found. Please start a quiz from the dashboard.
      </div>
      <button onClick={() => window.location.href = '/student'} className="mt-4 rounded bg-indigo-600 px-4 py-2 text-white">
        Go to Dashboard
      </button>
    </div>
  )

  return (
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
      
      <div className="rounded-xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-200 dark:border-slate-700 mb-4">
        <h2 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">{item.question}</h2>
        
        {Array.isArray(item.choices) && item.choices.length > 0 ? (
          <div className="space-y-3">
            {item.choices.map((choice, i) => (
              <label
                key={i}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-all ${
                  Number(answerIndex) === i
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                <input
                  type="radio"
                  name="choice"
                  value={i}
                  checked={Number(answerIndex) === i}
                  onChange={() => setAnswerIndex(i)}
                  className="mt-1"
                />
                <span className="flex-1 text-slate-700 dark:text-slate-300">{choice}</span>
              </label>
            ))}
          </div>
        ) : (
          <textarea
            className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 p-3 bg-transparent text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            rows={4}
            value={answerText}
            onChange={e => setAnswerText(e.target.value)}
            placeholder="Type your answer here..."
          />
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={item.choices?.length ? answerIndex === null : !answerText.trim()}
          className="rounded-lg bg-gradient-to-r from-indigo-600 to-emerald-500 px-6 py-3 font-semibold text-white shadow hover:brightness-105 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          {submitting ? 'Submitting…' : 'Submit Answer'}
        </button>
        {message && (
          <span className={`text-sm font-medium ${message.includes('Correct') ? 'text-green-600 dark:text-green-400' : message.includes('Incorrect') ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
            {message}
          </span>
        )}
      </div>
      
      {item.explanation && (
        <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4 text-sm text-slate-600 dark:text-slate-400">
          <strong>Note:</strong> {item.explanation}
        </div>
      )}
    </div>
  )
}


