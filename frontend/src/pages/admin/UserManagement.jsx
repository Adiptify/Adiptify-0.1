import { useEffect, useState } from 'react'
import PageContainer from '../../components/PageContainer.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { apiFetch } from '../../api/client.js'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ role: '', q: '' })
  const [selectedUser, setSelectedUser] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'student', studentId: '' })
  const [editUser, setEditUser] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadUsers()
  }, [filters])

  async function loadUsers() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.role) params.append('role', filters.role)
      if (filters.q) params.append('q', filters.q)
      const data = await apiFetch(`/api/admin/users?${params}`)
      setUsers(data.users || [])
    } catch (e) {
      setError('Failed to load users: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  async function createUser() {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setError('Name, email, and password are required')
      return
    }
    if (newUser.role === 'student' && !newUser.studentId) {
      setError('Student ID is required for student role')
      return
    }
    try {
      setError('')
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: newUser
      })
      setSuccess('User created successfully')
      setShowCreateModal(false)
      setNewUser({ name: '', email: '', password: '', role: 'student', studentId: '' })
      loadUsers()
    } catch (e) {
      setError('Failed to create user: ' + (e.message || ''))
    }
  }

  async function updateUser() {
    if (!editUser) return
    try {
      setError('')
      await apiFetch(`/api/admin/users/${editUser._id}`, {
        method: 'PUT',
        body: editUser
      })
      setSuccess('User updated successfully')
      setShowEditModal(false)
      setEditUser(null)
      loadUsers()
    } catch (e) {
      setError('Failed to update user: ' + (e.message || ''))
    }
  }

  async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return
    try {
      setError('')
      await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      setSuccess('User deleted successfully')
      loadUsers()
    } catch (e) {
      setError('Failed to delete user: ' + (e.message || ''))
    }
  }

  async function resetPassword(userId) {
    const newPassword = prompt('Enter new password (min 6 characters):')
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    try {
      setError('')
      await apiFetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        body: { newPassword }
      })
      setSuccess('Password reset successfully')
      loadUsers()
    } catch (e) {
      setError('Failed to reset password: ' + (e.message || ''))
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-3xl font-semibold">User Management</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded bg-indigo-600 px-4 py-2 text-white hover:brightness-105"
            >
              Create User
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-green-700 dark:text-green-400">
              {success}
            </div>
          )}

          <div className="mb-4 flex gap-2">
            <select
              className="rounded border px-3 py-2 bg-white dark:bg-slate-900"
              value={filters.role}
              onChange={e => setFilters({ ...filters, role: e.target.value })}
            >
              <option value="">All Roles</option>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
            <input
              className="flex-1 rounded border px-3 py-2 bg-white dark:bg-slate-900"
              placeholder="Search by name, email, or student ID..."
              value={filters.q}
              onChange={e => setFilters({ ...filters, q: e.target.value })}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm rounded-xl bg-slate-50 shadow-lg dark:bg-slate-900">
              <thead>
                <tr className="text-slate-600 dark:text-slate-200">
                  <th className="p-3 font-medium text-left">Name</th>
                  <th className="p-3 font-medium text-left">Email</th>
                  <th className="p-3 font-medium text-left">Role</th>
                  <th className="p-3 font-medium text-left">Student ID</th>
                  <th className="p-3 font-medium text-left">Locked Subjects</th>
                  <th className="p-3 font-medium text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20">
                    <td className="p-3">{user.name}</td>
                    <td className="p-3">{user.email}</td>
                    <td className="p-3 capitalize">{user.role}</td>
                    <td className="p-3">{user.studentId || '-'}</td>
                    <td className="p-3">
                      {user.lockedSubjects && user.lockedSubjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.lockedSubjects.map(subject => (
                            <span key={subject} className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-1 text-xs">
                              {subject}
                            </span>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditUser({ ...user })
                            setShowEditModal(true)
                          }}
                          className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:brightness-105"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => resetPassword(user._id)}
                          className="rounded bg-yellow-600 px-2 py-1 text-xs text-white hover:brightness-105"
                        >
                          Reset Pwd
                        </button>
                        <button
                          onClick={() => deleteUser(user._id)}
                          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:brightness-105"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-400 py-6">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Create User Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 w-full max-w-md mx-4">
                <h3 className="text-xl font-semibold mb-4">Create User</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                      value={newUser.name}
                      onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email *</label>
                    <input
                      type="email"
                      className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                      value={newUser.email}
                      onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password *</label>
                    <input
                      type="password"
                      className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Role *</label>
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                      value={newUser.role}
                      onChange={e => setNewUser({ ...newUser, role: e.target.value, studentId: e.target.value !== 'student' ? '' : newUser.studentId })}
                    >
                      <option value="student">Student</option>
                      <option value="instructor">Instructor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {newUser.role === 'student' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Student ID *</label>
                      <input
                        className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                        value={newUser.studentId}
                        onChange={e => setNewUser({ ...newUser, studentId: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button onClick={createUser} className="flex-1 rounded bg-indigo-600 px-4 py-2 text-white hover:brightness-105">
                      Create
                    </button>
                    <button onClick={() => { setShowCreateModal(false); setError('') }} className="rounded border px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit User Modal */}
          {showEditModal && editUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 w-full max-w-md mx-4">
                <h3 className="text-xl font-semibold mb-4">Edit User</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                      value={editUser.name}
                      onChange={e => setEditUser({ ...editUser, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                      value={editUser.email}
                      onChange={e => setEditUser({ ...editUser, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Role</label>
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                      value={editUser.role}
                      onChange={e => setEditUser({ ...editUser, role: e.target.value, studentId: e.target.value !== 'student' ? undefined : editUser.studentId })}
                    >
                      <option value="student">Student</option>
                      <option value="instructor">Instructor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {editUser.role === 'student' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Student ID</label>
                      <input
                        className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                        value={editUser.studentId || ''}
                        onChange={e => setEditUser({ ...editUser, studentId: e.target.value })}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1">Locked Subjects (comma-separated)</label>
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 bg-transparent"
                      value={Array.isArray(editUser.lockedSubjects) ? editUser.lockedSubjects.join(', ') : ''}
                      onChange={e => setEditUser({ ...editUser, lockedSubjects: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="e.g., advanced_algorithms, machine_learning"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={updateUser} className="flex-1 rounded bg-indigo-600 px-4 py-2 text-white hover:brightness-105">
                      Update
                    </button>
                    <button onClick={() => { setShowEditModal(false); setEditUser(null); setError('') }} className="rounded border px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </PageContainer>
      </main>
    </div>
  )
}

