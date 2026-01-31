import { useEffect, useState } from 'react'
import { Users as UsersIcon, Plus, Shield, Eye, Code, X, Check, Loader2 } from 'lucide-react'
import { api } from '../services/api'
import type { User } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const ROLES = [
  { value: 'admin', label: 'Admin', icon: Shield, color: 'text-red-400', desc: 'Full access to everything' },
  { value: 'member', label: 'Member', icon: Code, color: 'text-blue-400', desc: 'Can view repos & trigger fixes' },
  { value: 'viewer', label: 'Viewer', icon: Eye, color: 'text-gray-400', desc: 'Read-only access' },
]

const TICKET_ACCESS = [
  { value: 'none', label: 'No Access', color: 'text-gray-500', desc: 'Cannot submit tickets' },
  { value: 'submit', label: 'Submit', color: 'text-green-400', desc: 'Submit tickets (admin notified)' },
  { value: 'execute', label: 'Execute', color: 'text-violet-400', desc: 'Submit & auto-execute via Synthia' },
]

function RoleBadge({ role }: { role: string }) {
  const r = ROLES.find(x => x.value === role) || ROLES[2]
  const Icon = r.icon
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${r.color}`}>
      <Icon className="w-3 h-3" /> {r.label}
    </span>
  )
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface EditState {
  role: string
  repos: string
  ticketAccess: string
  isActive: boolean
}

function UserRow({ user, onUpdate }: { user: User; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [edit, setEdit] = useState<EditState>({
    role: user.role,
    repos: user.repos || '',
    ticketAccess: user.ticketAccess || 'none',
    isActive: user.isActive,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateUser(user.id, {
        role: edit.role,
        repos: edit.repos || undefined,
        ticketAccess: edit.ticketAccess,
        isActive: edit.isActive,
      })
      setEditing(false)
      onUpdate()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEdit({ role: user.role, repos: user.repos || '', ticketAccess: user.ticketAccess || 'none', isActive: user.isActive })
    setEditing(false)
  }

  return (
    <div className={`bg-gray-900 border rounded-xl p-5 transition-colors ${
      !user.isActive ? 'border-red-900/50 opacity-60' : editing ? 'border-violet-700' : 'border-gray-800'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-100">{user.displayName}</h3>
            <RoleBadge role={editing ? edit.role : user.role} />
            {!user.isActive && (
              <span className="text-xs text-red-500 bg-red-900/30 px-2 py-0.5 rounded">Disabled</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-gray-500 hover:text-violet-400 transition-colors px-3 py-1 rounded-lg hover:bg-gray-800"
          >
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded-lg hover:bg-gray-800 flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
            </button>
            <button
              onClick={handleCancel}
              className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-gray-800 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-3 mt-4">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Role</label>
            <div className="flex gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setEdit({ ...edit, role: r.value })}
                  className={`flex-1 text-xs py-2 px-3 rounded-lg border transition-colors ${
                    edit.role === r.value
                      ? 'border-violet-600 bg-violet-900/30 text-violet-300'
                      : 'border-gray-700 text-gray-500 hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium">{r.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Repo access */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Repo Access <span className="text-gray-600">(JSON array, empty = role default, admin sees all)</span>
            </label>
            <input
              value={edit.repos}
              onChange={e => setEdit({ ...edit, repos: e.target.value })}
              placeholder='["3E-Tech-Corp/Zhijian"]'
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Ticket Access */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Ticket Access</label>
            <div className="flex gap-2">
              {TICKET_ACCESS.map(ta => (
                <button
                  key={ta.value}
                  onClick={() => setEdit({ ...edit, ticketAccess: ta.value })}
                  className={`flex-1 text-xs py-2 px-3 rounded-lg border transition-colors ${
                    edit.ticketAccess === ta.value
                      ? 'border-violet-600 bg-violet-900/30 text-violet-300'
                      : 'border-gray-700 text-gray-500 hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium">{ta.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{ta.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-400">Active</label>
            <button
              onClick={() => setEdit({ ...edit, isActive: !edit.isActive })}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                edit.isActive ? 'bg-green-600' : 'bg-gray-700'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                edit.isActive ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 text-xs text-gray-600 mt-2 flex-wrap">
          {user.repos && (
            <span>Repos: <span className="text-gray-400 font-mono">{user.repos}</span></span>
          )}
          <span>
            Tickets: <span className={
              user.ticketAccess === 'execute' ? 'text-violet-400' :
              user.ticketAccess === 'submit' ? 'text-green-400' : 'text-gray-500'
            }>{user.ticketAccess || 'none'}</span>
          </span>
          <span>Joined {timeAgo(user.createdAt)}</span>
          <span>Last login {timeAgo(user.lastLoginAt)}</span>
        </div>
      )}
    </div>
  )
}

export default function UsersPage() {
  const { isAdmin } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ email: '', displayName: '', password: '', role: 'viewer' })
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    setAdding(true)
    try {
      await api.registerUser(addForm.email, addForm.displayName || addForm.email.split('@')[0], addForm.password, addForm.role)
      setShowAdd(false)
      setAddForm({ email: '', displayName: '', password: '', role: 'viewer' })
      fetchUsers()
    } catch (err: any) {
      setAddError(err.message || 'Failed to add user')
    } finally {
      setAdding(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl">
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-6 text-red-300">
          Admin access required.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <UsersIcon className="w-8 h-8 text-violet-400" />
          Users
          <span className="text-sm font-normal text-gray-500 ml-2">({users.length})</span>
        </h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Add user form */}
      {showAdd && (
        <form onSubmit={handleAddUser} className="bg-gray-900 border border-violet-800 rounded-xl p-5 mb-6 space-y-3">
          <h3 className="font-semibold text-violet-300 mb-3">New User</h3>
          {addError && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-2 text-red-300 text-sm">{addError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email *</label>
              <input
                type="email"
                value={addForm.email}
                onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Display Name</label>
              <input
                value={addForm.displayName}
                onChange={e => setAddForm({ ...addForm, displayName: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                placeholder="Auto from email"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password *</label>
              <input
                type="password"
                value={addForm.password}
                onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Role</label>
              <select
                value={addForm.role}
                onChange={e => setAddForm({ ...addForm, role: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="viewer">Viewer (read-only)</option>
                <option value="member">Member (repos + fix)</option>
                <option value="admin">Admin (full access)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-sm text-gray-500 hover:text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {adding ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
              <div className="h-5 bg-gray-800 rounded w-1/4 mb-3"></div>
              <div className="h-3 bg-gray-800 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {users.map(user => (
            <UserRow key={user.id} user={user} onUpdate={fetchUsers} />
          ))}
        </div>
      )}
    </div>
  )
}
