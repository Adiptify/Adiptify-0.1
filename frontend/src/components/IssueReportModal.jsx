import { useState } from 'react'
import { apiFetch } from '../api/client.js'

export default function IssueReportModal({ isOpen, onClose, panel = '', section = '' }) {
  const [formData, setFormData] = useState({
    panel: panel || '',
    section: section || '',
    summary: '',
    details: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.summary || !formData.details || !formData.panel) {
      setError('Summary, details, and panel are required')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await apiFetch('/api/report-issue', {
        method: 'POST',
        body: formData
      })
      setSuccess(true)
      setTimeout(() => {
        onClose()
        setFormData({ panel: panel || '', section: section || '', summary: '', details: '' })
        setSuccess(false)
      }, 1500)
    } catch (e) {
      setError('Failed to report issue: ' + (e.message || ''))
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 w-full max-w-md mx-4">
        <h3 className="text-xl font-semibold mb-4">Report an Issue</h3>
        
        {success ? (
          <div className="text-center py-8">
            <div className="text-green-600 dark:text-green-400 text-lg font-medium mb-2">✓ Issue Reported</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Thank you for your feedback!</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Panel *</label>
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                value={formData.panel}
                onChange={e => setFormData({ ...formData, panel: e.target.value })}
                required
              >
                <option value="">Select panel...</option>
                <option value="Student Dashboard">Student Dashboard</option>
                <option value="Quiz Page">Quiz Page</option>
                <option value="Learning Module">Learning Module</option>
                <option value="Chat">Chat</option>
                <option value="Performance">Performance</option>
                <option value="Instructor Dashboard">Instructor Dashboard</option>
                <option value="Admin Dashboard">Admin Dashboard</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Section</label>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                value={formData.section}
                onChange={e => setFormData({ ...formData, section: e.target.value })}
                placeholder="e.g., Mastery Heatmap, Quiz Results"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Summary *</label>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                value={formData.summary}
                onChange={e => setFormData({ ...formData, summary: e.target.value })}
                placeholder="Brief description of the issue"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Details *</label>
              <textarea
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                rows={4}
                value={formData.details}
                onChange={e => setFormData({ ...formData, details: e.target.value })}
                placeholder="Describe the issue in detail..."
                required
              />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded bg-indigo-600 px-4 py-2 text-white hover:brightness-105 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded border px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

