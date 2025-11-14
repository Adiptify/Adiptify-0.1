import { useEffect, useState } from 'react'
import { apiFetch } from '../../api/client.js'

export default function QuestionBank() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filters, setFilters] = useState({ topic: '', type: '', difficulty: '' })
  const [showModal, setShowModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [formData, setFormData] = useState({
    type: 'mcq',
    question: '',
    choices: ['', '', '', ''],
    answer: '',
    explanation: '',
    difficulty: 2,
    bloom: 'remember',
    topics: [],
    hints: [],
  })

  useEffect(() => {
    loadQuestions()
  }, [filters])

  async function loadQuestions() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.topic) params.append('topic', filters.topic)
      if (filters.type) params.append('type', filters.type)
      if (filters.difficulty) params.append('difficulty', filters.difficulty)
      params.append('limit', '100')
      
      const data = await apiFetch(`/api/question-bank?${params}`)
      setQuestions(data.items || [])
    } catch (e) {
      setError('Failed to load questions: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    try {
      const payload = {
        ...formData,
        choices: formData.type === 'mcq' ? formData.choices.filter(c => c.trim()) : [],
        topics: Array.isArray(formData.topics) ? formData.topics : formData.topics.split(',').map(t => t.trim()).filter(Boolean),
      }
      
      if (editingQuestion) {
        await apiFetch(`/api/question-bank/${editingQuestion._id}`, {
          method: 'PUT',
          body: payload,
        })
        setSuccess('Question updated successfully!')
      } else {
        await apiFetch('/api/question-bank', {
          method: 'POST',
          body: payload,
        })
        setSuccess('Question created successfully!')
      }
      
      setShowModal(false)
      setEditingQuestion(null)
      resetForm()
      loadQuestions()
    } catch (e) {
      setError('Failed to save question: ' + (e.message || ''))
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this question?')) return
    
    try {
      await apiFetch(`/api/question-bank/${id}`, { method: 'DELETE' })
      setSuccess('Question deleted successfully!')
      loadQuestions()
    } catch (e) {
      setError('Failed to delete question: ' + (e.message || ''))
    }
  }

  function resetForm() {
    setFormData({
      type: 'mcq',
      question: '',
      choices: ['', '', '', ''],
      answer: '',
      explanation: '',
      difficulty: 2,
      bloom: 'remember',
      topics: [],
      hints: [],
    })
  }

  function openEditModal(question) {
    setEditingQuestion(question)
    setFormData({
      type: question.type,
      question: question.question,
      choices: question.choices || ['', '', '', ''],
      answer: question.answer,
      explanation: question.explanation || '',
      difficulty: question.difficulty || 2,
      bloom: question.bloom || 'remember',
      topics: question.topics || [],
      hints: question.hints || [],
    })
    setShowModal(true)
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Question Bank</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">Manage questions for assessments</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingQuestion(null); setShowModal(true); }}
          className="btn-primary text-lg px-6 py-3"
        >
          + Add Question
        </button>
      </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-green-700 dark:text-green-400">
              {success}
            </div>
          )}

          <div className="mb-6 flex gap-4 flex-wrap">
            <input
              type="text"
              placeholder="Filter by topic..."
              className="input-field flex-1 min-w-[200px]"
              value={filters.topic}
              onChange={e => setFilters({ ...filters, topic: e.target.value })}
            />
            <select
              className="input-field"
              value={filters.type}
              onChange={e => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">All Types</option>
              <option value="mcq">MCQ</option>
              <option value="fill_blank">Fill in Blank</option>
              <option value="short_answer">Short Answer</option>
              <option value="match">Match</option>
              <option value="reorder">Reorder</option>
            </select>
            <select
              className="input-field"
              value={filters.difficulty}
              onChange={e => setFilters({ ...filters, difficulty: e.target.value })}
            >
              <option value="">All Difficulties</option>
              <option value="1">Easy (1)</option>
              <option value="2">Medium (2)</option>
              <option value="3">Hard (3)</option>
              <option value="4">Very Hard (4)</option>
              <option value="5">Expert (5)</option>
            </select>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">Loading questions...</p>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-indigo-500 to-blue-500 dark:from-indigo-700 dark:to-blue-700">
                    <tr>
                      <th className="p-4 font-bold text-left text-white">Type</th>
                      <th className="p-4 font-bold text-left text-white">Question</th>
                      <th className="p-4 font-bold text-left text-white">Topics</th>
                      <th className="p-4 font-bold text-left text-white">Difficulty</th>
                      <th className="p-4 font-bold text-left text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map(q => (
                      <tr key={q._id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-4">
                          <span className="badge badge-info capitalize">{q.type}</span>
                        </td>
                        <td className="p-4 font-medium text-slate-900 dark:text-slate-100 max-w-md truncate">
                          {q.question}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {(q.topics || []).slice(0, 2).map(t => (
                              <span key={t} className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-bold">{q.difficulty || 2}/5</span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditModal(q)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(q._id)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {questions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-500 dark:text-slate-400">
                          No questions found. Create your first question!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowModal(false); setEditingQuestion(null); resetForm(); }}
            >
              <div
                className="rounded-2xl bg-white dark:bg-slate-900 p-8 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                  {editingQuestion ? 'Edit Question' : 'Add New Question'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Type *</label>
                    <select
                      className="input-field w-full"
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value })}
                      required
                    >
                      <option value="mcq">MCQ</option>
                      <option value="fill_blank">Fill in Blank</option>
                      <option value="short_answer">Short Answer</option>
                      <option value="match">Match</option>
                      <option value="reorder">Reorder</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Question *</label>
                    <textarea
                      className="input-field w-full min-h-[100px]"
                      value={formData.question}
                      onChange={e => setFormData({ ...formData, question: e.target.value })}
                      required
                    />
                  </div>
                  {formData.type === 'mcq' && (
                    <div>
                      <label className="block text-sm font-semibold mb-2">Choices *</label>
                      {formData.choices.map((choice, idx) => (
                        <input
                          key={idx}
                          className="input-field w-full mb-2"
                          value={choice}
                          onChange={e => {
                            const newChoices = [...formData.choices]
                            newChoices[idx] = e.target.value
                            setFormData({ ...formData, choices: newChoices })
                          }}
                          placeholder={`Choice ${idx + 1}`}
                          required
                        />
                      ))}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold mb-2">Answer *</label>
                    <input
                      className="input-field w-full"
                      value={formData.answer}
                      onChange={e => setFormData({ ...formData, answer: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Explanation</label>
                    <textarea
                      className="input-field w-full min-h-[80px]"
                      value={formData.explanation}
                      onChange={e => setFormData({ ...formData, explanation: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Difficulty (1-5)</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        className="input-field w-full"
                        value={formData.difficulty}
                        onChange={e => setFormData({ ...formData, difficulty: parseInt(e.target.value) || 2 })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">Bloom Level</label>
                      <select
                        className="input-field w-full"
                        value={formData.bloom}
                        onChange={e => setFormData({ ...formData, bloom: e.target.value })}
                      >
                        <option value="remember">Remember</option>
                        <option value="understand">Understand</option>
                        <option value="apply">Apply</option>
                        <option value="analyze">Analyze</option>
                        <option value="evaluate">Evaluate</option>
                        <option value="create">Create</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Topics (comma-separated)</label>
                    <input
                      className="input-field w-full"
                      value={Array.isArray(formData.topics) ? formData.topics.join(', ') : formData.topics}
                      onChange={e => setFormData({ ...formData, topics: e.target.value })}
                      placeholder="e.g., Machine Learning, Algebra"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="submit" className="btn-primary flex-1">
                      {editingQuestion ? 'Update Question' : 'Create Question'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => { setShowModal(false); setEditingQuestion(null); resetForm(); }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
    </div>
  )
}

