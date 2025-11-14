import { useState } from 'react'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { apiFetch } from '../../api/client.js'

export default function BulkUpload() {
  const [uploadType, setUploadType] = useState('items') // 'items', 'assessments', 'subject', 'bulk'
  const [jsonInput, setJsonInput] = useState('')
  const [subject, setSubject] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const exampleItems = {
    items: `{
  "source": "semester1_import",
  "items": [
    {
      "type": "mcq",
      "question": "What is the output of 2 + 2?",
      "choices": ["3", "4", "5", "22"],
      "answer": "4",
      "difficulty": 1,
      "bloom": "remember",
      "topics": ["arithmetic/basic"]
    },
    {
      "type": "short_answer",
      "question": "Explain polymorphism in OOP.",
      "answer": "Ability of objects to take many forms",
      "difficulty": 3,
      "bloom": "understand",
      "topics": ["programming/oop"]
    }
  ]
}`,
    assessments: `{
  "source": "semester1_assessments",
  "assessments": [
    {
      "topic": "JavaScript Basics",
      "status": "published",
      "items": [
        {
          "type": "mcq",
          "question": "What is a closure?",
          "choices": ["A function", "A variable", "A loop", "A keyword"],
          "answer": "A function",
          "difficulty": 3,
          "bloom": "understand",
          "topics": ["javascript"]
        }
      ]
    }
  ]
}`,
    subject: `{
  "subject": "Machine Learning",
  "items": [
    {
      "type": "mcq",
      "question": "What is supervised learning?",
      "choices": ["Learning with labels", "Learning without labels", "Reinforcement", "None"],
      "answer": "Learning with labels",
      "difficulty": 2,
      "bloom": "remember",
      "topics": ["machine_learning"]
    }
  ],
  "assessments": [
    {
      "status": "draft",
      "items": [
        {
          "type": "short_answer",
          "question": "Explain neural networks.",
          "answer": "Computational models inspired by biological neural networks",
          "difficulty": 3,
          "bloom": "understand",
          "topics": ["neural_networks"]
        }
      ]
    }
  ]
}`,
    bulk: `{
  "items": [
    {
      "type": "mcq",
      "question": "Sample question?",
      "choices": ["A", "B", "C"],
      "answer": "A",
      "difficulty": 1,
      "bloom": "remember",
      "topics": ["sample"]
    }
  ],
  "assessments": [
    {
      "topic": "Sample Topic",
      "status": "draft",
      "items": [
        {
          "type": "mcq",
          "question": "Quiz question?",
          "choices": ["A", "B"],
          "answer": "A",
          "difficulty": 2,
          "bloom": "understand",
          "topics": ["sample"]
        }
      ]
    }
  ],
  "users": [
    {
      "name": "Test Student",
      "email": "test@example.com",
      "password": "password123",
      "role": "student",
      "studentId": "TEST001"
    }
  ]
}`
  }

  async function handleUpload() {
    if (!jsonInput.trim()) {
      setError('Please paste JSON data')
      return
    }

    setUploading(true)
    setError('')
    setResult(null)

    try {
      const data = JSON.parse(jsonInput)
      let endpoint = ''
      let body = {}

      if (uploadType === 'items') {
        endpoint = '/api/admin/import/items'
        body = data
      } else if (uploadType === 'quizzes') {
        endpoint = '/api/admin/import/assessments'
        body = data
      } else if (uploadType === 'subject') {
        if (!subject.trim()) {
          setError('Subject name is required for subject-based upload')
          setUploading(false)
          return
        }
        endpoint = '/api/admin/import/subject'
        body = { subject: subject.trim(), ...data }
      } else if (uploadType === 'bulk') {
        endpoint = '/api/admin/import/bulk'
        body = data
      }

      const response = await apiFetch(endpoint, {
        method: 'POST',
        body
      })

      setResult(response)
      setJsonInput('') // Clear input on success
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError('Invalid JSON format: ' + e.message)
      } else {
        setError('Upload failed: ' + (e.message || ''))
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <h2 className="mb-6 text-3xl font-semibold">Bulk Upload</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Upload Type</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setUploadType('items')}
                className={`rounded px-4 py-2 ${uploadType === 'items' ? 'bg-indigo-600 text-white' : 'border hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                Items (Questions)
              </button>
              <button
                onClick={() => setUploadType('quizzes')}
                className={`rounded px-4 py-2 ${uploadType === 'quizzes' ? 'bg-indigo-600 text-white' : 'border hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                Assessments
              </button>
              <button
                onClick={() => setUploadType('subject')}
                className={`rounded px-4 py-2 ${uploadType === 'subject' ? 'bg-indigo-600 text-white' : 'border hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                By Subject
              </button>
              <button
                onClick={() => setUploadType('bulk')}
                className={`rounded px-4 py-2 ${uploadType === 'bulk' ? 'bg-indigo-600 text-white' : 'border hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                Bulk (All Types)
              </button>
            </div>
          </div>

          {uploadType === 'subject' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Subject Name *</label>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                placeholder="e.g., Machine Learning, JavaScript, Algebra"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>
          )}

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">JSON Data</label>
              <button
                onClick={() => setJsonInput(exampleItems[uploadType] || '')}
                className="text-xs text-indigo-600 hover:underline"
              >
                Load Example
              </button>
            </div>
            <textarea
              className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent font-mono text-sm"
              rows={15}
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              placeholder="Paste JSON data here..."
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {result && (
            <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
              <h3 className="font-semibold mb-2">Upload Results</h3>
              {result.summary ? (
                <div className="space-y-2 text-sm">
                  {result.summary.items && (
                    <div>
                      <strong>Items:</strong> {result.summary.items.inserted} inserted, {result.summary.items.failed} failed
                    </div>
                  )}
                  {result.summary.quizzes && (
                    <div>
                      <strong>Assessments:</strong> {result.summary.quizzes.inserted} inserted, {result.summary.quizzes.failed} failed
                    </div>
                  )}
                  {result.summary.users && (
                    <div>
                      <strong>Users:</strong> {result.summary.users.inserted} inserted, {result.summary.users.failed} failed
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm">
                  <strong>Inserted:</strong> {result.inserted}, <strong>Failed:</strong> {result.failed}
                </div>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-3 text-sm">
                  <strong>Errors:</strong>
                  <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(result.errors, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !jsonInput.trim()}
            className="rounded bg-indigo-600 px-6 py-3 text-white hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {uploading ? 'Uploading...' : 'Upload'}
          </button>

          <div className="mt-8 rounded-xl border border-slate-200 p-6 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
            <h3 className="font-semibold mb-2">Documentation</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              See <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">BULK_UPLOAD_GUIDE.md</code> for complete JSON format examples.
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
              <li><strong>Items:</strong> Import individual questions (MCQ, Fill-in, Short Answer, Match, Reorder)</li>
              <li><strong>Assessments:</strong> Import complete assessment packs with nested items</li>
              <li><strong>By Subject:</strong> Import items and assessments for a specific subject (auto-tags with subject)</li>
              <li><strong>Bulk:</strong> Import items, assessments, and users in one request (Admin only)</li>
            </ul>
          </div>
        </PageContainer>
      </main>
    </div>
  )
}

