import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import type { FeaturedProject, Project } from '../services/api'
import {
  Plus, Pencil, Trash2, X, Upload,
  ExternalLink, Eye, EyeOff, Save, Image as ImageIcon,
} from 'lucide-react'

export default function FeaturedProjectsAdmin() {
  const [items, setItems] = useState<FeaturedProject[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<FeaturedProject | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    url: '',
    projectId: 0,
    sortOrder: 0,
    isActive: true,
  })
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [featured, projs] = await Promise.all([
        api.getFeaturedProjectsAdmin(),
        api.getProjects().catch(() => [] as Project[]),
      ])
      setItems(featured)
      setProjects(projs)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', description: '', url: '', projectId: 0, sortOrder: items.length, isActive: true })
    setThumbnailPreview(null)
    setThumbnailFile(null)
    setShowModal(true)
  }

  const openEdit = (item: FeaturedProject) => {
    setEditing(item)
    setForm({
      title: item.title,
      description: item.description || '',
      url: item.url,
      projectId: item.projectId || 0,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    })
    setThumbnailPreview(item.thumbnailPath ? `/api/featuredprojects/${item.id}/thumbnail` : null)
    setThumbnailFile(null)
    setShowModal(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setThumbnailPreview(dataUrl)
      setThumbnailFile(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.url.trim()) {
      setError('Title and URL are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      let saved: FeaturedProject
      if (editing) {
        saved = await api.updateFeaturedProject(editing.id, {
          title: form.title,
          description: form.description || undefined,
          url: form.url,
          projectId: form.projectId || undefined,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        })
      } else {
        saved = await api.createFeaturedProject({
          title: form.title,
          description: form.description || undefined,
          url: form.url,
          projectId: form.projectId || undefined,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        })
      }

      // Upload thumbnail if changed
      if (thumbnailFile) {
        await api.uploadFeaturedThumbnail(saved.id, thumbnailFile)
      }

      setShowModal(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.deleteFeaturedProject(id)
      setDeleteConfirm(null)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleToggleActive = async (item: FeaturedProject) => {
    try {
      await api.updateFeaturedProject(item.id, { isActive: !item.isActive })
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const newItems = [...items]
    const temp = newItems[index].sortOrder
    newItems[index].sortOrder = newItems[index - 1].sortOrder
    newItems[index - 1].sortOrder = temp
    await api.reorderFeaturedProjects(newItems.map(i => ({ id: i.id, sortOrder: i.sortOrder })))
    await loadData()
  }

  const handleMoveDown = async (index: number) => {
    if (index >= items.length - 1) return
    const newItems = [...items]
    const temp = newItems[index].sortOrder
    newItems[index].sortOrder = newItems[index + 1].sortOrder
    newItems[index + 1].sortOrder = temp
    await api.reorderFeaturedProjects(newItems.map(i => ({ id: i.id, sortOrder: i.sortOrder })))
    await loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading featured projects...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Featured Projects</h1>
          <p className="text-gray-400 text-sm mt-1">Manage showcase projects on the landing page</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Featured
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No featured projects yet</p>
            <p className="text-sm mt-1">Add your first showcase project to display on the landing page</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left w-10">#</th>
                <th className="px-4 py-3 text-left w-16">Image</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">URL</th>
                <th className="px-4 py-3 text-center w-20">Active</th>
                <th className="px-4 py-3 text-center w-20">Order</th>
                <th className="px-4 py-3 text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="text-gray-600 hover:text-gray-300 disabled:opacity-20"
                        title="Move up"
                      >▲</button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index >= items.length - 1}
                        className="text-gray-600 hover:text-gray-300 disabled:opacity-20"
                        title="Move down"
                      >▼</button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.thumbnailPath ? (
                      <img
                        src={`/api/featuredprojects/${item.id}/thumbnail`}
                        alt={item.title}
                        className="w-12 h-12 rounded-lg object-cover border border-gray-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-gray-600" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{item.title}</div>
                    {item.description && (
                      <div className="text-gray-500 text-xs mt-0.5 line-clamp-1">{item.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:text-violet-300 text-sm flex items-center gap-1 truncate max-w-[200px]"
                    >
                      {item.url.replace(/^https?:\/\//, '')}
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        item.isActive
                          ? 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                          : 'text-gray-600 bg-gray-800 hover:bg-gray-700'
                      }`}
                      title={item.isActive ? 'Active — click to hide' : 'Hidden — click to activate'}
                    >
                      {item.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400 text-sm">
                    {item.sortOrder}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {deleteConfirm === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded text-white"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit Featured Project' : 'Add Featured Project'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Project name"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 resize-none"
                  placeholder="Brief description of the project"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL *</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={e => setForm({ ...form, url: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                  placeholder="https://example.com"
                />
              </div>

              {/* Project link (optional) */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Linked Project (optional)</label>
                <select
                  value={form.projectId}
                  onChange={e => setForm({ ...form, projectId: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value={0}>None</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.domain})</option>
                  ))}
                </select>
              </div>

              {/* Thumbnail */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Thumbnail</label>
                <div className="flex items-center gap-3">
                  {thumbnailPreview ? (
                    <img src={thumbnailPreview} alt="Preview" className="w-20 h-20 rounded-lg object-cover border border-gray-700" />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm transition-colors"
                    >
                      <Upload className="w-4 h-4" /> Upload Image
                    </button>
                    <p className="text-xs text-gray-600 mt-1">JPG, PNG, WebP. Max 5MB.</p>
                  </div>
                </div>
              </div>

              {/* Sort Order & Active */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Active</label>
                  <button
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      form.isActive
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-gray-800 border-gray-700 text-gray-500'
                    }`}
                  >
                    {form.isActive ? '✓ Active' : '○ Hidden'}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-800">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
