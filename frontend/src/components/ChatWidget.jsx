import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { apiFetch } from '../api/client.js'
import { useChatHistory } from '../hooks/useChatHistory.js'

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef()
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
    if (open && messagesEndRef.current) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }, [currentMessages.length, open]) // Only depend on length, not full array

  // Throttled update function - only updates every 100ms during streaming
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

  const sendMessage = useCallback(async (e) => {
    e.preventDefault()
    if (!input.trim() || streaming) return
    const userMsg = { role: 'user', content: input }
    addMessage(userMsg)
    const messageText = input
    setInput('')

    setStreaming(true)
    setStreamingFlag(true)
    addMessage({ role: 'assistant', content: '' })
    lastUpdateTimeRef.current = Date.now()
    
    try {
      // Streaming fetch to backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(localStorage.token ? { Authorization: 'Bearer ' + localStorage.token } : {}) },
        body: JSON.stringify({ message: messageText, context: {} }),
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
      // Final update to ensure all content is saved
      updateLastMessage(text)
      setStreaming(false)
      setStreamingFlag(false)
    } catch (e) {
      setStreaming(false)
      setStreamingFlag(false)
      updateLastMessage('(AI failed to respond: ' + e.message + ')')
    }
  }, [input, streaming, addMessage, updateLastMessage, throttledUpdate, setStreamingFlag])

  // Escape key closes modal
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') setOpen(false) }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      <button
        className="fixed bottom-7 right-7 z-50 flex items-center gap-2 rounded-full bg-gradient-to-tr from-indigo-600 to-emerald-400 px-6 py-3 text-lg font-semibold text-white shadow-xl hover:scale-105 transition-all"
        onClick={() => setOpen(true)}
        aria-label="Open AI Tutor Chat"
      >
        <svg width="22" height="22" fill="none" viewBox="0 0 22 22"><circle cx="11" cy="11" r="11" fill="currentColor" className="text-emerald-300 opacity-25"/><path fill="currentColor" d="M16 7a5 5 0 1 1-2.048 9.597c-.241-.207-.46-.376-.741-.659l-.003-.001-1.225-1.304C8.892 13.42 7.708 11.78 8.09 10.044c.235-1.036.916-1.829 1.782-2.235C10.285 7.337 10.55 7.15 11 7.058c.199-.04.285-.044.397-.001C11.799 7.149 13.23 8.397 15 11.213V7Z"/></svg>
        AI Tutor
      </button>
      {open && (
      <div className="fixed inset-0 z-50 flex items-end justify-end">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={()=>setOpen(false)}></div>
        <div className="relative mb-7 mr-7 w-full max-w-lg overflow-hidden rounded-2xl bg-white/95 shadow-2xl ring-1 ring-slate-900/10 dark:bg-slate-900/95 dark:ring-slate-800 flex flex-col" style={{height: '600px'}}>
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">AI Tutor Chat</h3>
              <button
                onClick={startNewChat}
                className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
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
            <button className="text-slate-400 hover:text-rose-500 text-2xl leading-none" aria-label="Close chat" onClick={()=>setOpen(false)}>&times;</button>
          </div>
          
          {/* Chat History Sidebar */}
          {showHistory && (
            <div className="absolute left-0 top-14 bottom-14 w-64 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto z-10">
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
          
          <div className={`px-4 pt-4 pb-16 flex-1 overflow-y-auto flex flex-col gap-3 ${showHistory ? 'ml-64' : ''}`}>
            {currentMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-4 py-2 shadow ${m.role === 'user' ? 'bg-indigo-50 text-slate-900 dark:bg-indigo-900/30' : 'bg-emerald-50 text-emerald-900 dark:bg-slate-800/70'} text-base`}>
                  <MessageContent content={m.content} />
                  {streaming && i === currentMessages.length-1 && <Blink />}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef}></div>
          </div>
          <form className="absolute bottom-0 left-0 flex w-full gap-2 border-t border-slate-200 dark:border-slate-800 bg-white/80 p-2 dark:bg-slate-900/80" onSubmit={sendMessage}>
            <input
              className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-base shadow ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-slate-800 dark:ring-slate-700 dark:text-white"
              value={input}
              onChange={e=>setInput(e.target.value)}
              placeholder="Ask something..."
              disabled={streaming}
              autoFocus
            />
            <button className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow hover:brightness-105 focus:ring-2 focus:ring-indigo-400" disabled={streaming}>{streaming ? '...' : 'Send'}</button>
          </form>
        </div>
      </div>
      )}
    </>
  )
}

// Memoized message content to prevent unnecessary re-renders
const MessageContent = React.memo(function MessageContent({ content }) {
  // Memoize HTML processing
  const html = useMemo(() => {
    return content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-slate-200 dark:bg-slate-700 px-1 rounded">$1</code>')
      .replace(/\n/g, '<br />')
  }, [content])
  
  return <div dangerouslySetInnerHTML={{ __html: html }} />
})

function Blink() {
  const [on, setOn] = useState(true)
  useEffect(() => { const i = setInterval(()=>setOn(v=>!v), 500); return () => clearInterval(i) }, [])
  return <b className="inline-block w-2">{on ? "|" : " "}</b>
}
