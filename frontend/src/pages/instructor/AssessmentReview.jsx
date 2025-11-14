import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { apiFetch } from '../../api/client.js'

export default function AssessmentReview() {
  const [assessments, setAssessments] = useState([])
  const [selectedAssessment, setSelectedAssessment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadAssessments()
  }, [])

  async function loadAssessments() {
    try {
      setLoading(true)
      const data = await apiFetch('/api/assessment/list?limit=100')
      setAssessments(Array.isArray(data) ? data : (data.assessments || []))
    } catch (e) {
      console.error('Failed to load assessments:', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadAssessmentDetails(id) {
    try {
      const assessment = await apiFetch(`/api/assessment/${id}`)
      setSelectedAssessment(assessment)
    } catch (e) {
      console.error('Failed to load assessment details:', e)
    }
  }

  async function deleteAssessment(id) {
    if (!confirm('Are you sure you want to delete this assessment? This action cannot be undone.')) {
      return
    }
    try {
      setDeleting(true)
      await apiFetch(`/api/assessment/${id}`, { method: 'DELETE' })
      await loadAssessments()
      if (selectedAssessment?._id === id) {
        setSelectedAssessment(null)
      }
    } catch (e) {
      alert('Failed to delete assessment: ' + (e.message || ''))
    } finally {
      setDeleting(false)
    }
  }

  async function publishAssessment(id) {
    try {
      setPublishing(true)
      await apiFetch(`/api/assessment/publish/${id}`, { method: 'POST' })
      await loadAssessments()
      if (selectedAssessment?._id === id) {
        await loadAssessmentDetails(id)
      }
    } catch (e) {
      alert('Failed to publish assessment: ' + (e.message || ''))
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">Assessment Management</h2>
              <p className="text-slate-600 dark:text-slate-400">Review, publish, and manage AI-generated assessments</p>
            </div>
            <button
              onClick={() => navigate('/instructor/assessment-generator')}
              className="btn-primary"
            >
              Generate New Assessment
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assessment List */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg bg-white dark:bg-slate-900">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">All Assessments</h3>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">Loading assessments...</p>
                  </div>
                ) : assessments.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    No assessments found. Generate one to get started!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {assessments.map(assessment => (
                      <div
                        key={assessment._id}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedAssessment?._id === assessment._id
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-500'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => loadAssessmentDetails(assessment._id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100">{assessment.title || assessment.topic}</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{assessment.topic}</p>
                          </div>
                          <span className={`badge ${
                            assessment.status === 'published' ? 'badge-success' : 'badge-warning'
                          } capitalize ml-2`}>
                            {assessment.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-2">
                          <span>{assessment.itemCount || assessment.linkedItemIds?.length || 0} items</span>
                          <span>{new Date(assessment.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          {assessment.status !== 'published' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                publishAssessment(assessment._id)
                              }}
                              disabled={publishing}
                              className="text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Publish
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteAssessment(assessment._id)
                            }}
                            disabled={deleting}
                            className="text-xs px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Assessment Preview */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg bg-white dark:bg-slate-900">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Preview</h3>
              </div>
              <div className="p-6 max-h-[600px] overflow-y-auto">
                {!selectedAssessment ? (
                  <div className="text-center text-slate-400 py-12">
                    Select an assessment from the list to preview
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                        {selectedAssessment.title || selectedAssessment.topic}
                      </h4>
                      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span>Topic: {selectedAssessment.topic}</span>
                        <span className={`badge ${
                          selectedAssessment.status === 'published' ? 'badge-success' : 'badge-warning'
                        } capitalize`}>
                          {selectedAssessment.status}
                        </span>
                        <span>{selectedAssessment.itemCount || selectedAssessment.linkedItemIds?.length || selectedAssessment.items?.length || 0} items</span>
                      </div>
                    </div>

                    {selectedAssessment.items && selectedAssessment.items.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Questions:</h5>
                        <div className="space-y-4">
                          {selectedAssessment.items.map((item, idx) => (
                            <div key={idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="badge badge-info capitalize">{item.type || 'mcq'}</span>
                                {item.difficulty && (
                                  <span className="text-xs text-slate-500">Difficulty: {item.difficulty}/5</span>
                                )}
                              </div>
                              <p className="font-medium text-slate-900 dark:text-slate-100 mb-2">{item.question}</p>
                              {item.choices && item.choices.length > 0 && (
                                <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 ml-4">
                                  {item.choices.map((choice, i) => (
                                    <li key={i}>{choice}</li>
                                  ))}
                                </ul>
                              )}
                              <div className="mt-2 text-xs text-slate-500">
                                <strong>Answer:</strong> {Array.isArray(item.answer) ? JSON.stringify(item.answer) : String(item.answer)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                      {selectedAssessment.status !== 'published' && (
                        <button
                          onClick={() => publishAssessment(selectedAssessment._id)}
                          disabled={publishing}
                          className="btn-primary"
                        >
                          {publishing ? 'Publishing...' : 'Publish Assessment'}
                        </button>
                      )}
                      <button
                        onClick={() => deleteAssessment(selectedAssessment._id)}
                        disabled={deleting}
                        className="btn-secondary"
                      >
                        {deleting ? 'Deleting...' : 'Delete Assessment'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </PageContainer>
      </main>
    </div>
  )
}

