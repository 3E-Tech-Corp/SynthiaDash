import { useEffect, useState, useRef } from 'react'
import {
  Bug, Lightbulb, Plus, X, Image as ImageIcon, Loader2,
  Clock, CheckCircle, PlayCircle, XCircle, Trash2, Zap,
  ChevronDown, ChevronUp
} from 'lucide-react'
import { api } from '../services/api'
import type { Ticket, RepoStatus } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  submitted: { icon: Clock, color: 'text-yellow-400', label: 'Submitted' },
  in_progress: { icon: PlayCircle, color: 'text-blue-400', label: 'In Progress' },
  completed: { icon: CheckCircle, color: 'text-green-400', label: 'Completed' },
  closed: { icon: XCircle, color: 'text-gray-500', label: 'Closed' },
}

const TYPE_CONFIG = {
  bug: { icon: Bug, color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-800', label: 'Bug Report' },
  feature: { icon: Lightbulb, color: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-800', label: 'Feature Request' },
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.submitted
  const Icon = config.icon
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
      <Icon className="w-3.5 h-3.5" /> {config.label}
    </span>
  )
}

function TicketCard({
  ticket,
  isAdmin,
  onRefresh,
  expanded,
  onToggle,
}: {
  ticket: Ticket
  isAdmin: boolean
  onRefresh: () => void
  expanded: boolean
  onToggle: () => void
}) {
  const [executing, setExecuting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const typeConfig = TYPE_CONFIG[ticket.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.bug
  const TypeIcon = typeConfig.icon

  const handleExecute = async () => {
    if (!confirm('Start Synthia working on this ticket?')) return
    setExecuting(true)
    try {
      await api.executeTicket(ticket.id)
      onRefresh()
    } catch (err) {
      console.error('Execute failed:', err)
    } finally {
      setExecuting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this ticket?')) return
    setDeleting(true)
    try {
      await api.deleteTicket(ticket.id)
      onRefresh()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleting(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.updateTicket(ticket.id, { status: newStatus })
      onRefresh()
    } catch (err) {
      console.error('Status update failed:', err)
    }
  }

  return (
    <div className={`bg-gray-900 border rounded-xl transition-colors ${typeConfig.border}`}>
      {/* Header row - always visible */}
      <div
        className="flex items-center gap-4 p-5 cursor-pointer hover:bg-gray-800/50 transition-colors rounded-xl"
        onClick={onToggle}
      >
        <div className={`p-2 rounded-lg ${typeConfig.bg}`}>
          <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-semibold text-gray-100 truncate">{ticket.title}</h3>
            <StatusBadge status={ticket.status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{ticket.userDisplayName || ticket.userEmail}</span>
            {ticket.repoFullName && <span className="font-mono text-gray-600">{ticket.repoFullName}</span>}
            <span>{timeAgo(ticket.createdAt)}</span>
            {ticket.imagePath && <ImageIcon className="w-3 h-3 text-gray-600" />}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-lg ${typeConfig.bg} ${typeConfig.color}`}>
            {typeConfig.label}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-800/50">
          <div className="mt-4 space-y-4">
            {/* Description */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Description</h4>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{ticket.description}</p>
            </div>

            {/* Image */}
            {ticket.imagePath && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Attachment</h4>
                <a
                  href={api.getTicketImageUrl(ticket.imagePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  <img
                    src={api.getTicketImageUrl(ticket.imagePath)}
                    alt="Ticket attachment"
                    className="max-w-md max-h-64 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
                  />
                </a>
              </div>
            )}

            {/* Result */}
            {ticket.result && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Result</h4>
                <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap">
                  {ticket.result}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              {isAdmin && ticket.status === 'submitted' && (
                <button
                  onClick={handleExecute}
                  disabled={executing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Execute
                </button>
              )}
              {isAdmin && ticket.status === 'submitted' && (
                <button
                  onClick={() => handleStatusChange('closed')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" /> Close
                </button>
              )}
              {isAdmin && ticket.status === 'completed' && (
                <button
                  onClick={() => handleStatusChange('closed')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Archive
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-red-400 hover:bg-red-900/30 rounded-lg text-xs font-medium transition-colors ml-auto"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TicketsPage() {
  const { isAdmin } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<string>('none')
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [repos, setRepos] = useState<RepoStatus[]>([])

  // Create form state
  const [createForm, setCreateForm] = useState({
    type: 'bug' as 'bug' | 'feature',
    title: '',
    description: '',
    repoFullName: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [filter, setFilter] = useState<'all' | 'bug' | 'feature'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchTickets()
    fetchAccess()
    fetchRepos()
  }, [])

  const fetchTickets = async () => {
    try {
      const data = await api.getTickets()
      setTickets(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const fetchAccess = async () => {
    try {
      const data = await api.getTicketAccess()
      setAccess(data.access)
    } catch {
      // ignore
    }
  }

  const fetchRepos = async () => {
    try {
      const data = await api.getRepos()
      setRepos(data)
    } catch {
      // ignore
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setCreateError('Image must be under 10MB')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)

    try {
      const formData = new FormData()
      formData.append('type', createForm.type)
      formData.append('title', createForm.title)
      formData.append('description', createForm.description)
      if (createForm.repoFullName) formData.append('repoFullName', createForm.repoFullName)
      if (imageFile) formData.append('image', imageFile)

      await api.createTicket(formData)
      setShowCreate(false)
      setCreateForm({ type: 'bug', title: '', description: '', repoFullName: '' })
      clearImage()
      fetchTickets()
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create ticket')
    } finally {
      setCreating(false)
    }
  }

  const filteredTickets = tickets.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    return true
  })

  const canSubmit = access === 'submit' || access === 'execute'

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bug className="w-8 h-8 text-red-400" />
            Tickets
            <span className="text-sm font-normal text-gray-500 ml-2">({filteredTickets.length})</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Bug reports & feature requests
            {access !== 'none' && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                Access: <span className={access === 'execute' ? 'text-violet-400' : 'text-green-400'}>{access}</span>
              </span>
            )}
          </p>
        </div>
        {canSubmit && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex rounded-lg overflow-hidden border border-gray-800">
          {['all', 'bug', 'feature'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f === 'all' ? 'All' : f === 'bug' ? '🐛 Bugs' : '💡 Features'}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-gray-800">
          {['all', 'submitted', 'in_progress', 'completed', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* No access message */}
      {!canSubmit && !isAdmin && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 text-center">
          <p className="text-gray-400">You don't have permission to submit tickets.</p>
          <p className="text-gray-600 text-sm mt-1">Contact the admin to get access.</p>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">New Ticket</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{createError}</div>
              )}

              {/* Type selector */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Type</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, type: 'bug' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-colors ${
                      createForm.type === 'bug'
                        ? 'border-red-600 bg-red-900/30 text-red-300'
                        : 'border-gray-700 text-gray-500 hover:border-gray-600'
                    }`}
                  >
                    <Bug className="w-5 h-5" />
                    <span className="font-medium">Bug Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, type: 'feature' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-colors ${
                      createForm.type === 'feature'
                        ? 'border-amber-600 bg-amber-900/30 text-amber-300'
                        : 'border-gray-700 text-gray-500 hover:border-gray-600'
                    }`}
                  >
                    <Lightbulb className="w-5 h-5" />
                    <span className="font-medium">Feature Request</span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Title *</label>
                <input
                  value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder={createForm.type === 'bug' ? 'e.g., Login button not responding' : 'e.g., Add dark mode support'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                  required
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Description *</label>
                <textarea
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder={createForm.type === 'bug'
                    ? 'Steps to reproduce, expected vs actual behavior...'
                    : 'Describe the feature, why it would be useful...'
                  }
                  rows={5}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none"
                  required
                />
              </div>

              {/* Repo selector */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Repository <span className="text-gray-600">(optional)</span>
                </label>
                <select
                  value={createForm.repoFullName}
                  onChange={e => setCreateForm({ ...createForm, repoFullName: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="">No specific repo</option>
                  {repos.map(r => (
                    <option key={r.fullName} value={r.fullName}>{r.fullName}</option>
                  ))}
                </select>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Screenshot <span className="text-gray-600">(optional, max 10MB)</span>
                </label>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="Preview" className="max-w-full max-h-48 rounded-lg border border-gray-700" />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 hover:bg-red-500 transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-gray-600 transition-colors"
                  >
                    <ImageIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <span className="text-sm text-gray-500">Click to upload an image</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* Access info */}
              {access === 'execute' && (
                <div className="bg-violet-900/20 border border-violet-800/50 rounded-lg p-3 text-sm text-violet-300 flex items-center gap-2">
                  <Zap className="w-4 h-4 flex-shrink-0" />
                  <span>You have <strong>execute</strong> access — Synthia will start working on this automatically.</span>
                </div>
              )}
              {access === 'submit' && (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 text-sm text-blue-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>You have <strong>submit</strong> access — the admin will be notified of your submission.</span>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 text-sm text-gray-500 hover:text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Submit Ticket</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tickets list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
              <div className="h-5 bg-gray-800 rounded w-1/3 mb-3"></div>
              <div className="h-3 bg-gray-800 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Bug className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No tickets yet.</p>
          {canSubmit && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              Submit the first one →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              isAdmin={isAdmin}
              onRefresh={fetchTickets}
              expanded={expandedId === ticket.id}
              onToggle={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
