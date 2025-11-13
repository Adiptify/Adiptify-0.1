import { useEffect, useState } from 'react'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import ChatPanel from '../../components/ChatPanel.jsx'
import { apiFetch } from '../../api/client.js'

export default function Chat() {
  const [mastery, setMastery] = useState({})

  useEffect(() => {
    async function load() {
      try {
        const me = await apiFetch('/api/auth/me')
        const topicMap = me.learnerProfile?.topics || {}
        const masteryObj = topicMap instanceof Map ? Object.fromEntries(topicMap) : (typeof topicMap === 'object' ? topicMap : {})
        setMastery(masteryObj)
      } catch (e) {
        console.error('Failed to load mastery:', e)
      }
    }
    load()
  }, [])

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <h2 className="mb-6 text-3xl font-semibold">AI Tutor Chat</h2>
          <p className="mb-4 text-slate-600 dark:text-slate-400">
            Chat with your AI tutor. I know about your quiz performance, mastery levels, and can help you understand concepts better.
          </p>
          <ChatPanel />
        </PageContainer>
      </main>
    </div>
  )
}

