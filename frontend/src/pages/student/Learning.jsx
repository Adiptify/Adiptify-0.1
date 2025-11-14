import { useEffect, useState, useRef } from 'react'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { apiFetch } from '../../api/client.js'
import ReactMarkdown from 'react-markdown'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function downloadMarkdown(filename, md) {
  const blob = new Blob([md], { type: 'text/markdown' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  setTimeout(() => { document.body.removeChild(link) }, 100)
}

export default function Learning() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [moduleContent, setModuleContent] = useState(null)
  const [loadingModule, setLoadingModule] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [allSubjects, setAllSubjects] = useState([])
  const moduleRef = useRef(null)

  async function reloadTopics() {
    setLoading(true)
    try {
      const me = await apiFetch('/api/auth/me')
      const topicMap = me.learnerProfile?.topics || {}
      const masteryObj = topicMap instanceof Map ? Object.fromEntries(topicMap) : (typeof topicMap === 'object' ? topicMap : {})
          setTopics(Object.keys(masteryObj).map(topic => {
            // Handle both old (0-1) and new (0-100) formats
            let masteryPercent = masteryObj[topic]?.mastery || 0;
            if (masteryPercent < 1 && masteryPercent > 0) {
              masteryPercent = Math.round(masteryPercent * 100); // Old format: convert to percentage
            } else {
              masteryPercent = Math.round(masteryPercent); // New format: already percentage
            }
            return {
              name: topic,
              mastery: masteryPercent,
              attempts: masteryObj[topic]?.attempts || 0,
              streak: masteryObj[topic]?.streak || 0
            }
          }))
    } catch (e) {
      setAddError('Failed to load subjects')
    } finally {
      setLoading(false)
    }
  }

  async function reloadAllSubjects() {
    try {
      const subs = await apiFetch('/api/learning/subjects')
      setAllSubjects(Array.isArray(subs) ? subs : [])
    } catch (e) {}
  }

  useEffect(() => {
    reloadTopics()
    reloadAllSubjects()
  }, [])

  async function handleAddSubject(e) {
    if (e && e.preventDefault) e.preventDefault()
    const subject = newSubject.trim()
    setAddError(''); 
    if (!subject) {
      setAddError('Type a subject to add!')
      return
    }
    if (topics.some(t => t.name.toLowerCase() === subject.toLowerCase())) {
      setAddError('Subject already exists!')
      return
    }
    setAdding(true)
    setAddError('')
    try {
      await apiFetch('/api/learning/subject', { method: 'POST', body: { subject } })
      setNewSubject('')
      await reloadTopics()
      await reloadAllSubjects()
      setAddError('') // Clear any previous errors
    } catch (e) {
      console.error('Error adding subject:', e)
      setAddError('Failed to add subject: ' + (e.message || 'Unknown error. Please try again.'))
    } finally {
      setAdding(false)
    }
  }

  async function handleAddFromBrowse(sub) {
    if (topics.some(t => t.name.toLowerCase() === sub.toLowerCase()) || adding) return
    setNewSubject(sub)
    await handleAddSubject()
  }

  async function loadModule(topicName) {
    setLoadingModule(true)
    setSelectedTopic(topicName)
    try {
      const module = await apiFetch(`/api/learning/module/${encodeURIComponent(topicName)}`)
      setModuleContent(module)
    } catch (e) {
      setModuleContent({ content: `# ${topicName}\n\nError loading learning module. Please try again later.`, resources: [] })
    } finally {
      setLoadingModule(false)
    }
  }

  async function handleDownloadPdf() {
    if (!moduleRef.current) return
    const canvas = await html2canvas(moduleRef.current, { backgroundColor: '#fff', useCORS: true })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
    // Resize image to fit page, maintain aspect
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth - 60
    const imgHeight = canvas.height * imgWidth / canvas.width
    pdf.addImage(imgData, 'PNG', 30, 40, imgWidth, imgHeight)
    pdf.save(`${selectedTopic.replace(/\s+/g,'_')}_notes.pdf`)
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <h2 className="mb-6 text-3xl font-semibold">Learning Modules</h2>

          {!selectedTopic && (
            <form onSubmit={handleAddSubject} className="flex items-center gap-3 mb-5">
              <input
                type="text"
                className="flex-1 rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                placeholder="Add subject (e.g. Biology, Algebra)"
                value={newSubject}
                onChange={e => { setNewSubject(e.target.value); setAddError('') }}
                disabled={adding}
              />
              <button type="submit" disabled={adding || !newSubject.trim()} className="rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed">
                {adding ? 'Adding...' : 'Add Subject'}
              </button>
            </form>
          )}
          {addError && <div className="mb-5 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 px-3 py-1 rounded">{addError}</div>}

          {/* BROWSE SUBJECTS SECTION */}
          {!selectedTopic && allSubjects.length > 0 && (
            <section className="mb-6">
              <h3 className="font-semibold mb-2">
                Browse Subjects ({allSubjects.length} available)
                {topics.length > 0 && (
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
                    ({topics.length} already added)
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                {allSubjects.sort().map(sub => {
                  const isAlreadyAdded = topics.some(t => t.name.toLowerCase() === sub.toLowerCase())
                  return (
                    <button
                      key={sub}
                      onClick={() => !isAlreadyAdded && !adding && handleAddFromBrowse(sub)}
                      className={`px-3 py-1 rounded-xl border text-sm transition-all ${
                        isAlreadyAdded 
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed' 
                          : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-800 cursor-pointer'
                      } ${adding ? 'opacity-50 cursor-wait' : ''}`}
                      disabled={isAlreadyAdded || adding}
                      title={isAlreadyAdded ? 'Already added' : 'Click to add'}
                    >
                      {sub} {isAlreadyAdded && '✓'}
                    </button>
                  )
                })}
              </div>
              {allSubjects.filter(sub => !topics.some(t => t.name.toLowerCase() === sub.toLowerCase())).length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  All available subjects have been added. You can add new subjects using the input field above.
                </p>
              )}
            </section>
          )}

          {!selectedTopic ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {topics.map(topic => (
                <div key={topic.name} className="rounded-xl border border-slate-200 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-2 text-lg font-semibold">{topic.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div>Mastery: <span className="font-bold">{topic.mastery}%</span></div>
                    <div>Attempts: {topic.attempts}</div>
                    <div>Streak: {topic.streak}</div>
                    <button
                      onClick={() => loadModule(topic.name)}
                      className="mt-3 w-full rounded bg-indigo-600 px-4 py-2 text-white hover:brightness-105"
                    >
                      Load Learning Module
                    </button>
                  </div>
                </div>
              ))}
              {!loading && topics.length === 0 && <div className="col-span-full text-center text-slate-400 py-12">No learning topics yet. Start a quiz or add one above!</div>}
            </div>
          ) : (
            <div>
              <button
                onClick={() => { setSelectedTopic(null); setModuleContent(null) }}
                className="mb-4 rounded bg-slate-200 px-4 py-2 text-sm hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                ← Back to Topics
              </button>
              {loadingModule ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">Loading learning module...</p>
                </div>
              ) : moduleContent ? (
                <div className="rounded-xl border border-slate-200 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900" ref={moduleRef}>
                  {moduleContent.mainUrl && (
                    <a href={moduleContent.mainUrl} target="_blank" rel="noopener noreferrer" className="block mb-2 text-indigo-700 dark:text-indigo-300 underline font-medium">Read Original on GeeksforGeeks</a>
                  )}
                  <div className="prose dark:prose-invert max-w-none">
                    <ReactMarkdown>{moduleContent.content}</ReactMarkdown>
                  </div>
                  <div className='flex gap-3 mt-5'>
                    <button
                      className="rounded bg-emerald-600 px-4 py-2 text-white font-semibold hover:brightness-105"
                      onClick={() => downloadMarkdown(`${selectedTopic.replace(/\s+/g,'_')}_notes.md`, moduleContent.content)}
                    >
                      Download Notes (.md)
                    </button>
                    <button
                      className="rounded bg-indigo-700 px-4 py-2 text-white font-semibold hover:brightness-110"
                      onClick={handleDownloadPdf}
                    >
                      Download as PDF
                    </button>
                  </div>
                  {moduleContent.resources && moduleContent.resources.length > 0 && (
                    <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <h3 className="mb-2 font-semibold">Additional Resources</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {moduleContent.resources.map((r, i) => (
                          <li key={i}>
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">
                              {r.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </PageContainer>
      </main>
    </div>
  )
}

