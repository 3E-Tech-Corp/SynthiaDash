import { useEffect, useState } from 'react'
import {
  Rocket, Plus, Loader2, CheckCircle, XCircle, Clock,
  Globe, Database, FolderGit2, ExternalLink, RefreshCw,
  ArrowLeft, Upload, Info, Users, UserPlus, Trash2,
  Link, ChevronDown, ChevronUp, Edit3, Save, X, Shield
} from 'lucide-react'
import { api } from '../services/api'
import type { Project, ProjectMember, User } from '../services/api'
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

const ROLE_COLORS: Record<string, string> = {
  owner: 'text-amber-400 bg-amber-900/20',
  developer: 'text-blue-400 bg-blue-900/20',
  viewer: 'text-gray-400 bg-gray-800',
}

const INHERIT_LABEL = '(inherit)'

function PermissionSelect({
  label,
  value,
  globalValue,
  options,
  onChange,
}: {
  label: string
  value: string | null | undefined
  globalValue: string | undefined
  options: { value: string; label: string }[]
  onChange: (val: string | null) => void
}) {
  const effective = value ?? globalValue ?? 'none'
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 w-16 flex-shrink-0">{label}</span>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
        className="text-xs bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-300 min-w-[120px]"
      >
        <option value="">{INHERIT_LABEL}: {globalValue || 'none'}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {value == null && (
        <span className="text-xs text-gray-600 italic">= {effective}</span>
      )}
    </div>
  )
}

const TICKET_ACCESS_OPTIONS = [
  { value: 'none', label: 'none' },
  { value: 'submit', label: 'submit' },
  { value: 'execute', label: 'execute' },
]

const CHAT_ACCESS_OPTIONS = [
  { value: 'none', label: 'none' },
  { value: 'guide', label: 'guide' },
  { value: 'bug', label: 'bug' },
  { value: 'developer', label: 'developer' },
]

function MemberManagement({ project, isAdmin }: { project: Project; isAdmin: boolean }) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addUserId, setAddUserId] = useState<number>(0)
  const [addRole, setAddRole] = useState('developer')
  const [addError, setAddError] = useState<string | null>(null)
  const [expandedPerms, setExpandedPerms] = useState<number | null>(null)

  useEffect(() => {
    fetchMembers()
    if (isAdmin) fetchUsers()
  }, [project.id])

  const fetchMembers = async () => {
    try {
      const data = await api.getProjectMembers(project.id)
      setMembers(data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers()
      setAllUsers(data)
    } catch { /* ignore */ }
  }

  const handleAdd = async () => {
    if (!addUserId) return
    setAddError(null)
    try {
      await api.addProjectMember(project.id, addUserId, addRole)
      setShowAdd(false)
      setAddUserId(0)
      setAddRole('developer')
      fetchMembers()
    } catch (err: any) {
      setAddError(err.message || 'Failed to add member')
    }
  }

  const handleRemove = async (userId: number) => {
    try {
      await api.removeProjectMember(project.id, userId)
      fetchMembers()
    } catch { /* ignore */ }
  }

  const handleRoleChange = async (userId: number, role: string) => {
    try {
      await api.updateProjectMemberRole(project.id, userId, role)
      fetchMembers()
    } catch { /* ignore */ }
  }

  const handlePermissionChange = async (userId: number, field: 'bugAccess' | 'featureAccess' | 'chatAccess', value: string | null) => {
    try {
      const member = members.find(m => m.userId === userId)
      if (!member) return
      const perms = {
        bugAccess: field === 'bugAccess' ? value : member.bugAccess,
        featureAccess: field === 'featureAccess' ? value : member.featureAccess,
        chatAccess: field === 'chatAccess' ? value : member.chatAccess,
      }
      await api.updateProjectMemberPermissions(project.id, userId, perms)
      fetchMembers()
    } catch { /* ignore */ }
  }

  const nonMembers = allUsers.filter(u => !members.some(m => m.userId === u.id) && u.isActive)

  if (loading) return <div className="text-xs text-gray-600">Loading members...</div>

  return (
    <div className="mt-4 border-t border-gray-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Members ({members.length})
        </h4>
        {isAdmin && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      {/* Member list */}
      <div className="space-y-1.5">
        {members.map(m => (
          <div key={m.id}>
            <div className="flex items-center justify-between text-sm py-1 px-2 rounded-lg hover:bg-gray-800/50 group">
              <div className="flex items-center gap-2">
                <span className="text-gray-300">{m.userDisplayName || m.userEmail}</span>
                {m.userDisplayName && m.userEmail && (
                  <span className="text-xs text-gray-600">{m.userEmail}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => setExpandedPerms(expandedPerms === m.userId ? null : m.userId)}
                    className={`p-1 rounded transition-colors ${expandedPerms === m.userId ? 'text-violet-400 bg-violet-900/20' : 'text-gray-600 hover:text-gray-400'}`}
                    title="Per-project permissions"
                  >
                    <Shield className="w-3 h-3" />
                  </button>
                )}
                {isAdmin ? (
                  <select
                    value={m.role}
                    onChange={e => handleRoleChange(m.userId, e.target.value)}
                    className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${ROLE_COLORS[m.role] || ROLE_COLORS.viewer}`}
                    style={{ background: 'transparent' }}
                  >
                    <option value="owner">owner</option>
                    <option value="developer">developer</option>
                    <option value="viewer">viewer</option>
                  </select>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role] || ROLE_COLORS.viewer}`}>
                    {m.role}
                  </span>
                )}
                {isAdmin && members.filter(x => x.role === 'owner').length > 1 || m.role !== 'owner' ? (
                  <button
                    onClick={() => handleRemove(m.userId)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-all"
                    title="Remove member"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                ) : (
                  <div className="w-5" /> // spacer
                )}
              </div>
            </div>
            {/* Per-project permissions panel */}
            {isAdmin && expandedPerms === m.userId && (
              <div className="ml-4 mt-1 mb-2 p-2.5 bg-gray-800/40 border border-gray-700/50 rounded-lg space-y-1.5">
                <div className="text-xs text-gray-500 font-medium mb-1.5 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Project permissions
                </div>
                <PermissionSelect
                  label="Bug"
                  value={m.bugAccess}
                  globalValue={m.globalBugAccess}
                  options={TICKET_ACCESS_OPTIONS}
                  onChange={val => handlePermissionChange(m.userId, 'bugAccess', val)}
                />
                <PermissionSelect
                  label="Feature"
                  value={m.featureAccess}
                  globalValue={m.globalFeatureAccess}
                  options={TICKET_ACCESS_OPTIONS}
                  onChange={val => handlePermissionChange(m.userId, 'featureAccess', val)}
                />
                <PermissionSelect
                  label="Chat"
                  value={m.chatAccess}
                  globalValue={m.globalChatAccess}
                  options={CHAT_ACCESS_OPTIONS}
                  onChange={val => handlePermissionChange(m.userId, 'chatAccess', val)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add member form */}
      {showAdd && (
        <div className="mt-3 bg-gray-800/50 rounded-lg p-3 space-y-2">
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <div className="flex items-center gap-2">
            <select
              value={addUserId}
              onChange={e => setAddUserId(Number(e.target.value))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value={0}>Select user...</option>
              {nonMembers.map(u => (
                <option key={u.id} value={u.id}>{u.displayName || u.email} ({u.email})</option>
              ))}
            </select>
            <select
              value={addRole}
              onChange={e => setAddRole(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="developer">developer</option>
              <option value="viewer">viewer</option>
              <option value="owner">owner</option>
            </select>
            <button
              onClick={handleAdd}
              disabled={!addUserId}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded font-medium"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddError(null) }}
              className="p-1.5 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project, onRefresh, isAdmin }: { project: Project; onRefresh: () => void; isAdmin: boolean }) {
  const config = STATUS_CONFIG[project.status] || STATUS_CONFIG.pending
  const StatusIcon = config.icon
  const [deploying, setDeploying] = useState(false)
  const [deployConfirm, setDeployConfirm] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editRepo, setEditRepo] = useState(project.repoFullName)
  const [saving, setSaving] = useState(false)

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

  const handleSaveRepo = async () => {
    setSaving(true)
    try {
      await api.updateProject(project.id, { repoFullName: editRepo })
      setEditing(false)
      onRefresh()
    } catch { /* ignore */ } finally {
      setSaving(false)
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
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            title="Manage members"
          >
            <Users className="w-3 h-3" />
            {showMembers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
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
              {editing ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={editRepo}
                    onChange={e => setEditRepo(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white font-mono"
                    placeholder="owner/repo"
                  />
                  <button onClick={handleSaveRepo} disabled={saving} className="p-1 text-emerald-400 hover:text-emerald-300">
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setEditing(false); setEditRepo(project.repoFullName) }} className="p-1 text-gray-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <a
                    href={`https://github.com/${project.repoFullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {project.repoFullName} <ExternalLink className="w-3 h-3" />
                  </a>
                  <button onClick={() => setEditing(true)} className="p-1 text-gray-600 hover:text-gray-400" title="Edit repo link">
                    <Edit3 className="w-3 h-3" />
                  </button>
                </>
              )}
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

      {showMembers && <MemberManagement project={project} isAdmin={isAdmin} />}
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
    linkExisting: false,
    repoFullName: '',
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
        linkExisting: form.linkExisting,
        repoFullName: form.linkExisting ? form.repoFullName : undefined,
      })
      setShowCreate(false)
      setCreateStep('form')
      setForm({ name: '', slug: '', description: '', baseDomain: 'synthia.bot', linkExisting: false, repoFullName: '' })
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
    setForm({ name: '', slug: '', description: '', baseDomain: 'synthia.bot', linkExisting: false, repoFullName: '' })
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

                {/* Admin: Link Existing Repo toggle */}
                {isAdmin && (
                  <div className="bg-violet-900/20 border border-violet-800/50 rounded-lg p-4 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.linkExisting}
                        onChange={e => setForm({ ...form, linkExisting: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
                      />
                      <div>
                        <span className="text-sm text-violet-300 font-medium flex items-center gap-1.5">
                          <Link className="w-3.5 h-3.5" /> Link Existing Repository
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">Skip provisioning — just link an existing GitHub repo</p>
                      </div>
                    </label>
                    {form.linkExisting && (
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Repository Full Name</label>
                        <input
                          value={form.repoFullName}
                          onChange={e => setForm({ ...form, repoFullName: e.target.value })}
                          placeholder="e.g., 3E-Tech-Corp/existing-repo"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono placeholder-gray-600 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    )}
                  </div>
                )}

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
                        <span className="text-xs text-gray-500 w-20 flex-shrink-0">Mode</span>
                        <span className={`text-sm font-medium flex items-center gap-1.5 ${form.linkExisting ? 'text-violet-400' : 'text-emerald-400'}`}>
                          {form.linkExisting ? (
                            <><Link className="w-3.5 h-3.5" /> Link Existing Repo</>
                          ) : (
                            <><Rocket className="w-3.5 h-3.5" /> Provision New</>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-20 flex-shrink-0">Repo</span>
                        <span className="text-white font-mono flex items-center gap-1.5">
                          <FolderGit2 className="w-3.5 h-3.5 text-gray-500" />
                          {form.linkExisting ? form.repoFullName : `3E-Tech-Corp/${form.slug}`}
                        </span>
                      </div>
                      {!form.linkExisting && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">Database</span>
                          <span className="text-gray-400 font-mono text-sm flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-gray-500" />
                            Auto-assigned after creation
                          </span>
                        </div>
                      )}
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
                    <><Loader2 className="w-4 h-4 animate-spin" /> {form.linkExisting ? 'Linking...' : 'Creating...'}</>
                  ) : (
                    form.linkExisting ? <>🔗 Link Project</> : <>🚀 Create Project</>
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
