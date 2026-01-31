import { Link } from 'react-router-dom'
import { GitBranch, Lock, Globe, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { RepoStatus } from '../services/api'

interface Props {
  repo: RepoStatus
}

function DeployBadge({ status }: { status: string }) {
  switch (status) {
    case 'success':
      return <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle2 className="w-3 h-3" /> Success</span>
    case 'failure':
      return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3 h-3" /> Failed</span>
    case 'in_progress':
    case 'queued':
      return <span className="flex items-center gap-1 text-yellow-400 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Running</span>
    default:
      return <span className="text-gray-500 text-xs">{status}</span>
  }
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

export default function RepoCard({ repo }: Props) {
  const [owner, name] = repo.fullName.split('/')

  return (
    <Link
      to={`/repos/${owner}/${name}`}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-violet-700 transition-colors block"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-100 flex items-center gap-2">
          {repo.private ? <Lock className="w-4 h-4 text-yellow-500" /> : <Globe className="w-4 h-4 text-green-500" />}
          {repo.name}
        </h3>
        {repo.lastDeploy && <DeployBadge status={repo.lastDeploy.status} />}
      </div>

      <div className="text-xs text-gray-500 flex items-center gap-4">
        <span className="flex items-center gap-1">
          <GitBranch className="w-3 h-3" />
          {repo.defaultBranch}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(repo.lastPush)}
        </span>
        {repo.lastDeploy?.commit && (
          <span className="font-mono">{repo.lastDeploy.commit}</span>
        )}
      </div>
    </Link>
  )
}
