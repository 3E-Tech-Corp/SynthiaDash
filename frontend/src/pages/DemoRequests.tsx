import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { api } from '../services/api'
import type { DemoRequestItem } from '../services/api'

const STATUS_BADGE: Record<string, { className: string; icon: React.ReactNode }> = {
  pending: {
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    icon: <Clock className="w-3 h-3" />,
  },
  approved: {
    className: 'bg-green-500/10 text-green-400 border-green-500/20',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  rejected: {
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: <XCircle className="w-3 h-3" />,
  },
}

export default function DemoRequests() {
  const [requests, setRequests] = useState<DemoRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<number | null>(null)

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    try {
      const data = await api.getDemoRequests()
      setRequests(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load demo requests')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusUpdate(id: number, status: string) {
    setUpdating(id)
    try {
      await api.updateDemoRequest(id, status)
      setRequests(prev =>
        prev.map(r =>
          r.id === id
            ? { ...r, status, reviewedAt: new Date().toISOString() }
            : r
        )
      )
    } catch (err: any) {
      setError(err.message || 'Failed to update status')
    } finally {
      setUpdating(null)
    }
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Demo Requests</h1>
          <p className="text-gray-400 text-sm mt-1">
            {requests.length} request{requests.length !== 1 ? 's' : ''} total
            {' · '}
            {requests.filter(r => r.status === 'pending').length} pending
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p>No demo requests yet.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Reason</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">IP</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Location</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium hidden sm:table-cell">Date</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => {
                  const badge = STATUS_BADGE[req.status] || STATUS_BADGE.pending
                  return (
                    <tr key={req.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-medium">{req.name}</td>
                      <td className="px-4 py-3 text-gray-300">
                        <a href={`mailto:${req.email}`} className="hover:text-violet-400 transition-colors">
                          {req.email}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell max-w-[200px]">
                        <span className="truncate block" title={req.reason}>
                          {req.reason.length > 80 ? req.reason.substring(0, 80) + '…' : req.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden md:table-cell">
                        {req.ipAddress || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell max-w-[180px]">
                        <span className="truncate block" title={req.location || undefined}>
                          {req.location || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.className}`}>
                          {badge.icon}
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleStatusUpdate(req.id, 'approved')}
                              disabled={updating === req.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(req.id, 'rejected')}
                              disabled={updating === req.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">
                            {req.reviewedAt
                              ? new Date(req.reviewedAt).toLocaleDateString()
                              : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
