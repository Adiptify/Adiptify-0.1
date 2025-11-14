import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

// Get user-specific storage keys
const getStorageKeys = (userId) => {
  if (!userId) {
    return {
      chatHistory: 'adiptify_chat_history',
      currentChat: 'adiptify_current_chat'
    }
  }
  return {
    chatHistory: `adiptify_chat_history_${userId}`,
    currentChat: `adiptify_current_chat_${userId}`
  }
}

// Debounce function to limit localStorage writes
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export function useChatHistory() {
  const { user } = useAuth()
  const userId = user?._id || user?.id
  const storageKeys = getStorageKeys(userId)
  
  const [chatHistory, setChatHistory] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [currentMessages, setCurrentMessages] = useState([
    { role: 'assistant', content: '👋 I am your AI Tutor! Ask me about quizzes, results, or anything learning-related.' }
  ])
  const saveTimeoutRef = useRef(null)
  const isStreamingRef = useRef(false)

  // Load chat history from localStorage on mount (user-specific)
  useEffect(() => {
    if (!userId) {
      // If no user, clear history
      setChatHistory([])
      setCurrentChatId(null)
      return
    }
    
    try {
      const saved = localStorage.getItem(storageKeys.chatHistory)
      if (saved) {
        const parsed = JSON.parse(saved)
        setChatHistory(Array.isArray(parsed) ? parsed : [])
      }
      
      const currentId = localStorage.getItem(storageKeys.currentChat)
      if (currentId) {
        const saved = localStorage.getItem(storageKeys.chatHistory)
        if (saved) {
          const parsed = JSON.parse(saved)
          const chat = parsed?.find(c => c.id === currentId)
          if (chat) {
            setCurrentChatId(currentId)
            setCurrentMessages(chat.messages || [])
          }
        }
      }
    } catch (e) {
      console.error('Failed to load chat history:', e)
    }
  }, [userId, storageKeys.chatHistory, storageKeys.currentChat])

  // Debounced save function - only saves after 1 second of inactivity
  const saveToStorage = useCallback(() => {
    if (!userId) return // Don't save if no user
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (currentChatId && currentMessages.length > 1) {
        try {
          const saved = localStorage.getItem(storageKeys.chatHistory)
          const history = saved ? JSON.parse(saved) : []
          const chatIndex = history.findIndex(c => c.id === currentChatId)
          const chatData = {
            id: currentChatId,
            messages: currentMessages,
            updatedAt: new Date().toISOString(),
            title: currentMessages.find(m => m.role === 'user')?.content?.substring(0, 50) || 'New Chat'
          }
          
          if (chatIndex >= 0) {
            history[chatIndex] = chatData
          } else {
            history.push(chatData)
          }
          
          // Sort by updatedAt, most recent first
          history.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          
          localStorage.setItem(storageKeys.chatHistory, JSON.stringify(history))
          localStorage.setItem(storageKeys.currentChat, currentChatId)
          setChatHistory(history)
        } catch (e) {
          console.error('Failed to save chat:', e)
        }
      }
    }, isStreamingRef.current ? 2000 : 1000) // Longer delay during streaming
  }, [currentMessages, currentChatId, userId, storageKeys.chatHistory, storageKeys.currentChat])

  // Save to localStorage with debounce (only when not streaming or after streaming ends)
  useEffect(() => {
    if (currentChatId && currentMessages.length > 1) {
      saveToStorage()
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [currentMessages, currentChatId, saveToStorage])

  const startNewChat = () => {
    if (!userId) return
    const newId = `chat_${Date.now()}`
    setCurrentChatId(newId)
    setCurrentMessages([
      { role: 'assistant', content: '👋 I am your AI Tutor! Ask me about quizzes, results, or anything learning-related.' }
    ])
    localStorage.setItem(storageKeys.currentChat, newId)
  }

  const loadChat = (chatId) => {
    if (!userId) return
    try {
      const saved = localStorage.getItem(storageKeys.chatHistory)
      if (saved) {
        const parsed = JSON.parse(saved)
        const chat = parsed?.find(c => c.id === chatId)
        if (chat) {
          setCurrentChatId(chatId)
          setCurrentMessages(chat.messages || [])
          localStorage.setItem(storageKeys.currentChat, chatId)
        }
      }
    } catch (e) {
      console.error('Failed to load chat:', e)
    }
  }

  const deleteChat = (chatId) => {
    if (!userId) return
    try {
      const saved = localStorage.getItem(storageKeys.chatHistory)
      if (saved) {
        const parsed = JSON.parse(saved)
        const filtered = parsed.filter(c => c.id !== chatId)
        localStorage.setItem(storageKeys.chatHistory, JSON.stringify(filtered))
        setChatHistory(filtered)
        
        if (currentChatId === chatId) {
          startNewChat()
        }
      }
    } catch (e) {
      console.error('Failed to delete chat:', e)
    }
  }

  const addMessage = useCallback((message) => {
    if (!userId) return
    setCurrentMessages(prev => {
      if (!currentChatId) {
        const newId = `chat_${Date.now()}`
        setCurrentChatId(newId)
        localStorage.setItem(storageKeys.currentChat, newId)
      }
      return [...prev, message]
    })
  }, [currentChatId, userId, storageKeys.currentChat])

  // Throttled update for streaming - only updates every 100ms
  const updateLastMessage = useCallback((content) => {
    setCurrentMessages(prev => {
      const updated = [...prev]
      if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], content }
      }
      return updated
    })
  }, [])

  const setStreaming = useCallback((streaming) => {
    isStreamingRef.current = streaming
  }, [])

  return {
    chatHistory,
    currentChatId,
    currentMessages,
    setCurrentMessages,
    startNewChat,
    loadChat,
    deleteChat,
    addMessage,
    updateLastMessage,
    setStreaming
  }
}

