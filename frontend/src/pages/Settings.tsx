import { useState } from 'react'
import { Settings as SettingsIcon, User, Lock, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'

export default function SettingsPage() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 6) {
      showToast('error', 'New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'New passwords do not match')
      return
    }

    setSaving(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      showToast('success', 'Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      const msg = err.message?.includes('400')
        ? 'Current password is incorrect'
        : err.message || 'Failed to change password'
      showToast('error', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold flex items-center gap-3 mb-8">
        <SettingsIcon className="w-8 h-8 text-violet-400" />
        Settings
      </h1>

      {/* Toast */}
      {toast && (
        <div className={`mb-6 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${
          toast.type === 'success'
            ? 'bg-green-900/30 border-green-800 text-green-300'
            : 'bg-red-900/30 border-red-800 text-red-300'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Profile Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-violet-400" />
          Profile
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <span className="text-sm text-gray-400">Name</span>
            <span className="text-sm text-gray-100">{user?.displayName}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <span className="text-sm text-gray-400">Email</span>
            <span className="text-sm text-gray-100">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-400">Role</span>
            <span className="text-sm text-gray-100 capitalize">{user?.role}</span>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-violet-400" />
          Change Password
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-600 mt-1">Minimum 6 characters</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              required
              minLength={6}
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-6 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
