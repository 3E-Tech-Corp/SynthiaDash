import { useEffect, useState } from 'react'
import { CheckCircle, Circle, Clock, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

interface TodoItem {
  text: string
  project: string
  done: boolean
}

interface TodoCategory {
  category: string
  items: TodoItem[]
}

interface CompletedItem {
  text: string
  project: string
  completedAt: string
}

interface TodoData {
  lastUpdated: string
  updatedBy: string
  priorities: TodoCategory[]
  recentlyCompleted: CompletedItem[]
}

export default function TodoPanel() {
  const [data, setData] = useState<TodoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const loadTodos = async () => {
    try {
      setLoading(true)
      const response = await fetch('/todos.json?t=' + Date.now())
      if (!response.ok) throw new Error('Failed to load')
      const json = await response.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError('Failed to load todos')
      console.error('Error loading todos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTodos()
  }, [])

  const getCategoryIcon = (category: string) => {
    if (category.includes('Critical')) return <AlertTriangle className="w-4 h-4 text-red-400" />
    if (category.includes('High')) return <Clock className="w-4 h-4 text-orange-400" />
    if (category.includes('Medium')) return <Circle className="w-4 h-4 text-yellow-400" />
    if (category.includes('Security')) return <AlertTriangle className="w-4 h-4 text-purple-400" />
    return <Circle className="w-4 h-4 text-gray-400" />
  }

  const getProjectBadgeColor = (project: string) => {
    const colors: Record<string, string> = {
      'Pickleball': 'bg-green-900/50 text-green-400',
      'CASEC': 'bg-red-900/50 text-red-400',
      'Lawfirm': 'bg-blue-900/50 text-blue-400',
      'All': 'bg-purple-900/50 text-purple-400',
    }
    return colors[project] || 'bg-gray-800 text-gray-400'
  }

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{error || 'No todos loaded'}</p>
          <button
            onClick={loadTodos}
            className="mt-3 text-xs text-violet-400 hover:text-violet-300"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const totalItems = data.priorities.reduce((acc, cat) => acc + cat.items.length, 0)
  const doneItems = data.priorities.reduce((acc, cat) => acc + cat.items.filter(i => i.done).length, 0)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            📋 Todo List
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {doneItems}/{totalItems} done • Updated {new Date(data.lastUpdated).toLocaleDateString()} by {data.updatedBy}
          </p>
        </div>
        <button
          onClick={loadTodos}
          className="p-2 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Priority Categories */}
      <div className="space-y-4">
        {data.priorities.map((category, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-2 mb-2">
              {getCategoryIcon(category.category)}
              <span className="text-sm font-medium text-gray-300">{category.category}</span>
              <span className="text-xs text-gray-600">({category.items.length})</span>
            </div>
            <div className="space-y-1 ml-6">
              {category.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${
                    item.done ? 'opacity-50' : 'hover:bg-gray-800/50'
                  }`}
                >
                  {item.done ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  )}
                  <span className={`text-sm flex-1 ${item.done ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                    {item.text}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${getProjectBadgeColor(item.project)}`}>
                    {item.project}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recently Completed */}
      {data.recentlyCompleted.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-800">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 w-full"
          >
            {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>Recently Completed ({data.recentlyCompleted.length})</span>
          </button>
          
          {showCompleted && (
            <div className="mt-3 space-y-1">
              {data.recentlyCompleted.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 py-1.5 px-2 rounded-lg opacity-60">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-400 line-through flex-1">{item.text}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${getProjectBadgeColor(item.project)}`}>
                    {item.project}
                  </span>
                  <span className="text-xs text-gray-600">{item.completedAt}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
