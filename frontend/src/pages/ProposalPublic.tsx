import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Heart, MessageSquarePlus, DollarSign, Send, LogIn, ArrowLeft } from 'lucide-react'
import { api, type ProposalPublicView, type ProposalFeature } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import AnimatedLogo from '../components/AnimatedLogo'

export default function ProposalPublic() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [proposal, setProposal] = useState<ProposalPublicView | null>(null)
  const [hasLiked, setHasLiked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Feature form
  const [showFeatureForm, setShowFeatureForm] = useState(false)
  const [featureDesc, setFeatureDesc] = useState('')
  const [featureAuthor, setFeatureAuthor] = useState('')
  const [featureLoading, setFeatureLoading] = useState(false)

  // Value estimate form
  const [showValueForm, setShowValueForm] = useState(false)
  const [wouldPay, setWouldPay] = useState(false)
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [valueLoading, setValueLoading] = useState(false)
  const [valueSubmitted, setValueSubmitted] = useState(false)

  useEffect(() => {
    if (!shareToken) return
    setLoading(true)
    api.getProposalByToken(shareToken)
      .then(data => {
        setProposal(data.proposal)
        setHasLiked(data.hasLiked)
      })
      .catch(() => setError('Proposal not found'))
      .finally(() => setLoading(false))
  }, [shareToken])

  const handleLike = async () => {
    if (!shareToken || !proposal) return
    try {
      const result = await api.likeProposal(shareToken)
      setHasLiked(result.liked)
      setProposal(prev => prev ? { ...prev, likeCount: result.likeCount } : null)
    } catch { /* ignore */ }
  }

  const handleAddFeature = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareToken || !featureDesc.trim()) return
    setFeatureLoading(true)
    try {
      const feature = await api.addProposalFeature(shareToken, featureDesc.trim(), featureAuthor.trim() || undefined)
      setProposal(prev => prev ? { ...prev, features: [...prev.features, feature] } : null)
      setFeatureDesc('')
      setFeatureAuthor('')
      setShowFeatureForm(false)
    } catch { /* ignore */ }
    setFeatureLoading(false)
  }

  const handleAddValue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareToken) return
    setValueLoading(true)
    try {
      await api.addProposalValue(shareToken, wouldPay, monthlyAmount ? parseFloat(monthlyAmount) : undefined)
      setValueSubmitted(true)
    } catch { /* ignore */ }
    setValueLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-white mb-2">Proposal Not Found</h2>
          <p className="text-gray-400 mb-6">This proposal may have been removed or the link is invalid.</p>
          <button onClick={() => navigate('/proposals')} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors">
            Browse Proposals
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <AnimatedLogo className="h-8 inline-block" interval={12000} />
            <span className="text-lg font-bold tracking-tight">ynthia.bot</span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/proposals')} className="text-gray-400 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors">
              All Proposals
            </button>
            {!user && (
              <button onClick={() => navigate('/register')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors">
                <LogIn className="w-4 h-4" />
                Join Free
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Back button */}
          <button onClick={() => navigate('/proposals')} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to proposals
          </button>

          {/* Title & Status */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                proposal.status === 'published' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                proposal.status === 'accepted' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                'bg-gray-500/10 text-gray-400 border border-gray-500/20'
              }`}>
                {proposal.status}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">{proposal.title}</h1>
            <p className="text-gray-500 text-sm">
              Proposed {new Date(proposal.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Description */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8 mb-6">
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {proposal.polishedDescription}
              </p>
            </div>
          </div>

          {/* Problem */}
          {proposal.problem && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Problem It Solves</h3>
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{proposal.problem}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                hasLiked
                  ? 'bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25'
                  : 'bg-gray-900 border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${hasLiked ? 'fill-red-400' : ''}`} />
              {proposal.likeCount} {proposal.likeCount === 1 ? 'Like' : 'Likes'}
            </button>

            <button
              onClick={() => setShowFeatureForm(f => !f)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-gray-900 border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white transition-all"
            >
              <MessageSquarePlus className="w-4 h-4" />
              Suggest Feature
            </button>

            <button
              onClick={() => setShowValueForm(f => !f)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-gray-900 border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white transition-all"
            >
              <DollarSign className="w-4 h-4" />
              Would You Pay?
            </button>
          </div>

          {/* Anonymous nudge */}
          {!user && (
            <div className="bg-violet-600/10 border border-violet-500/20 rounded-xl p-4 mb-6">
              <p className="text-sm text-violet-300">
                💡 <Link to="/register" className="underline hover:text-violet-200">Create a free account</Link> for more impact on project selection. Anonymous votes count at 30% weight.
              </p>
            </div>
          )}

          {/* Feature suggestion form */}
          {showFeatureForm && (
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 mb-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4 text-violet-400" />
                Suggest a Feature
              </h3>
              <form onSubmit={handleAddFeature} className="space-y-3">
                <textarea
                  value={featureDesc}
                  onChange={e => setFeatureDesc(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 min-h-[80px] resize-y"
                  placeholder="Describe a feature you'd like to see..."
                  required
                />
                {!user && (
                  <input
                    type="text"
                    value={featureAuthor}
                    onChange={e => setFeatureAuthor(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                    placeholder="Your name (optional)"
                  />
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={featureLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {featureLoading ? 'Adding...' : 'Add Suggestion'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Value estimate form */}
          {showValueForm && !valueSubmitted && (
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 mb-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                Would You Pay For This?
              </h3>
              <form onSubmit={handleAddValue} className="space-y-3">
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700 cursor-pointer hover:border-gray-600 flex-1">
                    <input type="radio" name="wouldPay" checked={wouldPay} onChange={() => setWouldPay(true)} className="accent-violet-500" />
                    <span className="text-sm">Yes, I'd pay</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700 cursor-pointer hover:border-gray-600 flex-1">
                    <input type="radio" name="wouldPay" checked={!wouldPay} onChange={() => setWouldPay(false)} className="accent-violet-500" />
                    <span className="text-sm">No, but I'd use it free</span>
                  </label>
                </div>
                {wouldPay && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">How much per month? (optional)</label>
                    <input
                      type="number"
                      value={monthlyAmount}
                      onChange={e => setMonthlyAmount(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                      placeholder="$ per month"
                      min={0}
                      step={0.01}
                    />
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={valueLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium transition-colors"
                  >
                    {valueLoading ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
                <p className="text-xs text-gray-600">Your response is private and helps us prioritize projects.</p>
              </form>
            </div>
          )}

          {valueSubmitted && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
              <p className="text-sm text-green-300">✓ Thank you for your feedback! It helps us prioritize.</p>
            </div>
          )}

          {/* Features list */}
          {proposal.features.length > 0 && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
              <h3 className="font-semibold mb-4">
                Feature Suggestions ({proposal.features.length})
              </h3>
              <div className="space-y-3">
                {proposal.features.map((f: ProposalFeature) => (
                  <div key={f.id} className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                    <p className="text-sm text-gray-300">{f.description}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {f.authorName || 'Anonymous'} · {new Date(f.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
