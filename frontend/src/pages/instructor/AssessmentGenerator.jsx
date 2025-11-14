import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { apiFetch } from '../../api/client.js'

export default function AssessmentGenerator() {
  const [topic, setTopic] = useState('')
  const [questionCount, setQuestionCount] = useState(6)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  async function handleGenerate() {
    if (!topic.trim()) {
      setError('Please enter a topic')
      return
    }

    try {
      setError('')
      setSuccess('')
      setGenerating(true)
      const result = await apiFetch('/api/assessment/generate', {
        method: 'POST',
        body: {
          topic: topic.trim(),
          questionCount: parseInt(questionCount) || 6
        }
      })
      setSuccess(`Assessment generated successfully! Assessment ID: ${result.assessmentId || result.assessment?._id}. You can review and publish it in the Assessment Review page.`)
      setTopic('')
      setTimeout(() => {
        navigate('/instructor/assessment-review')
      }, 2000)
    } catch (e) {
      setError('Failed to generate assessment: ' + (e.message || ''))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">AI Assessment Generator</h2>
            <p className="text-slate-600 dark:text-slate-400">Generate assessments with multiple question types using AI</p>
          </div>

          <div className="max-w-2xl">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg bg-white dark:bg-slate-900 p-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                    Topic *
                  </label>
                  <input
                    type="text"
                    className="input-field focus-ring w-full"
                    placeholder="e.g., Machine Learning, Algebra, World History"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    disabled={generating}
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    The AI will generate questions covering this topic
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                    Number of Questions
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="20"
                    className="input-field focus-ring w-full"
                    value={questionCount}
                    onChange={e => setQuestionCount(parseInt(e.target.value) || 6)}
                    disabled={generating}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    The AI will generate a mix of question types: MCQ, Fill-in-the-blank, Short Answer, Match, and Reorder
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-red-700 dark:text-red-400">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-green-700 dark:text-green-400">
                    {success}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !topic.trim()}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        Generate Assessment
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => navigate('/instructor/assessment-review')}
                    className="btn-secondary"
                  >
                    View All Assessments
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-6">
              <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">How it works:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-indigo-800 dark:text-indigo-200">
                <li>AI generates questions using DeepSeek-v3.1 model</li>
                <li>Questions include multiple types: MCQ, Fill-in-the-blank, Short Answer, Match, and Reorder</li>
                <li>Each question is validated and assigned appropriate grading methods</li>
                <li>Generated assessments start as "draft" - review and publish them in the Assessment Review page</li>
              </ul>
            </div>
          </div>
        </PageContainer>
      </main>
    </div>
  )
}

