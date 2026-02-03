import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Bug, Users, TicketCheck, Bot,
  Clock, CheckCircle, PlayCircle, XCircle, Loader2,
  Package, ArrowRight, AlertCircle,
  ExternalLink
} from 'lucide-react'
import StatusCard from '../components/StatusCard'
import { api } from '../services/api'
import type { Ticket, AgentTask, User } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import AnimatedLogo from '../components/AnimatedLogo'

// ── Helpers ──────────────────────────────────────────────

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

// ── Stat Card ────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  color: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${onClick ? 'cursor-pointer hover:border-gray-700' : ''} transition-colors`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-gray-800`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

// ── Ticket Status Badge ──────────────────────────────────

const TICKET_STATUS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  submitted: { icon: Clock, color: 'text-yellow-400', label: 'Submitted' },
  flagged: { icon: AlertCircle, color: 'text-orange-400', label: 'Flagged' },
  in_progress: { icon: PlayCircle, color: 'text-blue-400', label: 'In Progress' },
  completed: { icon: CheckCircle, color: 'text-green-400', label: 'Completed' },
  closed: { icon: XCircle, color: 'text-gray-500', label: 'Closed' },
}

function TicketStatusBadge({ status }: { status: string }) {
  const config = TICKET_STATUS[status] || TICKET_STATUS.submitted
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 ${config.color}`}>
      <Icon className="w-3 h-3" /> {config.label}
    </span>
  )
}

// ── Task Status Badge ────────────────────────────────────

function TaskStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    completed: { icon: CheckCircle, color: 'text-green-400', label: 'Completed' },
    failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
    running: { icon: Loader2, color: 'text-yellow-400', label: 'Running' },
    pending: { icon: Clock, color: 'text-blue-400', label: 'Pending' },
  }
  const config = configs[status] || { icon: Clock, color: 'text-gray-400', label: status }
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 ${config.color}`}>
      <Icon className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`} /> {config.label}
    </span>
  )
}

// ── Main Dashboard ───────────────────────────────────────

export default function Dashboard() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'closed'>('all')

  useEffect(() => {
    const load = async () => {
      try {
        const [ticketData, taskData] = await Promise.all([
          api.getTickets(50),
          api.getTasks(50),
        ])
        setTickets(ticketData)
        setTasks(taskData)

        if (isAdmin) {
          try {
            const userData = await api.getUsers()
            setUsers(userData)
          } catch {
            // non-critical
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isAdmin])

  // Computed stats
  const openStatuses = ['submitted', 'flagged', 'in_progress']
  const openTickets = tickets.filter(t => openStatuses.includes(t.status))
  const closedTickets = tickets.filter(t => t.status === 'closed' || t.status === 'completed')

  const tasksByStatus = {
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  }

  // Filtered tickets for the table
  const filteredTickets = ticketFilter === 'all'
    ? tickets
    : ticketFilter === 'open'
      ? openTickets
      : closedTickets

  const recentTickets = filteredTickets.slice(0, 10)
  const recentTasks = tasks.slice(0, 10)

  if (loading) {
    return (
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <Zap className="w-8 h-8 text-violet-400" />
          Mission Control
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-gray-800 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden mb-8">
        <img
          src="/images/dashboard-hero.png"
          alt="Mission Control"
          className="w-full h-40 md:h-52 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/90 via-gray-950/60 to-transparent flex items-center px-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <AnimatedLogo className="h-12" interval={10000} />
              <h1 className="text-3xl font-bold text-white">Mission Control</h1>
              {isAdmin && <span className="text-xs font-medium text-violet-300 bg-violet-900/50 px-2 py-1 rounded-full">Admin</span>}
            </div>
            <p className="text-gray-400 text-sm">Monitor deployments, manage tickets, and track agent tasks</p>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className="mb-6">
        <StatusCard />
      </div>

      {/* ── Summary Stats ──────────────────────────────── */}
      <div className={`grid gap-4 mb-8 ${isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
        <StatCard
          icon={TicketCheck}
          label="Open Tickets"
          value={openTickets.length}
          sub={`${closedTickets.length} closed`}
          color="text-yellow-400"
          onClick={() => navigate('/tickets')}
        />
        <StatCard
          icon={Bot}
          label="Agent Tasks"
          value={tasks.length}
          sub={tasksByStatus.running > 0
            ? `${tasksByStatus.running} running`
            : tasksByStatus.failed > 0
              ? `${tasksByStatus.failed} failed`
              : `${tasksByStatus.completed} completed`}
          color="text-violet-400"
          onClick={() => navigate('/tasks')}
        />
        {isAdmin && (
          <StatCard
            icon={Users}
            label="Users"
            value={users.length}
            sub={`${users.filter(u => u.isActive).length} active`}
            color="text-blue-400"
            onClick={() => navigate('/users')}
          />
        )}
        <StatCard
          icon={Bug}
          label="Bugs"
          value={tickets.filter(t => t.type === 'bug').length}
          sub={`${tickets.filter(t => t.type === 'feature').length} feature requests`}
          color="text-red-400"
          onClick={() => navigate('/tickets')}
        />
      </div>

      {/* ── Quick Actions ──────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/repos"
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-2">📦</div>
            <div className="text-sm font-medium">Repos</div>
            <div className="text-xs text-gray-500">View & deploy</div>
          </a>
          <a
            href="/tickets"
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-2">🎫</div>
            <div className="text-sm font-medium">Tickets</div>
            <div className="text-xs text-gray-500">Bugs & features</div>
          </a>
          <a
            href="/tasks"
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-2">🤖</div>
            <div className="text-sm font-medium">Tasks</div>
            <div className="text-xs text-gray-500">Agent runs</div>
          </a>
          <a
            href="/projects"
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-2">🏗️</div>
            <div className="text-sm font-medium">Projects</div>
            <div className="text-xs text-gray-500">Manage projects</div>
          </a>
        </div>
      </div>

      {/* ── Recent Tickets ─────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TicketCheck className="w-5 h-5 text-yellow-400" />
            Recent Tickets
          </h2>
          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="flex rounded-lg overflow-hidden border border-gray-800 mr-2">
              {(['all', 'open', 'closed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTicketFilter(f)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    ticketFilter === f ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {f === 'all' ? `All (${tickets.length})` : f === 'open' ? `Open (${openTickets.length})` : `Closed (${closedTickets.length})`}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate('/tickets')}
              className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {recentTickets.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <TicketCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tickets found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentTickets.map(ticket => (
              <div
                key={ticket.id}
                onClick={() => navigate('/tickets')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800/60 cursor-pointer transition-colors group"
              >
                {/* Type icon */}
                <span className="text-lg flex-shrink-0" title={ticket.type}>
                  {ticket.type === 'bug' ? '🐛' : '💡'}
                </span>

                {/* Title + submitter */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200 truncate">{ticket.title}</span>
                  </div>
                  {isAdmin && (
                    <span className="text-xs text-gray-500">
                      {ticket.userDisplayName || ticket.userEmail || `User #${ticket.userId}`}
                      {ticket.repoFullName && <span className="ml-2 text-gray-600 font-mono">{ticket.repoFullName}</span>}
                    </span>
                  )}
                </div>

                {/* Status badge */}
                <TicketStatusBadge status={ticket.status} />

                {/* Time */}
                <span className="text-xs text-gray-600 flex-shrink-0 w-16 text-right">{timeAgo(ticket.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Tasks ───────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-400" />
            Recent Tasks
          </h2>
          <button
            onClick={() => navigate('/tasks')}
            className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tasks yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentTasks.map(task => (
              <div
                key={task.id}
                onClick={() => navigate('/tasks')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800/60 cursor-pointer transition-colors group"
              >
                {/* Repo icon */}
                <Package className="w-4 h-4 text-gray-600 flex-shrink-0" />

                {/* Repo name + result preview */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-200 font-mono">{task.repoFullName}</span>
                  {task.result && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{task.result.slice(0, 120)}</p>
                  )}
                  {task.prUrl && (
                    <span className="text-xs text-violet-400 flex items-center gap-1 mt-0.5">
                      <ExternalLink className="w-3 h-3" /> PR created
                    </span>
                  )}
                </div>

                {/* Status */}
                <TaskStatusBadge status={task.status} />

                {/* Time */}
                <span className="text-xs text-gray-600 flex-shrink-0 w-16 text-right">{timeAgo(task.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
