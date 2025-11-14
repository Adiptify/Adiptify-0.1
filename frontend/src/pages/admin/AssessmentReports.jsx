import { useEffect, useState } from 'react'
import { apiFetch } from '../../api/client.js'

export default function AssessmentReports() {
  const [reports, setReports] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    userId: '',
    topic: '',
    mode: '',
    status: '',
    startDate: '',
    endDate: '',
  })
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportDetails, setReportDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    loadReports()
    loadStats()
  }, [filters])

  async function loadReports() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.userId) params.append('userId', filters.userId)
      if (filters.topic) params.append('topic', filters.topic)
      if (filters.mode) params.append('mode', filters.mode)
      if (filters.status) params.append('status', filters.status)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      params.append('limit', '100')

      const data = await apiFetch(`/api/admin/assessment-reports?${params}`)
      setReports(data.reports || [])
    } catch (e) {
      setError('Failed to load reports: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    setLoadingStats(true)
    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const data = await apiFetch(`/api/admin/assessment-reports/stats?${params}`)
      setStats(data)
    } catch (e) {
      console.error('Failed to load stats:', e)
    } finally {
      setLoadingStats(false)
    }
  }

  async function loadReportDetails(sessionId) {
    setSelectedReport(sessionId)
    setLoadingDetails(true)
    setError('')
    try {
      const data = await apiFetch(`/api/admin/assessment-reports/${sessionId}`)
      setReportDetails(data)
    } catch (e) {
      setError('Failed to load report details: ' + (e.message || ''))
    } finally {
      setLoadingDetails(false)
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Assessment Reports</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">View and analyze student assessment performance</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Statistics Overview */}
      {stats && (
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 shadow-xl text-white">
            <div className="text-3xl font-bold mb-2">{stats.overview?.totalSessions || 0}</div>
            <div className="text-sm font-medium text-indigo-100">Total Sessions</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 shadow-xl text-white">
            <div className="text-3xl font-bold mb-2">{stats.overview?.completedSessions || 0}</div>
            <div className="text-sm font-medium text-green-100">Completed</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 shadow-xl text-white">
            <div className="text-3xl font-bold mb-2">{stats.overview?.avgScore || 0}%</div>
            <div className="text-sm font-medium text-blue-100">Avg Score</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 p-6 shadow-xl text-white">
            <div className="text-3xl font-bold mb-2">{stats.overview?.accuracy || 0}%</div>
            <div className="text-sm font-medium text-yellow-100">Accuracy</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Filter by student name/email..."
          className="input-field flex-1 min-w-[200px]"
          value={filters.userId}
          onChange={e => setFilters({ ...filters, userId: e.target.value })}
        />
        <input
          type="text"
          placeholder="Filter by topic..."
          className="input-field flex-1 min-w-[200px]"
          value={filters.topic}
          onChange={e => setFilters({ ...filters, topic: e.target.value })}
        />
        <select
          className="input-field"
          value={filters.mode}
          onChange={e => setFilters({ ...filters, mode: e.target.value })}
        >
          <option value="">All Modes</option>
          <option value="formative">Formative</option>
          <option value="diagnostic">Diagnostic</option>
          <option value="summative">Summative</option>
          <option value="proctored">Proctored</option>
        </select>
        <select
          className="input-field"
          value={filters.status}
          onChange={e => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="invalidated">Invalidated</option>
        </select>
        <input
          type="date"
          className="input-field"
          placeholder="Start Date"
          value={filters.startDate}
          onChange={e => setFilters({ ...filters, startDate: e.target.value })}
        />
        <input
          type="date"
          className="input-field"
          placeholder="End Date"
          value={filters.endDate}
          onChange={e => setFilters({ ...filters, endDate: e.target.value })}
        />
      </div>

      {/* Reports Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading reports...</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-indigo-500 to-blue-500 dark:from-indigo-700 dark:to-blue-700">
                <tr>
                  <th className="p-4 font-bold text-left text-white">Student</th>
                  <th className="p-4 font-bold text-left text-white">Topic</th>
                  <th className="p-4 font-bold text-left text-white">Mode</th>
                  <th className="p-4 font-bold text-left text-white">Score</th>
                  <th className="p-4 font-bold text-left text-white">Status</th>
                  <th className="p-4 font-bold text-left text-white">Date</th>
                  <th className="p-4 font-bold text-left text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr key={report._id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{report.userName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{report.userEmail}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-700 dark:text-slate-300">
                        {report.metadata?.requestedTopics?.[0] || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="badge badge-info capitalize">{report.mode}</span>
                    </td>
                    <td className="p-4">
                      <span className={`font-bold text-lg ${
                        report.score >= 80 ? 'text-green-600 dark:text-green-400' :
                        report.score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {report.score}%
                      </span>
                    </td>
                    <td className="p-4">
                      {report.invalidated ? (
                        <span className="badge badge-error">Invalidated</span>
                      ) : report.status === 'completed' ? (
                        <span className="badge badge-success">Completed</span>
                      ) : (
                        <span className="badge badge-warning">{report.status}</span>
                      )}
                      {report.proctored && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Proctored: {report.proctorViolations} violations
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">
                      {report.completedAt
                        ? new Date(report.completedAt).toLocaleDateString()
                        : new Date(report.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => loadReportDetails(report._id)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-500 dark:text-slate-400">
                      No assessment reports found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report Details Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setSelectedReport(null); setReportDetails(null); }}
        >
          <div
            className="rounded-2xl bg-white dark:bg-slate-900 p-8 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {loadingDetails ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">Loading details...</p>
              </div>
            ) : reportDetails ? (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Assessment Report Details</h3>
                  <button
                    onClick={() => { setSelectedReport(null); setReportDetails(null); }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-3xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 p-4">
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{reportDetails.statistics?.score || 0}%</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Score</div>
                  </div>
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{reportDetails.statistics?.correct || 0}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Correct</div>
                  </div>
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{reportDetails.statistics?.incorrect || 0}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Incorrect</div>
                  </div>
                  <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4">
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{reportDetails.statistics?.unanswered || 0}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Unanswered</div>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Student Information</h4>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                    <p><strong>Name:</strong> {reportDetails.session?.user?.name}</p>
                    <p><strong>Email:</strong> {reportDetails.session?.user?.email}</p>
                    {reportDetails.session?.user?.studentId && (
                      <p><strong>Student ID:</strong> {reportDetails.session.user.studentId}</p>
                    )}
                  </div>
                </div>

                {reportDetails.session?.proctored && reportDetails.proctorLogs && reportDetails.proctorLogs.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Proctor Logs</h4>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            <th className="text-left p-2">Time</th>
                            <th className="text-left p-2">Violation</th>
                            <th className="text-left p-2">Severity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportDetails.proctorLogs.map(log => (
                            <tr key={log._id}>
                              <td className="p-2">{new Date(log.timestamp).toLocaleString()}</td>
                              <td className="p-2">{log.violationType}</td>
                              <td className="p-2">
                                <span className={log.severity === 'major' ? 'text-red-600' : 'text-yellow-600'}>
                                  {log.severity}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-4 text-slate-900 dark:text-slate-100">Question-by-Question Results</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {reportDetails.results?.map((result, idx) => (
                      <div
                        key={result.itemId || idx}
                        className={`rounded-lg border-2 p-4 ${
                          result.attempt?.isCorrect
                            ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                            : result.attempt
                            ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                            : 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-semibold">Question {result.index + 1}</span>
                          {result.attempt?.isCorrect ? (
                            <span className="badge badge-success">Correct</span>
                          ) : result.attempt ? (
                            <span className="badge badge-error">Incorrect</span>
                          ) : (
                            <span className="badge badge-warning">Unanswered</span>
                          )}
                        </div>
                        <p className="text-sm mb-2">{result.question}</p>
                        {result.attempt && (
                          <div className="text-xs space-y-1">
                            <div>
                              <strong>Answer:</strong> {Array.isArray(result.attempt.userAnswer) ? JSON.stringify(result.attempt.userAnswer) : String(result.attempt.userAnswer)}
                            </div>
                            {!result.attempt.isCorrect && (
                              <div>
                                <strong>Correct:</strong> {Array.isArray(result.correctAnswer) ? JSON.stringify(result.correctAnswer) : String(result.correctAnswer)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                Failed to load report details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

