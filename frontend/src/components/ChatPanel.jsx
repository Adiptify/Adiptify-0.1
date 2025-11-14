import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { apiFetch } from '../api/client.js'
import { useChatHistory } from '../hooks/useChatHistory.js'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const MessageContent = React.memo(function MessageContent({ content }) {
  const html = useMemo(() => {
    return content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-slate-200 dark:bg-slate-700 px-1 rounded">$1</code>')
      .replace(/\n/g, '<br />')
  }, [content])
  
  return <div dangerouslySetInnerHTML={{ __html: html }} />
})

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
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const scrollerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const chatRef = useRef(null)
  const updateThrottleRef = useRef(null)
  const lastUpdateTimeRef = useRef(0)
  const {
    chatHistory,
    currentMessages,
    setCurrentMessages,
    startNewChat,
    loadChat,
    deleteChat,
    addMessage,
    updateLastMessage,
    setStreaming: setStreamingFlag
  } = useChatHistory()

  useEffect(() => {
    if (scrollerRef.current) {
      requestAnimationFrame(() => {
        scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
      })
    }
  }, [currentMessages.length]) // Only depend on length

  useEffect(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }, [currentMessages.length]) // Only depend on length

  // Throttled update function
  const throttledUpdate = useCallback((text) => {
    const now = Date.now()
    if (now - lastUpdateTimeRef.current >= 100) {
      updateLastMessage(text)
      lastUpdateTimeRef.current = now
    } else {
      if (updateThrottleRef.current) {
        clearTimeout(updateThrottleRef.current)
      }
      updateThrottleRef.current = setTimeout(() => {
        updateLastMessage(text)
        lastUpdateTimeRef.current = Date.now()
      }, 100 - (now - lastUpdateTimeRef.current))
    }
  }, [updateLastMessage])

  const send = useCallback(async (text) => {
    const content = (text ?? input).trim()
    if (!content || sending) return
    const userMsg = { role: 'user', content }
    addMessage(userMsg)
    setInput('')
    setSending(true)
    setStreaming(true)
    setStreamingFlag(true)

    addMessage({ role: 'assistant', content: '' })
    lastUpdateTimeRef.current = Date.now()

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
        throttledUpdate(text)
      }
      // Final update
      updateLastMessage(text)
    } catch (e) {
      updateLastMessage('Sorry, something went wrong: ' + (e.message || 'Unknown error'))
    } finally {
      setSending(false)
      setStreaming(false)
      setStreamingFlag(false)
    }
  }, [input, sending, addMessage, updateLastMessage, throttledUpdate, setStreamingFlag])

  async function handleDownloadPdf() {
    if (!chatRef.current) return
    try {
      const canvas = await html2canvas(chatRef.current, { backgroundColor: '#fff', useCORS: true })
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const imgWidth = pageWidth - 60
      const imgHeight = canvas.height * imgWidth / canvas.width
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 30, 40, imgWidth, imgHeight)
      pdf.save('chat_transcript.pdf')
    } catch (e) {
      console.error('Failed to generate PDF:', e)
    }
  }

  return (
    <div className="relative flex h-[600px] flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="font-semibold text-lg">AI Tutor Chat</h3>
            <p className="text-xs text-slate-500">Context-aware assistance based on your learning progress</p>
          </div>
          <button
            onClick={startNewChat}
            className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50 ml-2"
            title="Start New Chat"
          >
            + New
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
            title="Chat History"
          >
            📚
          </button>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => downloadChatMarkdown(currentMessages)}
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
      
      {/* Chat History Sidebar */}
      {showHistory && (
        <div className="absolute left-0 top-20 bottom-20 w-64 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto z-10">
          <div className="p-3">
            <h4 className="font-semibold text-sm mb-2">Chat History</h4>
            <div className="space-y-1">
              {chatHistory.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 p-2">No past chats</p>
              ) : (
                chatHistory.map(chat => (
                  <div
                    key={chat.id}
                    className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer group flex items-center justify-between"
                    onClick={() => {
                      loadChat(chat.id)
                      setShowHistory(false)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {chat.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteChat(chat.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <div ref={chatRef} className={`flex-1 overflow-y-auto p-4 space-y-3 ${showHistory ? 'ml-64' : ''}`}>
        {currentMessages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm shadow ${
              m.role === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
            }`}>
              <MessageContent content={m.content} />
              {streaming && i === currentMessages.length - 1 && (
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

