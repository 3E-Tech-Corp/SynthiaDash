import { useState, useEffect } from 'react'
import { Lightbulb, Heart, Users, DollarSign, ChevronDown, ChevronUp, ExternalLink, Calendar } from 'lucide-react'
import { api, type ProposalAdminView } from '../services/api'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  published: 'bg-green-500/10 text-green-400 border-green-500/20',
  under_review: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  accepted: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  declined: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function ProposalAdmin() {
  const [proposals, setProposals] = useState<ProposalAdminView[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ProposalAdminView | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [weeklyMode, setWeeklyMode] = useState(false)

  // Decline modal
  const [declineId, setDeclineId] = useState<number | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  const loadProposals = async () => {
    setLoading(true)
    try {
      const data = weeklyMode ? await api.getWeeklyProposals() : await api.getAdminProposals()
      setProposals(data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadProposals() }, [weeklyMode])

  const handleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(id)
    setDetailLoading(true)
    try {
      const d = await api.getAdminProposalDetail(id)
      setDetail(d)
    } catch { /* ignore */ }
    setDetailLoading(false)
  }

  const handleStatusChange = async (id: number, status: string, reason?: string) => {
    try {
      await api.updateProposalStatus(id, status, reason)
      await loadProposals()
      if (expandedId === id) {
        const d = await api.getAdminProposalDetail(id)
        setDetail(d)
      }
    } catch { /* ignore */ }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Proposals</h1>
            <p className="text-gray-500 text-sm">{proposals.length} total</p>
          </div>
        </div>
        <button
          onClick={() => setWeeklyMode(w => !w)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            weeklyMode
              ? 'bg-violet-600 text-white'
              : 'bg-gray-900 border border-gray-700 text-gray-300 hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          {weeklyMode ? 'Weekly Top' : 'All'}
        </button>
      </div>

      {loading && <div className="text-gray-500 py-8 text-center">Loading...</div>}

      {!loading && proposals.length === 0 && (
        <div className="text-gray-500 py-8 text-center">No proposals yet</div>
      )}

      <div className="space-y-3">
        {proposals.map(p => (
          <div key={p.id} className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
            {/* Header row */}
            <button
              onClick={() => handleExpand(p.id)}
              className="w-full text-left p-4 hover:bg-gray-900/80 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{p.title}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[p.status] || STATUS_COLORS.draft}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {p.likeCount}</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {p.supporterCount}</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> ${p.weightedValueScore.toFixed(2)}/mo</span>
                    <span>{p.featureCount} features</span>
                    {p.proposerEmail && <span className="text-gray-600">{p.proposerEmail}</span>}
                  </div>
                </div>
                {expandedId === p.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </button>

            {/* Expanded detail */}
            {expandedId === p.id && (
              <div className="border-t border-gray-800 p-4 space-y-4">
                {detailLoading ? (
                  <div className="text-gray-500 text-sm py-4 text-center">Loading details...</div>
                ) : detail ? (
                  <>
                    {/* Description */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Raw Description</h4>
                      <p className="text-sm text-gray-400 whitespace-pre-wrap">{detail.rawDescription}</p>
                    </div>

                    {detail.polishedDescription && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Polished Description</h4>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{detail.polishedDescription}</p>
                      </div>
                    )}

                    {detail.problem && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Problem</h4>
                        <p className="text-sm text-gray-400">{detail.problem}</p>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">Proposer Role</div>
                        <div className="text-sm font-medium">{detail.proposerRole || '—'}</div>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">Expected Users</div>
                        <div className="text-sm font-medium">{detail.expectedUsers ?? '—'}</div>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">Proposer Estimate</div>
                        <div className="text-sm font-medium">{detail.expectedMonthlyValue != null ? `$${detail.expectedMonthlyValue}/mo` : '—'}</div>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">Weighted Score</div>
                        <div className="text-sm font-medium text-green-400">${detail.weightedValueScore.toFixed(2)}/mo</div>
                      </div>
                    </div>

                    {/* Value Estimates */}
                    {detail.valueEstimates && detail.valueEstimates.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Value Estimates ({detail.valueEstimates.length})</h4>
                        <div className="space-y-1">
                          {detail.valueEstimates.map(ve => (
                            <div key={ve.id} className="flex items-center gap-3 text-sm bg-gray-800/30 rounded-lg px-3 py-2">
                              <span className={ve.wouldPay ? 'text-green-400' : 'text-gray-500'}>{ve.wouldPay ? '✓ Would pay' : '✗ Free only'}</span>
                              {ve.monthlyAmount != null && <span className="text-green-300">${ve.monthlyAmount}/mo</span>}
                              <span className="text-gray-600">weight: {ve.weight}</span>
                              <span className="text-gray-600">{ve.isAnonymous ? 'anonymous' : `user #${ve.userId}`}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Features */}
                    {detail.features && detail.features.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Feature Suggestions ({detail.features.length})</h4>
                        <div className="space-y-1">
                          {detail.features.map(f => (
                            <div key={f.id} className="text-sm bg-gray-800/30 rounded-lg px-3 py-2">
                              <span className="text-gray-300">{f.description}</span>
                              <span className="text-gray-600 ml-2">— {f.authorName || 'Anonymous'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Share link */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Share:</span>
                      <a href={`/proposals/${detail.shareToken}`} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 flex items-center gap-1">
                        /proposals/{detail.shareToken} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Status actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
                      {p.status !== 'under_review' && (
                        <button onClick={() => handleStatusChange(p.id, 'under_review')} className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm hover:bg-yellow-500/20 transition-colors">
                          Mark Under Review
                        </button>
                      )}
                      {p.status !== 'accepted' && (
                        <button onClick={() => handleStatusChange(p.id, 'accepted')} className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm hover:bg-green-500/20 transition-colors">
                          Accept
                        </button>
                      )}
                      {p.status !== 'published' && (
                        <button onClick={() => handleStatusChange(p.id, 'published')} className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/20 transition-colors">
                          Publish
                        </button>
                      )}
                      {p.status !== 'declined' && (
                        <button onClick={() => setDeclineId(p.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors">
                          Decline
                        </button>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Decline Modal */}
      {declineId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDeclineId(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Decline Proposal</h3>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 min-h-[100px] resize-y mb-4"
              placeholder="Reason for declining (optional)..."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeclineId(null)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleStatusChange(declineId, 'declined', declineReason || undefined)
                  setDeclineId(null)
                  setDeclineReason('')
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
