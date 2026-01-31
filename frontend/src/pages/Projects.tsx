import { useEffect, useState } from 'react'
import {
  Rocket, Plus, X, Loader2, CheckCircle, XCircle, Clock,
  Globe, Database, FolderGit2, ExternalLink, RefreshCw
} from 'lucide-react'
import { api } from '../services/api'
import type { Project } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-900/20', label: 'Pending' },
  provisioning: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-900/20', label: 'Provisioning' },
  ready: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-900/20', label: 'Ready' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-900/20', label: 'Failed' },
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

function ProjectCard({ project, onRefresh }: { project: Project; onRefresh: () => void }) {
  const config = STATUS_CONFIG[project.status] || STATUS_CONFIG.pending
  const StatusIcon = config.icon

  return (
    <div className={`bg-gray-900 border rounded-xl p-5 ${
      project.status === 'failed' ? 'border-red-900/50' :
      project.status === 'ready' ? 'border-green-900/50' :
      project.status === 'provisioning' ? 'border-blue-900/50' :
      'border-gray-800'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            {project.name}
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
              <StatusIcon className={`w-3 h-3 ${project.status === 'provisioning' ? 'animate-spin' : ''}`} />
              {config.label}
            </span>
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{project.slug}</p>
        </div>
        {project.status === 'provisioning' && (
          <button
            onClick={onRefresh}
            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Globe className="w-4 h-4 text-gray-600" />
          {project.status === 'ready' ? (
            <a
              href={`https://${project.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {project.domain} <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-gray-400">{project.domain}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <FolderGit2 className="w-4 h-4 text-gray-600" />
          <a
            href={`https://github.com/${project.repoFullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            {project.repoFullName} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Database className="w-4 h-4 text-gray-600" />
          <span className="text-gray-400 font-mono text-xs">{project.databaseName}</span>
        </div>
      </div>

      {project.statusDetail && (
        <div className={`mt-3 text-xs p-2.5 rounded-lg ${config.bg} ${config.color}`}>
          {project.statusDetail}
        </div>
      )}

      {project.error && (
        <div className="mt-3 text-xs p-2.5 rounded-lg bg-red-900/20 text-red-400">
          ❌ {project.error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <span>Created {timeAgo(project.createdAt)}</span>
        {project.readyAt && <span>Ready {timeAgo(project.readyAt)}</span>}
        {project.createdByEmail && <span>by {project.createdByEmail}</span>}
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const { isAdmin } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    domain: '',
    baseDomain: 'pickleball.community',
  })

  useEffect(() => {
    fetchProjects()
  }, [])

  // Auto-refresh provisioning projects
  useEffect(() => {
    const hasProvisioning = projects.some(p => p.status === 'provisioning')
    if (!hasProvisioning) return

    const interval = setInterval(fetchProjects, 5000)
    return () => clearInterval(interval)
  }, [projects])

  const fetchProjects = async () => {
    try {
      const data = await api.getProjects()
      setProjects(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate slug and domain from name
  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm({
      ...form,
      name,
      slug,
      domain: slug ? `${slug}.${form.baseDomain}` : '',
    })
  }

  const handleSlugChange = (slug: string) => {
    setForm({
      ...form,
      slug,
      domain: slug ? `${slug}.${form.baseDomain}` : '',
    })
  }

  const handleBaseDomainChange = (baseDomain: string) => {
    setForm({
      ...form,
      baseDomain,
      domain: form.slug ? `${form.slug}.${baseDomain}` : '',
    })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)

    try {
      await api.createProject({
        name: form.name || form.slug,
        slug: form.slug,
        domain: form.domain,
      })
      setShowCreate(false)
      setForm({ name: '', slug: '', domain: '', baseDomain: 'pickleball.community' })
      fetchProjects()
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create project')
    } finally {
      setCreating(false)
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
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Rocket className="w-8 h-8 text-emerald-400" />
            Projects
            <span className="text-sm font-normal text-gray-500 ml-2">({projects.length})</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">One-click project provisioning</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Rocket className="w-5 h-5 text-emerald-400" />
                New Project
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{createError}</div>
              )}

              {/* Project name */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Project Name</label>
                <input
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g., Demo App"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                  required
                  autoFocus
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Slug <span className="text-gray-600">(repo name + subdomain)</span>
                </label>
                <input
                  value={form.slug}
                  onChange={e => handleSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))}
                  placeholder="e.g., demo-app"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                  required
                  pattern="^[a-z0-9][a-z0-9\-]*[a-z0-9]$"
                />
              </div>

              {/* Base domain */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Base Domain</label>
                <select
                  value={form.baseDomain}
                  onChange={e => handleBaseDomainChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="pickleball.community">pickleball.community</option>
                  <option value="3eweb.com">3eweb.com</option>
                  <option value="funtimepb.com">funtimepb.com</option>
                </select>
              </div>

              {/* Preview */}
              {form.slug && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase">Will Create</h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-300">Repo: <span className="text-white font-mono">3E-Tech-Corp/{form.slug}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-300">URL: <span className="text-emerald-400">{form.domain}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-300">DB: <span className="text-white font-mono">{form.slug}_DB</span></span>
                    </div>
                  </div>
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
                  className="flex-1 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                  ) : (
                    <><Rocket className="w-4 h-4" /> Create & Provision</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
              <div className="h-5 bg-gray-800 rounded w-1/3 mb-3"></div>
              <div className="h-3 bg-gray-800 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Rocket className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No projects yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Create your first project →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} onRefresh={fetchProjects} />
          ))}
        </div>
      )}
    </div>
  )
}
