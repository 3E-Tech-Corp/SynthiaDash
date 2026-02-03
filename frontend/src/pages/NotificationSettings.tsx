import { useState, useEffect } from 'react'
import { Bell, CheckCircle, XCircle, Loader2, Send, RefreshCw, Wifi, WifiOff, Eye, EyeOff } from 'lucide-react'

interface NotificationSetting {
  id: number
  eventCode: string
  eventName: string
  taskCode: string | null
  isEnabled: boolean
  description: string | null
  createdAt: string
  updatedAt: string
}

interface FXTask {
  id: number
  taskCode: string
  taskName: string | null
  description: string | null
  channel: string | null
  isActive: boolean
}

interface HealthResult {
  isHealthy: boolean
  baseUrl: string | null
  hasApiKey: boolean
  error: string | null
}

const API_BASE = '/api'

function getToken() {
  return localStorage.getItem('token')
}

async function fetchWithAuth<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
    throw new Error(err.error || err.detail || `API error: ${response.status}`)
  }
  return response.json()
}

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSetting[]>([])
  const [tasks, setTasks] = useState<FXTask[]>([])
  const [health, setHealth] = useState<HealthResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [testingCode, setTestingCode] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  // Auto-dismiss success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [success])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [settingsData, tasksData, healthData] = await Promise.all([
        fetchWithAuth<NotificationSetting[]>('/notification-settings'),
        fetchWithAuth<FXTask[]>('/notification-settings/available-tasks'),
        fetchWithAuth<HealthResult>('/notification-settings/health'),
      ])
      setSettings(settingsData)
      setTasks(tasksData)
      setHealth(healthData)
    } catch (err: any) {
      setError(err.message || 'Failed to load notification settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(setting: NotificationSetting) {
    setSavingId(setting.id)
    setError(null)
    try {
      const updated = await fetchWithAuth<NotificationSetting>(`/notification-settings/${setting.id}`, {
        method: 'PUT',
        body: JSON.stringify({ taskCode: setting.taskCode, isEnabled: setting.isEnabled }),
      })
      setSettings(prev => prev.map(s => s.id === updated.id ? updated : s))
      setSuccess(`Saved ${setting.eventName}`)
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSavingId(null)
    }
  }

  async function handleTest(eventCode: string) {
    setTestingCode(eventCode)
    setError(null)
    try {
      const result = await fetchWithAuth<{ message: string; id?: number }>(`/notification-settings/test/${eventCode}`, {
        method: 'POST',
      })
      setSuccess(result.message || 'Test sent!')
    } catch (err: any) {
      setError(err.message || 'Test failed')
    } finally {
      setTestingCode(null)
    }
  }

  function handleTaskCodeChange(id: number, taskCode: string) {
    setSettings(prev =>
      prev.map(s => s.id === id ? { ...s, taskCode: taskCode || null } : s)
    )
  }

  function handleToggleEnabled(id: number) {
    setSettings(prev =>
      prev.map(s => s.id === id ? { ...s, isEnabled: !s.isEnabled } : s)
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-violet-400" />
            Notification Settings
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Map application events to FXNotification tasks
          </p>
        </div>
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Connection Status */}
      {health && (
        <div className={`mb-6 rounded-xl border p-4 ${
          health.isHealthy
            ? 'bg-green-500/5 border-green-500/20'
            : 'bg-red-500/5 border-red-500/20'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {health.isHealthy ? (
                <Wifi className="w-5 h-5 text-green-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-400" />
              )}
              <div>
                <div className={`text-sm font-medium ${health.isHealthy ? 'text-green-400' : 'text-red-400'}`}>
                  {health.isHealthy ? 'Connected to FXNotification' : 'FXNotification Unreachable'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {health.baseUrl || 'No BaseUrl configured'}
                  {health.error && !health.isHealthy && (
                    <span className="ml-2 text-red-400">— {health.error}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500">
                API Key: {health.hasApiKey ? (
                  <span className="inline-flex items-center gap-1">
                    {showApiKey ? (
                      <span className="text-green-400 font-mono">fxn_•••••••</span>
                    ) : (
                      <span className="text-green-400">configured</span>
                    )}
                    <button onClick={() => setShowApiKey(v => !v)} className="text-gray-500 hover:text-gray-300">
                      {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </span>
                ) : (
                  <span className="text-yellow-400">not set</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 text-green-300 text-sm mb-4">
          {success}
        </div>
      )}

      {/* Settings Table */}
      {settings.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No notification events configured.</p>
          <p className="text-sm mt-1">Run the database migration to seed default events.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Event</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Description</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Task</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Enabled</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {settings.map(setting => (
                  <tr key={setting.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    {/* Event Code & Name */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{setting.eventName}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{setting.eventCode}</div>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell max-w-[250px]">
                      <span className="truncate block" title={setting.description || undefined}>
                        {setting.description || '—'}
                      </span>
                    </td>

                    {/* TaskCode dropdown */}
                    <td className="px-4 py-3">
                      <select
                        value={setting.taskCode || ''}
                        onChange={(e) => handleTaskCodeChange(setting.id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-200 w-full max-w-[200px] focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                      >
                        <option value="">— Not mapped —</option>
                        {tasks.filter(t => t.isActive).map(task => (
                          <option key={task.taskCode} value={task.taskCode}>
                            {task.taskName || task.taskCode}
                            {task.channel ? ` (${task.channel})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Enabled toggle */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleEnabled(setting.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          setting.isEnabled ? 'bg-violet-600' : 'bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            setting.isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleSave(setting)}
                          disabled={savingId === setting.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {savingId === setting.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Save
                        </button>
                        <button
                          onClick={() => handleTest(setting.eventCode)}
                          disabled={testingCode === setting.eventCode || !setting.taskCode || !setting.isEnabled}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!setting.taskCode ? 'Assign a task first' : !setting.isEnabled ? 'Enable this event first' : 'Send test notification'}
                        >
                          {testingCode === setting.eventCode ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Test
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Available Tasks Info */}
      {tasks.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3">
            Available FXNotification Tasks ({tasks.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tasks.map(task => (
              <div key={task.taskCode} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{task.taskName || task.taskCode}</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    task.isActive
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                  }`}>
                    {task.isActive ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                    {task.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-mono">{task.taskCode}</div>
                {task.channel && (
                  <div className="text-xs text-gray-400 mt-1">Channel: {task.channel}</div>
                )}
                {task.description && (
                  <div className="text-xs text-gray-500 mt-1 truncate" title={task.description}>
                    {task.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
