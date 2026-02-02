import { useEffect, useState } from 'react'
import {
  Rocket, Plus, Loader2, CheckCircle, XCircle, Clock,
  Globe, Database, FolderGit2, ExternalLink, RefreshCw,
  ArrowLeft, Upload, Info
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

function ProjectCard({ project, onRefresh, isAdmin }: { project: Project; onRefresh: () => void; isAdmin: boolean }) {
  const config = STATUS_CONFIG[project.status] || STATUS_CONFIG.pending
  const StatusIcon = config.icon
  const [deploying, setDeploying] = useState(false)
  const [deployConfirm, setDeployConfirm] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)

  const hasDeployed = project.statusDetail?.includes('deployed')

  const handleDeploy = async () => {
    setDeploying(true)
    setDeployError(null)
    try {
      await api.deployPlaceholder(project.id)
      setDeployConfirm(false)
      onRefresh()
    } catch (err: any) {
      setDeployError(err.message || 'Deployment failed')
    } finally {
      setDeploying(false)
    }
  }

  return (
    <div className={`bg-gray-900 border rounded-xl p-5 ${
      project.status === 'failed' ? 'border-red-900/50' :
      project.status === 'ready' ? 'border-green-900/50' :
      project.status === 'provisioning' ? 'border-blue-900/50' :
      'border-gray-800'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 flex-wrap">
            {project.name}
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
              <StatusIcon className={`w-3 h-3 ${project.status === 'provisioning' ? 'animate-spin' : ''}`} />
              {config.label}
            </span>
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{project.slug}</p>
          {project.description && (
            <p className="text-sm text-gray-400 mt-1.5">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          {project.status === 'ready' && !deployConfirm && (
            <button
              onClick={() => setDeployConfirm(true)}
              disabled={deploying}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                hasDeployed
                  ? 'border-gray-700 bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  : 'border-emerald-700 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
              }`}
              title={hasDeployed ? 'Redeploy Coming Soon page' : 'Deploy Coming Soon page'}
            >
              <Upload className="w-3 h-3" />
              {hasDeployed ? 'Redeploy' : 'Deploy'}
            </button>
          )}
          {deployConfirm && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Deploy Coming Soon?</span>
              <button
                onClick={handleDeploy}
                disabled={deploying}
                className="text-xs px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50"
              >
                {deploying ? '...' : 'Yes'}
              </button>
              <button
                onClick={() => { setDeployConfirm(false); setDeployError(null) }}
                className="text-xs px-2 py-1 rounded text-gray-500 hover:text-white hover:bg-gray-800"
              >
                No
              </button>
            </div>
          )}
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
        {isAdmin && (
          <>
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
          </>
        )}
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

      {deployError && (
        <div className="mt-3 text-xs p-2.5 rounded-lg bg-red-900/20 text-red-400">
          ❌ Deploy failed: {deployError}
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <span>Created {timeAgo(project.createdAt)}</span>
        {project.readyAt && <span>Ready {timeAgo(project.readyAt)}</span>}
        {isAdmin && project.createdByEmail && <span>by {project.createdByEmail}</span>}
      </div>
    </div>
  )
}

type CreateStep = 'form' | 'confirm'

export default function ProjectsPage() {
  const { user, isAdmin } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [createStep, setCreateStep] = useState<CreateStep>('form')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [slots, setSlots] = useState<{ used: number; max: number; remaining: number } | null>(null)
  const [viewTab, setViewTab] = useState<'mine' | 'all'>('mine')
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    baseDomain: 'synthia.bot',
  })

  useEffect(() => {
    fetchProjects()
    fetchSlots()
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

  const fetchSlots = async () => {
    try {
      const data = await api.getProjectSlots()
      setSlots(data)
    } catch {
      // ignore
    }
  }

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm({ ...form, name, slug })
  }

  const handleSlugChange = (slug: string) => {
    setForm({ ...form, slug })
  }

  const domain = form.slug ? `${form.slug}.${form.baseDomain}` : ''

  const handleCreate = async () => {
    setCreateError(null)
    setCreating(true)

    try {
      await api.createProject({
        name: form.name || form.slug,
        slug: form.slug,
        domain,
        description: form.description || undefined,
      })
      setShowCreate(false)
      setCreateStep('form')
      setForm({ name: '', slug: '', description: '', baseDomain: 'synthia.bot' })
      fetchProjects()
      fetchSlots()
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const handleCancelCreate = () => {
    setShowCreate(false)
    setCreateStep('form')
    setCreateError(null)
    setForm({ name: '', slug: '', description: '', baseDomain: 'synthia.bot' })
  }

  const isUnlimited = isAdmin || (slots && slots.max >= 999)
  const canCreate = isUnlimited || (slots && slots.remaining > 0)

  // Filter projects for admin view tabs
  const myProjects = projects.filter(p => p.createdByUserId === user?.id)
  const displayProjects = isAdmin && viewTab === 'all' ? projects : (isAdmin ? myProjects : projects)

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Rocket className="w-8 h-8 text-emerald-400" />
            Projects
            <span className="text-sm font-normal text-gray-500 ml-2">({displayProjects.length})</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage your projects</p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            disabled={!canCreate}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        )}
      </div>

      {/* Slots info */}
      {slots && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-900/30 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-300">
                {isUnlimited ? (
                  <>You have <span className="text-emerald-400 font-semibold">unlimited</span> project slots</>
                ) : (
                  <>You have <span className="text-emerald-400 font-semibold">{slots.remaining}</span> of <span className="text-white font-semibold">{slots.max}</span> project slots remaining</>
                )}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{slots.used} project{slots.used !== 1 ? 's' : ''} created</p>
            </div>
          </div>
          {!canCreate && (
            <span className="text-xs text-amber-400 bg-amber-900/20 px-3 py-1.5 rounded-lg">Limit reached</span>
          )}
        </div>
      )}

      {/* Admin view tabs */}
      {isAdmin && !showCreate && (
        <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
          <button
            onClick={() => setViewTab('mine')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewTab === 'mine' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            My Projects
          </button>
          <button
            onClick={() => setViewTab('all')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewTab === 'all' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            All Projects ({projects.length})
          </button>
        </div>
      )}

      {/* Create Project Wizard */}
      {showCreate && (
        <div className="bg-gray-900 border border-emerald-900/50 rounded-2xl p-6 mb-6 shadow-lg">
          {createStep === 'form' ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-emerald-400" />
                  Create New Project
                </h2>
                <button
                  onClick={handleCancelCreate}
                  className="text-gray-500 hover:text-white text-sm px-3 py-1 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>

              {createError && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">{createError}</div>
              )}

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Project Title <span className="text-red-400">*</span></label>
                  <input
                    value={form.name}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="e.g., My Awesome App"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                    required
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Description <span className="text-gray-600">(optional but encouraged)</span></label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe what your project does..."
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                {/* Desired URL */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Desired URL
                  </label>
                  <div className="flex items-center gap-0">
                    <input
                      value={form.slug}
                      onChange={e => handleSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))}
                      placeholder="my-app"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-l-lg px-4 py-2.5 text-white font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                      required
                      pattern="^[a-z0-9][a-z0-9\-]*[a-z0-9]$"
                    />
                    <span className="bg-gray-700 border border-gray-700 rounded-r-lg px-4 py-2.5 text-gray-400 text-sm font-mono">
                      .{form.baseDomain}
                    </span>
                  </div>
                </div>

                {/* Info banner */}
                <div className="bg-indigo-900/20 border border-indigo-800/50 rounded-lg p-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-indigo-300">
                    💡 Once your project is built, you can use <span className="font-semibold text-indigo-200">Chat</span> to edit code, report bugs, or request features. Deploy your changes with one click when ready.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-5">
                <button
                  type="button"
                  onClick={handleCancelCreate}
                  className="flex-1 text-sm text-gray-500 hover:text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (form.name && form.slug) {
                      setCreateError(null)
                      setCreateStep('confirm')
                    }
                  }}
                  disabled={!form.name || !form.slug}
                  className="flex-1 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
                >
                  Next →
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-emerald-400" />
                  Confirm Project
                </h2>
                <button
                  onClick={handleCancelCreate}
                  className="text-gray-500 hover:text-white text-sm px-3 py-1 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>

              {createError && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">{createError}</div>
              )}

              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">This will be created as:</h4>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-500 w-20 flex-shrink-0 pt-0.5">Title</span>
                    <span className="text-white font-medium">{form.name}</span>
                  </div>
                  {form.description && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-500 w-20 flex-shrink-0 pt-0.5">Description</span>
                      <span className="text-gray-300">{form.description}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 flex-shrink-0">URL</span>
                    <span className="text-emerald-400 font-mono">{domain}</span>
                  </div>
                  {isAdmin && (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-20 flex-shrink-0">Repo</span>
                        <span className="text-white font-mono flex items-center gap-1.5">
                          <FolderGit2 className="w-3.5 h-3.5 text-gray-500" />
                          3E-Tech-Corp/{form.slug}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-20 flex-shrink-0">Database</span>
                        <span className="text-gray-400 font-mono text-sm flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-gray-500" />
                          Auto-assigned after creation
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => setCreateStep('form')}
                  className="flex-1 text-sm text-gray-400 hover:text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                  ) : (
                    <>🚀 Create Project</>
                  )}
                </button>
              </div>
            </>
          )}
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
      ) : displayProjects.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Rocket className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No projects yet.</p>
          {!showCreate && canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Create your first project →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayProjects.map(project => (
            <ProjectCard key={project.id} project={project} onRefresh={fetchProjects} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}
