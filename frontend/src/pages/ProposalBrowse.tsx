import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Heart, MessageSquare, Search, Plus, Lightbulb } from 'lucide-react'
import { api, type ProposalListItem } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import AnimatedLogo from '../components/AnimatedLogo'

export default function ProposalBrowse() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [proposals, setProposals] = useState<ProposalListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    api.getProposals(page, 20, search || undefined)
      .then(setProposals)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, search])

  // Debounce search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <AnimatedLogo className="h-8 inline-block" interval={12000} />
            <span className="text-lg font-bold tracking-tight">ynthia.bot</span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/about')} className="text-gray-400 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors">
              About
            </button>
            {user ? (
              <button onClick={() => navigate('/')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors">
                Dashboard
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="text-gray-400 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors">
                  Sign In
                </button>
                <button onClick={() => navigate('/register')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors">
                  Join Free
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Project Proposals</h1>
              <p className="text-gray-400">Community-driven ideas for our next projects</p>
            </div>
            <button
              onClick={() => {
                if (user) navigate('/proposals/new')
                else navigate('/login')
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Propose a Project
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-violet-500 placeholder-gray-600"
              placeholder="Search proposals..."
            />
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-12 text-gray-500">Loading proposals...</div>
          )}

          {/* Empty state */}
          {!loading && proposals.length === 0 && (
            <div className="text-center py-16">
              <Lightbulb className="w-12 h-12 text-gray-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No proposals yet</h3>
              <p className="text-gray-500 mb-6">Be the first to propose a project idea!</p>
              <button
                onClick={() => user ? navigate('/proposals/new') : navigate('/register')}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-medium transition-colors"
              >
                {user ? 'Create Proposal' : 'Join Free & Propose'}
              </button>
            </div>
          )}

          {/* Proposals grid */}
          {!loading && proposals.length > 0 && (
            <div className="grid gap-4">
              {proposals.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/proposals/${p.shareToken}`)}
                  className="text-left bg-gray-900/60 border border-gray-800 rounded-xl p-5 hover:border-gray-700 hover:bg-gray-900 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold mb-2 group-hover:text-violet-300 transition-colors">
                        {p.title}
                      </h3>
                      {p.polishedDescription && (
                        <p className="text-gray-400 text-sm line-clamp-2 mb-3">
                          {p.polishedDescription}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5" /> {p.likeCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" /> {p.featureCount} features
                        </span>
                        <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && proposals.length >= 20 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm disabled:opacity-50 hover:bg-gray-800 transition-colors"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-500 text-sm">Page {page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm hover:bg-gray-800 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
