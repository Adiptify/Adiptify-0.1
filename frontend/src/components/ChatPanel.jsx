import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client.js'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function MessageContent({ content }) {
  let html = content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-slate-200 dark:bg-slate-700 px-1 rounded">$1</code>')
    .replace(/\n/g, '<br />')
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

function downloadChatMarkdown(messages) {
  let md = '# Chat Transcript\n\n'
  messages.forEach((m) => {
    if (m.role === 'user') md += `**You:** ${m.content}\n\n`
    else if (m.role === 'assistant') md += `**AI:** ${m.content}\n\n`
    else if (m.role === 'system') md += `> _${m.content}_\n\n`
  })
  const blob = new Blob([md], { type: 'text/markdown' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'chat_transcript.md'
  document.body.appendChild(link)
  link.click()
  setTimeout(() => { document.body.removeChild(link) }, 100)
}

export default function ChatPanel({ initialSystemContext = '', initialUserPrompt = '' }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 I am your AI Tutor! I know about your quiz performance and mastery. Ask me anything about your learning!' }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const scrollerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const chatRef = useRef(null)

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || sending) return
    const userMsg = { role: 'user', content }
    setMessages(msgs => [...msgs, userMsg])
    setInput('')
    setSending(true)
    setStreaming(true)

    let assistantMsg = { role: 'assistant', content: '' }
    setMessages(msgs => [...msgs, assistantMsg])

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ message: content, context: {} }),
      })

      if (!response.body) throw new Error('No stream from backend')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let text = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        assistantMsg.content = text
        setMessages(msgs => {
          const arr = [...msgs]
          arr[arr.length - 1] = { ...assistantMsg }
          return arr
        })
      }
    } catch (e) {
      assistantMsg.content = 'Sorry, something went wrong: ' + (e.message || 'Unknown error')
      setMessages(msgs => {
        const arr = [...msgs]
        arr[arr.length - 1] = { ...assistantMsg }
        return arr
      })
    } finally {
      setSending(false)
      setStreaming(false)
    }
  }

  async function handleDownloadPdf() {
    if (!chatRef.current) return
    const canvas = await html2canvas(chatRef.current, { backgroundColor: '#fff', useCORS: true })
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const imgWidth = pageWidth - 60
    const imgHeight = canvas.height * imgWidth / canvas.width
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 30, 40, imgWidth, imgHeight)
    pdf.save('chat_transcript.pdf')
  }

  return (
    <div className="flex h-[600px] flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">AI Tutor Chat</h3>
          <p className="text-xs text-slate-500">Context-aware assistance based on your learning progress</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => downloadChatMarkdown(messages)}
            className="rounded bg-emerald-500 px-3 py-1 text-xs text-white font-semibold hover:brightness-105"
          >
            Download Chat
          </button>
          <button
            onClick={handleDownloadPdf}
            className="rounded bg-indigo-600 px-3 py-1 text-xs text-white font-semibold hover:brightness-105"
          >Download PDF</button>
        </div>
      </div>
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm shadow ${
              m.role === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
            }`}>
              <MessageContent content={m.content} />
              {streaming && i === messages.length - 1 && (
                <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-1">|</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef}></div>
      </div>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Ask a question about your quizzes, mastery, or topics..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            disabled={sending}
          />
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 transition"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

