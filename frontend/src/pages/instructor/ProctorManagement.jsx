import { useEffect, useState } from 'react'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { apiFetch } from '../../api/client.js'

export default function ProctorManagement() {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideAction, setOverrideAction] = useState('restore')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    setLoading(true)
    try {
      // Get all proctored sessions (you may need to add a backend endpoint for this)
      const allSessions = await apiFetch('/api/assessment/sessions?limit=100')
      const proctoredSessions = allSessions.filter(s => s.proctored || s.mode === 'proctored')
      setSessions(proctoredSessions)
    } catch (e) {
      setError('Failed to load sessions: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  async function loadSessionDetails(sessionId) {
    setSelectedSession(sessionId)
    setLoadingLogs(true)
    setError('')
    try {
      const [logsData, summaryData] = await Promise.all([
        apiFetch(`/api/proctor/session/${sessionId}/logs`).catch(() => ({ logs: [], total: 0 })),
        apiFetch(`/api/proctor/session/${sessionId}/summary`).catch(() => null)
      ])
      setLogs(logsData.logs || [])
      setSummary(summaryData)
    } catch (e) {
      setError('Failed to load session details: ' + (e.message || ''))
    } finally {
      setLoadingLogs(false)
    }
  }

  async function handleOverride() {
    if (!overrideReason.trim()) {
      setError('Reason is required')
      return
    }
    try {
      setError('')
      await apiFetch(`/api/proctor/session/${selectedSession}/override`, {
        method: 'POST',
        body: {
          action: overrideAction,
          reason: overrideReason
        }
      })
      setSuccess(`Session ${overrideAction === 'invalidate' ? 'invalidated' : 'restored'} successfully`)
      setShowOverrideModal(false)
      setOverrideReason('')
      await loadSessionDetails(selectedSession)
      await loadSessions()
    } catch (e) {
      setError('Failed to override session: ' + (e.message || ''))
    }
  }

  const selectedSessionData = sessions.find(s => s._id === selectedSession)

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <h2 className="mb-6 text-3xl font-semibold">Proctor Management</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-green-700 dark:text-green-400">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sessions List */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Proctored Sessions</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8 text-slate-400">Loading...</div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">No proctored sessions found</div>
                ) : (
                  sessions.map(session => (
                    <div
                      key={session._id}
                      onClick={() => loadSessionDetails(session._id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedSession === session._id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">
                          {new Date(session.createdAt).toLocaleString()}
                        </div>
                        <div className="flex gap-2">
                          {session.invalidated ? (
                            <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">
                              Invalidated
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                              Valid
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Mode: {session.mode} | Items: {session.itemIds?.length || 0}
                      </div>
                      {session.proctorSummary && (
                        <div className="text-xs text-slate-500 mt-1">
                          Risk: {session.proctorSummary.riskScore || 0} | 
                          Violations: {session.proctorSummary.totalViolations || 0}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Session Details */}
            <div>
              {selectedSession ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">Session Details</h3>
                    <button
                      onClick={() => {
                        setShowOverrideModal(true)
                        setOverrideAction(selectedSessionData?.invalidated ? 'restore' : 'invalidate')
                      }}
                      className={`rounded px-3 py-1 text-sm text-white ${
                        selectedSessionData?.invalidated
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {selectedSessionData?.invalidated ? 'Restore Session' : 'Invalidate Session'}
                    </button>
                  </div>

                  {summary && (
                    <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900">
                      <h4 className="font-semibold mb-2">Proctor Summary</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-500">Risk Score:</span>
                          <span className={`ml-2 font-bold ${
                            (summary.proctorSummary?.riskScore || 0) >= 20 ? 'text-red-600' :
                            (summary.proctorSummary?.riskScore || 0) >= 10 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {summary.proctorSummary?.riskScore || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Total Violations:</span>
                          <span className="ml-2 font-bold">{summary.proctorSummary?.totalViolations || 0}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Minor:</span>
                          <span className="ml-2">{summary.proctorSummary?.minorViolations || 0}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Major:</span>
                          <span className="ml-2">{summary.proctorSummary?.majorViolations || 0}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Tab Switches:</span>
                          <span className="ml-2">{summary.proctorSummary?.tabSwitchCount || 0}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Status:</span>
                          <span className={`ml-2 font-medium ${
                            summary.invalidated ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {summary.invalidated ? 'Invalidated' : 'Valid'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold mb-2">Violation Logs</h4>
                    {loadingLogs ? (
                      <div className="text-center py-8 text-slate-400">Loading logs...</div>
                    ) : logs.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">No violations recorded</div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {logs.map((log, idx) => (
                          <div
                            key={log._id || idx}
                            className={`p-3 rounded border ${
                              log.severity === 'major'
                                ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                                : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{log.violationType}</span>
                              <span className={`text-xs rounded-full px-2 py-1 ${
                                log.severity === 'major'
                                  ? 'bg-red-200 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                  : 'bg-yellow-200 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                              }`}>
                                {log.severity}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              {new Date(log.timestamp).toLocaleString()}
                            </div>
                            {log.details && (
                              <div className="text-xs text-slate-500 mt-1">{log.details}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  Select a session to view details
                </div>
              )}
            </div>
          </div>

          {/* Override Modal */}
          {showOverrideModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 w-full max-w-md mx-4">
                <h3 className="text-xl font-semibold mb-4">
                  {overrideAction === 'invalidate' ? 'Invalidate Session' : 'Restore Session'}
                </h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Reason *</label>
                  <textarea
                    className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                    rows={4}
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Enter reason for this action..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleOverride}
                    className={`flex-1 rounded px-4 py-2 text-white ${
                      overrideAction === 'invalidate'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setShowOverrideModal(false)
                      setOverrideReason('')
                    }}
                    className="rounded border px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </PageContainer>
      </main>
    </div>
  )
}

