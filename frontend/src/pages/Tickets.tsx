import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Bug, Lightbulb, Plus, X, Image as ImageIcon, Loader2,
  Clock, CheckCircle, PlayCircle, XCircle, Trash2, Zap,
  ChevronDown, ChevronUp, MessageSquare, Send, Bot,
  ArrowLeft, Search, AlertCircle, Info
} from 'lucide-react'
import { api } from '../services/api'
import type { Ticket, RepoStatus, TicketComment } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

// ── Constants ──────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string; step: number }> = {
  submitted: { icon: Clock, color: 'text-yellow-400', label: 'Submitted', step: 0 },
  flagged: { icon: AlertCircle, color: 'text-orange-400', label: 'Flagged for Review', step: 0 },
  in_progress: { icon: PlayCircle, color: 'text-blue-400', label: 'In Progress', step: 2 },
  completed: { icon: CheckCircle, color: 'text-green-400', label: 'Completed', step: 3 },
  closed: { icon: XCircle, color: 'text-gray-500', label: 'Closed', step: 4 },
}

const STATUS_TIMELINE = [
  { key: 'submitted', label: 'Submitted', icon: Clock },
  { key: 'in_review', label: 'In Review', icon: Search },
  { key: 'in_progress', label: 'In Progress', icon: PlayCircle },
  { key: 'completed', label: 'Completed', icon: CheckCircle },
]

const TYPE_CONFIG = {
  bug: { icon: Bug, color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-800', label: 'Bug Report' },
  feature: { icon: Lightbulb, color: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-800', label: 'Feature Request' },
}

// ── Helpers ────────────────────────────────────────────────

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function getStatusStep(status: string): number {
  if (status === 'submitted' || status === 'flagged') return 0
  if (status === 'in_progress') return 2
  if (status === 'completed') return 3
  if (status === 'closed') return 4
  return 0
}

/** localStorage key for tracking last-viewed timestamps per ticket */
const LAST_VIEWED_KEY = 'synthia-ticket-last-viewed'

function getLastViewed(): Record<number, number> {
  try {
    return JSON.parse(localStorage.getItem(LAST_VIEWED_KEY) || '{}')
  } catch {
    return {}
  }
}

function markViewed(ticketId: number) {
  const data = getLastViewed()
  data[ticketId] = Date.now()
  localStorage.setItem(LAST_VIEWED_KEY, JSON.stringify(data))
}

function hasNewActivity(ticket: Ticket): boolean {
  const data = getLastViewed()
  const lastViewed = data[ticket.id]
  if (!lastViewed) return true // Never viewed = new
  const updatedAt = new Date(ticket.updatedAt).getTime()
  return updatedAt > lastViewed
}

// ── Components ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.submitted
  const Icon = config.icon
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
      <Icon className="w-3.5 h-3.5" /> {config.label}
    </span>
  )
}

/** Horizontal status timeline */
function StatusTimeline({ status }: { status: string }) {
  const currentStep = getStatusStep(status)
  const isClosed = status === 'closed'

  return (
    <div className="flex items-center gap-1 w-full overflow-x-auto py-2">
      {STATUS_TIMELINE.map((step, i) => {
        const isActive = currentStep >= i
        const isCurrent = (status === 'submitted' || status === 'flagged') && i === 0
          || status === 'in_progress' && i === 2
          || status === 'completed' && i === 3
        const Icon = step.icon

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isCurrent
                  ? 'bg-violet-600 ring-2 ring-violet-400/50 text-white'
                  : isActive
                    ? 'bg-violet-600/60 text-violet-200'
                    : 'bg-gray-800 text-gray-600'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${
                isCurrent ? 'text-violet-300' : isActive ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {step.label}
              </span>
            </div>
            {i < STATUS_TIMELINE.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full mt-[-14px] ${
                currentStep > i ? 'bg-violet-600/60' : 'bg-gray-800'
              }`} />
            )}
          </div>
        )
      })}
      {isClosed && (
        <div className="flex items-center ml-1 flex-shrink-0">
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-700 text-gray-400 ring-2 ring-gray-600/50">
              <XCircle className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap">Closed</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Comment/Activity feed */
function CommentsSection({ ticketId, isAdmin: _isAdmin }: { ticketId: number; isAdmin: boolean }) {
  const [comments, setComments] = useState<TicketComment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchComments = useCallback(async () => {
    try {
      const data = await api.getTicketComments(ticketId)
      setComments(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  useEffect(() => {
    // Scroll to bottom when comments load or change
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const handleSend = async () => {
    if (!newComment.trim() || sending) return
    setSending(true)
    try {
      await api.addTicketComment(ticketId, newComment.trim())
      setNewComment('')
      await fetchComments()
    } catch (err) {
      console.error('Failed to send comment:', err)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="mt-4">
      <h4 className="text-xs font-medium text-gray-500 uppercase mb-3 flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" />
        Activity & Comments
      </h4>

      {/* Comments list */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1 mb-3">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-600 text-sm py-4 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading activity...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-gray-600 text-sm text-center py-4">
            No activity yet. Add a comment to get started.
          </div>
        ) : (
          comments.map(comment => (
            <div
              key={comment.id}
              className={`flex gap-3 ${comment.isSystemMessage ? 'items-center' : 'items-start'}`}
            >
              {/* Avatar */}
              {comment.isSystemMessage ? (
                <div className="w-7 h-7 rounded-full bg-violet-900/40 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-violet-400" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-300">
                  {comment.userDisplayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                {comment.isSystemMessage ? (
                  <p className="text-xs text-gray-500 italic">{comment.comment}</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-300">{comment.userDisplayName}</span>
                      <span className="text-[10px] text-gray-600">{timeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{comment.comment}</p>
                  </>
                )}
              </div>

              {/* Timestamp for system msgs */}
              {comment.isSystemMessage && (
                <span className="text-[10px] text-gray-700 flex-shrink-0">{timeAgo(comment.createdAt)}</span>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Comment input */}
      <div className="flex gap-2 items-end">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment or question..."
          rows={1}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none min-h-[38px] max-h-24"
          style={{ height: 'auto' }}
          onInput={e => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = Math.min(target.scrollHeight, 96) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!newComment.trim() || sending}
          className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

/** Individual ticket card */
function TicketCard({
  ticket,
  isAdmin,
  onRefresh,
  expanded,
  onToggle,
  onOpenDetail,
  isNew,
}: {
  ticket: Ticket
  isAdmin: boolean
  onRefresh: () => void
  expanded: boolean
  onToggle: () => void
  onOpenDetail: () => void
  isNew: boolean
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
        <div className={`p-2 rounded-lg ${typeConfig.bg} relative`}>
          <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
          {isNew && (
            <span className="absolute -top-1.5 -right-1.5 bg-violet-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              NEW
            </span>
          )}
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
          <span className={`text-xs px-2 py-1 rounded-lg ${typeConfig.bg} ${typeConfig.color} hidden sm:inline-flex`}>
            {typeConfig.label}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-800/50">
          <div className="mt-4 space-y-4">
            {/* Status Timeline */}
            <StatusTimeline status={ticket.status} />

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

            {/* Comments Section */}
            <CommentsSection ticketId={ticket.id} isAdmin={isAdmin} />

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <button
                onClick={onOpenDetail}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Full View
              </button>
              {isAdmin && (ticket.status === 'submitted' || ticket.status === 'flagged') && (
                <button
                  onClick={handleExecute}
                  disabled={executing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Execute
                </button>
              )}
              {isAdmin && (ticket.status === 'submitted' || ticket.status === 'flagged') && (
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

/** Full-page ticket detail view */
function TicketDetailView({
  ticket,
  isAdmin,
  onBack,
  onRefresh,
}: {
  ticket: Ticket
  isAdmin: boolean
  onBack: () => void
  onRefresh: () => void
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
      onBack()
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

  // Mark as viewed
  useEffect(() => {
    markViewed(ticket.id)
  }, [ticket.id])

  return (
    <div className="max-w-4xl">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Tickets
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className={`p-3 rounded-xl ${typeConfig.bg}`}>
          <TypeIcon className={`w-6 h-6 ${typeConfig.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white mb-1">{ticket.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
            <span>{ticket.userDisplayName || ticket.userEmail}</span>
            <span>·</span>
            <span>{timeAgo(ticket.createdAt)}</span>
            {ticket.repoFullName && (
              <>
                <span>·</span>
                <span className="font-mono text-gray-600">{ticket.repoFullName}</span>
              </>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-lg ${typeConfig.bg} ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <StatusTimeline status={ticket.status} />
      </div>

      {/* Main content area */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
        {/* Description */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Description</h4>
          <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
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
                className="max-w-full max-h-96 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
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

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Comments Section */}
        <CommentsSection ticketId={ticket.id} isAdmin={isAdmin} />

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-800 flex-wrap">
          {isAdmin && (ticket.status === 'submitted' || ticket.status === 'flagged') && (
            <button
              onClick={handleExecute}
              disabled={executing}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Execute
            </button>
          )}
          {isAdmin && (ticket.status === 'submitted' || ticket.status === 'flagged') && (
            <button
              onClick={() => handleStatusChange('closed')}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              <XCircle className="w-4 h-4" /> Close
            </button>
          )}
          {isAdmin && ticket.status === 'completed' && (
            <button
              onClick={() => handleStatusChange('closed')}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Archive
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 text-red-400 hover:bg-red-900/30 rounded-lg text-sm font-medium transition-colors ml-auto"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/** Submission success toast */
function SubmissionToast({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-gray-900 border border-violet-700/50 rounded-xl p-4 shadow-2xl shadow-violet-900/20 max-w-sm flex gap-3 items-start">
        <div className="w-8 h-8 rounded-full bg-violet-900/50 flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white mb-0.5">Request submitted!</p>
          <p className="text-xs text-gray-400">We'll review it and may ask follow-up questions in the ticket's comments.</p>
        </div>
        <button onClick={onDismiss} className="text-gray-600 hover:text-gray-400 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────

export default function TicketsPage() {
  const { isAdmin } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [bugAccess, setBugAccess] = useState<string>('none')
  const [featureAccess, setFeatureAccess] = useState<string>('none')
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [repos, setRepos] = useState<RepoStatus[]>([])
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null)
  const [showToast, setShowToast] = useState(false)

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
      // Update detail ticket if viewing one
      if (detailTicket) {
        const updated = data.find(t => t.id === detailTicket.id)
        if (updated) setDetailTicket(updated)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const fetchAccess = async () => {
    try {
      const data = await api.getTicketAccess()
      setBugAccess(data.bugAccess)
      setFeatureAccess(data.featureAccess)
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

  // Handle paste from clipboard (Ctrl+V an image anywhere on the form)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (!file) continue

        if (file.size > 10 * 1024 * 1024) {
          setCreateError('Image must be under 10MB')
          return
        }

        setImageFile(file)
        const reader = new FileReader()
        reader.onload = () => setImagePreview(reader.result as string)
        reader.readAsDataURL(file)
        return
      }
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)

    try {
      // For bugs: auto-generate title if blank, allow image-only
      const title = createForm.title.trim()
        || (createForm.type === 'bug'
          ? `Bug Report ${new Date().toLocaleDateString()}`
          : '')
      const description = createForm.description.trim()
        || (imageFile ? '(see attached screenshot)' : '')

      if (!title) {
        setCreateError('Title is required for feature requests')
        setCreating(false)
        return
      }
      if (!description && !imageFile) {
        setCreateError('Please provide a description or attach an image')
        setCreating(false)
        return
      }

      const formData = new FormData()
      formData.append('type', createForm.type)
      formData.append('title', title)
      formData.append('description', description)
      if (createForm.repoFullName) formData.append('repoFullName', createForm.repoFullName)
      if (imageFile) formData.append('image', imageFile)

      await api.createTicket(formData)
      setShowCreate(false)
      setCreateForm({ type: 'bug', title: '', description: '', repoFullName: '' })
      clearImage()
      setShowToast(true)
      fetchTickets()
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create ticket')
    } finally {
      setCreating(false)
    }
  }

  const handleOpenDetail = (ticket: Ticket) => {
    markViewed(ticket.id)
    setDetailTicket(ticket)
  }

  const filteredTickets = tickets.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    return true
  })

  const currentAccess = createForm.type === 'bug' ? bugAccess : featureAccess
  const canSubmit = bugAccess !== 'none' || featureAccess !== 'none'

  const descriptionLength = createForm.description.length
  const showShortWarning = createForm.type === 'feature' && descriptionLength > 0 && descriptionLength < 50

  // ── Detail View ──
  if (detailTicket) {
    return (
      <TicketDetailView
        ticket={detailTicket}
        isAdmin={isAdmin}
        onBack={() => setDetailTicket(null)}
        onRefresh={fetchTickets}
      />
    )
  }

  // ── List View ──
  return (
    <div className="max-w-4xl">
      {/* Toast */}
      {showToast && <SubmissionToast onDismiss={() => setShowToast(false)} />}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bug className="w-8 h-8 text-red-400" />
            Tickets
            <span className="text-sm font-normal text-gray-500 ml-2">({filteredTickets.length})</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Bug reports & feature requests
            {(bugAccess !== 'none' || featureAccess !== 'none') && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                🐛 <span className={bugAccess === 'execute' ? 'text-violet-400' : bugAccess === 'submit' ? 'text-green-400' : 'text-gray-600'}>{bugAccess}</span>
                {' · '}
                💡 <span className={featureAccess === 'execute' ? 'text-violet-400' : featureAccess === 'submit' ? 'text-green-400' : 'text-gray-600'}>{featureAccess}</span>
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
      <div className="flex items-center gap-3 mb-6 flex-wrap">
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
          {['all', 'submitted', 'flagged', 'in_progress', 'completed', 'closed'].map(s => (
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
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} onPaste={handlePaste}>
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
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Title <span className="text-gray-600">(optional for bugs)</span>
                </label>
                <input
                  value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder={createForm.type === 'bug' ? 'Auto-generated if left blank' : 'e.g., Add dark mode support'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                  required={createForm.type === 'feature'}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-400">
                    Description <span className="text-gray-600">{createForm.type === 'bug' ? '(optional if image provided)' : '*'}</span>
                  </label>
                  <span className={`text-[10px] ${descriptionLength > 0 ? 'text-gray-500' : 'text-gray-700'}`}>
                    {descriptionLength} characters
                  </span>
                </div>
                <textarea
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder={createForm.type === 'bug'
                    ? 'Paste text or just attach a screenshot...'
                    : 'Describe what you want — what problem does it solve? Who would use it?'
                  }
                  rows={5}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none"
                  required={createForm.type === 'feature' || (!imageFile && !createForm.description)}
                />
                {/* Short description warning */}
                {showShortWarning && (
                  <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-amber-900/20 border border-amber-800/40">
                    <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-amber-300/80">A more detailed description helps us understand your vision better</span>
                  </div>
                )}
              </div>

              {/* Tips panel for feature requests */}
              {createForm.type === 'feature' && (
                <div className="bg-amber-900/10 border border-amber-800/30 rounded-lg p-3.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-amber-300">Tips for a great feature request</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-amber-200/60">
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">•</span>
                      Describe what you want to accomplish, not how to build it
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">•</span>
                      Include who would use this feature
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">•</span>
                      Attach sketches or screenshots if you have them
                    </li>
                  </ul>
                </div>
              )}

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
              {currentAccess === 'execute' && (
                <div className="bg-violet-900/20 border border-violet-800/50 rounded-lg p-3 text-sm text-violet-300 flex items-center gap-2">
                  <Zap className="w-4 h-4 flex-shrink-0" />
                  <span>You have <strong>execute</strong> access for {createForm.type === 'bug' ? 'bugs' : 'features'} — Synthia will start working on this automatically.</span>
                </div>
              )}
              {currentAccess === 'submit' && (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 text-sm text-blue-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>You have <strong>submit</strong> access for {createForm.type === 'bug' ? 'bugs' : 'features'} — the admin will be notified.</span>
                </div>
              )}
              {currentAccess === 'none' && (
                <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 text-sm text-red-300 flex items-center gap-2">
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  <span>You don't have access to submit {createForm.type === 'bug' ? 'bug reports' : 'feature requests'}.</span>
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
                  disabled={creating || currentAccess === 'none'}
                  className="flex-1 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  ) : currentAccess === 'none' ? (
                    <>No Access</>
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
              onToggle={() => {
                if (expandedId !== ticket.id) {
                  markViewed(ticket.id)
                }
                setExpandedId(expandedId === ticket.id ? null : ticket.id)
              }}
              onOpenDetail={() => handleOpenDetail(ticket)}
              isNew={hasNewActivity(ticket)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
