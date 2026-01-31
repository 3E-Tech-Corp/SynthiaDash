import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Rocket, CheckCircle2, XCircle, Loader2, Clock, Bot, Wrench } from 'lucide-react'
import { api } from '../services/api'
import type { DeployInfo, AgentTask } from '../services/api'

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'success': return <CheckCircle2 className="w-5 h-5 text-green-400" />
    case 'failure': return <XCircle className="w-5 h-5 text-red-400" />
    case 'in_progress':
    case 'queued': return <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
    default: return <Clock className="w-5 h-5 text-gray-500" />
  }
}

export default function RepoDetail() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const [deploys, setDeploys] = useState<DeployInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [fixingErrors, setFixingErrors] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<AgentTask | null>(null)

  const fetchDeploys = async () => {
    if (!owner || !repo) return
    try {
      const data = await api.getDeploys(owner, repo)
      setDeploys(data)
    } catch {
      // handle error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeploys()
  }, [owner, repo])

  // Poll for task status when there's an active task
  useEffect(() => {
    if (!activeTask || activeTask.status === 'completed' || activeTask.status === 'failed') return
    const interval = setInterval(async () => {
      try {
        const updated = await api.getTask(activeTask.id)
        setActiveTask(updated)
        if (updated.status === 'completed' || updated.status === 'failed') {
          setMessage(updated.status === 'completed' 
            ? '✅ Agent finished fixing errors!' 
            : '❌ Agent task failed')
        }
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [activeTask])

  const handleFixErrors = async () => {
    if (!owner || !repo) return
    setFixingErrors(true)
    setMessage(null)
    try {
      const task = await api.createTask(`${owner}/${repo}`)
      setActiveTask(task)
      setMessage('🤖 Agent triggered! Synthia is analyzing errors...')
    } catch (err: any) {
      setMessage('Failed to trigger error fix. Make sure ErrorMessage.md exists in the repo.')
    } finally {
      setFixingErrors(false)
    }
  }

  const handleDeploy = async () => {
    if (!owner || !repo) return
    setDeploying(true)
    setMessage(null)
    try {
      const result = await api.triggerDeploy(owner, repo)
      setMessage(result.message)
      // Refresh deploys after a short delay
      setTimeout(fetchDeploys, 5000)
    } catch {
      setMessage('Failed to trigger deploy')
    } finally {
      setDeploying(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <Link to="/repos" className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Repos
      </Link>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">
          <span className="text-gray-500">{owner}/</span>{repo}
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleFixErrors}
            disabled={fixingErrors || (activeTask?.status === 'running')}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            {fixingErrors || activeTask?.status === 'running' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wrench className="w-4 h-4" />
            )}
            Fix Errors
          </button>
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            {deploying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            Deploy
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-violet-900/30 border border-violet-800 rounded-lg p-4 mb-6 text-violet-300">
          {message}
        </div>
      )}

      {/* Active Agent Task */}
      {activeTask && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold">Agent Task</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTask.status === 'running' ? 'bg-yellow-900/50 text-yellow-400' :
              activeTask.status === 'completed' ? 'bg-green-900/50 text-green-400' :
              activeTask.status === 'failed' ? 'bg-red-900/50 text-red-400' :
              'bg-blue-900/50 text-blue-400'
            }`}>
              {activeTask.status}
            </span>
          </div>
          {activeTask.status === 'running' && (
            <div className="flex items-center gap-2 text-sm text-yellow-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Synthia is analyzing and fixing errors...
            </div>
          )}
          {activeTask.result && (
            <div className="mt-3 bg-gray-800/50 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap">
              {activeTask.result}
            </div>
          )}
          {activeTask.prUrl && (
            <a
              href={activeTask.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-violet-400 hover:text-violet-300 text-sm"
            >
              View PR →
            </a>
          )}
        </div>
      )}

      <h2 className="text-xl font-semibold mb-4">Deploy History</h2>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : deploys.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
          No deploys yet
        </div>
      ) : (
        <div className="space-y-3">
          {deploys.map(deploy => (
            <div
              key={deploy.runId}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-4"
            >
              <StatusIcon status={deploy.status} />
              <div className="flex-1">
                <p className="font-medium text-sm">{deploy.commitMessage || 'Deploy'}</p>
                <p className="text-xs text-gray-500">
                  {deploy.commit && <span className="font-mono mr-3">{deploy.commit}</span>}
                  {deploy.startedAt && new Date(deploy.startedAt).toLocaleString()}
                  {deploy.durationSeconds != null && ` · ${deploy.durationSeconds}s`}
                </p>
              </div>
              <a
                href={`https://github.com/${owner}/${repo}/actions/runs/${deploy.runId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-violet-400 transition-colors"
              >
                View →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
