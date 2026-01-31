import { useEffect, useState } from 'react'
import { Bot, Clock, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react'
import { api } from '../services/api'
import type { AgentTask } from '../services/api'

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <span className="flex items-center gap-1 text-green-400 text-sm font-medium"><CheckCircle2 className="w-4 h-4" /> Completed</span>
    case 'failed':
      return <span className="flex items-center gap-1 text-red-400 text-sm font-medium"><XCircle className="w-4 h-4" /> Failed</span>
    case 'running':
      return <span className="flex items-center gap-1 text-yellow-400 text-sm font-medium"><Loader2 className="w-4 h-4 animate-spin" /> Running</span>
    case 'pending':
      return <span className="flex items-center gap-1 text-blue-400 text-sm font-medium"><Clock className="w-4 h-4" /> Pending</span>
    default:
      return <span className="text-gray-400 text-sm">{status}</span>
  }
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

export default function Tasks() {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  const fetchTasks = async () => {
    try {
      const data = await api.getTasks()
      setTasks(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
    // Poll every 10s for running tasks
    const interval = setInterval(fetchTasks, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <Bot className="w-8 h-8 text-violet-400" />
          Agent Tasks
        </h1>
        <div className="animate-pulse space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="h-5 bg-gray-800 rounded w-1/3 mb-3"></div>
              <div className="h-3 bg-gray-800 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Bot className="w-8 h-8 text-violet-400" />
        Agent Tasks
        <span className="text-sm font-normal text-gray-500 ml-2">({tasks.length})</span>
      </h1>

      {tasks.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          No tasks yet. Go to a repo and click "Fix Errors" to create one.
        </div>
      )}

      <div className="space-y-4">
        {tasks.map(task => (
          <div
            key={task.id}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-100">{task.repoFullName}</h3>
                <StatusBadge status={task.status} />
              </div>
              <span className="text-xs text-gray-500">{timeAgo(task.createdAt)}</span>
            </div>

            {/* Result */}
            {task.result && (
              <div className="mt-3 bg-gray-800/50 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap">
                {task.result}
              </div>
            )}

            {task.prUrl && (
              <a
                href={task.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-violet-400 hover:text-violet-300 text-sm"
              >
                <ExternalLink className="w-3 h-3" /> View PR
              </a>
            )}

            {/* Expandable error content */}
            {task.errorContent && (
              <button
                onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                className="mt-3 text-xs text-gray-500 hover:text-gray-300"
              >
                {expandedTask === task.id ? 'Hide' : 'Show'} error details
              </button>
            )}
            {expandedTask === task.id && task.errorContent && (
              <pre className="mt-2 bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-400 overflow-x-auto max-h-96 overflow-y-auto">
                {task.errorContent}
              </pre>
            )}

            {task.completedAt && (
              <div className="mt-2 text-xs text-gray-600">
                Completed {timeAgo(task.completedAt)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
