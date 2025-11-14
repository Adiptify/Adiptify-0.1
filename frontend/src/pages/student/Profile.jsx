import { useEffect, useState } from 'react'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { apiFetch } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const me = await apiFetch('/api/auth/me')
        setProfile(me)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="flex"><Sidebar /><main className="flex-1"><PageContainer><div className="py-12 text-center">Loading...</div></PageContainer></main></div>

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <h2 className="mb-6 text-3xl font-semibold">My Profile</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-6 shadow-lg dark:border-slate-800">
              <h3 className="mb-4 text-lg font-semibold">Account Information</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-slate-500">Name</div>
                  <div className="font-medium">{profile?.name || user?.name}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Email</div>
                  <div className="font-medium">{profile?.email || user?.email}</div>
                </div>
                {profile?.studentId && (
                  <div>
                    <div className="text-sm text-slate-500">Student ID</div>
                    <div className="font-medium">{profile.studentId}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-slate-500">Role</div>
                  <div className="font-medium capitalize">{profile?.role || user?.role}</div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-6 shadow-lg dark:border-slate-800">
              <h3 className="mb-4 text-lg font-semibold">Learning Stats</h3>
              <div className="space-y-3">
                {profile?.learnerProfile?.topics && Object.keys(profile.learnerProfile.topics).length > 0 ? (
                  Object.entries(profile.learnerProfile.topics).map(([topic, data]) => {
                    // Handle both old (0-1) and new (0-100) formats
                    let masteryPercent = data.mastery || 0;
                    if (masteryPercent < 1 && masteryPercent > 0) {
                      masteryPercent = Math.round(masteryPercent * 100); // Old format: convert to percentage
                    } else {
                      masteryPercent = Math.round(masteryPercent); // New format: already percentage
                    }
                    return (
                      <div key={topic}>
                        <div className="text-sm font-medium">{topic}</div>
                        <div className="text-xs text-slate-500">Mastery: {masteryPercent}% | Attempts: {data.attempts || 0}</div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-sm text-slate-400">No learning data yet. Start a quiz to begin!</div>
                )}
              </div>
            </div>
          </div>
        </PageContainer>
      </main>
    </div>
  )
}

