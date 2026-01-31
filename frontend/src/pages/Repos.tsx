import { useEffect, useState } from 'react'
import { FolderGit2 } from 'lucide-react'
import { api } from '../services/api'
import type { RepoStatus } from '../services/api'
import RepoCard from '../components/RepoCard'

export default function Repos() {
  const [repos, setRepos] = useState<RepoStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const data = await api.getRepos()
        setRepos(data)
      } catch (err) {
        setError('Failed to load repos. Make sure you are logged in.')
      } finally {
        setLoading(false)
      }
    }
    fetchRepos()
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <FolderGit2 className="w-8 h-8 text-violet-400" />
          Repos
        </h1>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
              <div className="h-5 bg-gray-800 rounded w-1/4 mb-3"></div>
              <div className="h-3 bg-gray-800 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <FolderGit2 className="w-8 h-8 text-violet-400" />
        Repos
        <span className="text-sm font-normal text-gray-500 ml-2">({repos.length})</span>
      </h1>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-6 text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {repos.map(repo => (
          <RepoCard key={repo.fullName} repo={repo} />
        ))}
      </div>
    </div>
  )
}
