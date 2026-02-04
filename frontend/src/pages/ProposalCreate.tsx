import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lightbulb, ArrowRight, ArrowLeft, Sparkles, Copy, Check, ExternalLink } from 'lucide-react'
import { api } from '../services/api'

type Step = 1 | 2 | 3 | 4

export default function ProposalCreate() {
  const navigate = useNavigate()

  // Step 1: Title + Description
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [problem, setProblem] = useState('')

  // Step 2: Details
  const [proposerRole, setProposerRole] = useState<string>('end_user')
  const [expectedUsers, setExpectedUsers] = useState('')
  const [expectedMonthlyValue, setExpectedMonthlyValue] = useState('')

  // Step 3: Polish + Confirm
  const [polished, setPolished] = useState('')
  const [polishing, setPolishing] = useState(false)

  // Step 4: Success
  const [shareToken, setShareToken] = useState('')
  const [proposalId, setProposalId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleNext = async () => {
    setError(null)

    if (step === 1) {
      if (!title.trim()) { setError('Title is required'); return }
      if (!description.trim()) { setError('Description is required'); return }
      setStep(2)
    } else if (step === 2) {
      // Submit proposal then polish
      setLoading(true)
      try {
        const proposal = await api.createProposal({
          title: title.trim(),
          description: description.trim(),
          problem: problem.trim() || undefined,
          proposerRole,
          expectedUsers: expectedUsers ? parseInt(expectedUsers) : undefined,
          expectedMonthlyValue: expectedMonthlyValue ? parseFloat(expectedMonthlyValue) : undefined,
        })

        setProposalId(proposal.id)
        setShareToken(proposal.shareToken)

        // Now polish the description
        setPolishing(true)
        setStep(3)

        try {
          const result = await api.polishDescription(description.trim())
          setPolished(result.polished)
        } catch {
          // If polish fails, use raw
          setPolished(description.trim())
        }
        setPolishing(false)
      } catch (err: any) {
        setError(err.message || 'Failed to create proposal')
      } finally {
        setLoading(false)
      }
    } else if (step === 3) {
      // Confirm and publish
      if (!proposalId) return
      setLoading(true)
      try {
        await api.updateProposal(proposalId, {
          polishedDescription: polished.trim(),
          status: 'published',
        })
        setStep(4)
      } catch (err: any) {
        setError(err.message || 'Failed to publish')
      } finally {
        setLoading(false)
      }
    }
  }

  const shareUrl = shareToken
    ? `${window.location.origin}/proposals/${shareToken}`
    : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Propose a Project</h1>
          <p className="text-gray-500 text-sm">Share your idea and let the community support it</p>
        </div>
      </div>

      {/* Progress indicators */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s === step ? 'bg-violet-600 text-white' :
              s < step ? 'bg-violet-600/30 text-violet-300' :
              'bg-gray-800 text-gray-500'
            }`}>
              {s < step ? '✓' : s}
            </div>
            {s < 4 && <div className={`w-8 h-px ${s < step ? 'bg-violet-500/50' : 'bg-gray-800'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Step 1: Idea */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Project Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500 placeholder-gray-600"
              placeholder="e.g. Community Recipe Manager"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Describe Your Idea</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500 placeholder-gray-600 min-h-[150px] resize-y"
              placeholder="What would this project do? Be as detailed as you'd like — our AI will help polish it."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What Problem Does It Solve? <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={problem}
              onChange={e => setProblem(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500 placeholder-gray-600 min-h-[80px] resize-y"
              placeholder="What pain point or need does this address?"
            />
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Your relationship to this project</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-900 border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors">
                <input
                  type="radio"
                  name="proposerRole"
                  value="end_user"
                  checked={proposerRole === 'end_user'}
                  onChange={e => setProposerRole(e.target.value)}
                  className="accent-violet-500"
                />
                <div>
                  <div className="text-sm font-medium">I would use this myself</div>
                  <div className="text-xs text-gray-500">I'm an end user who needs this tool</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-900 border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors">
                <input
                  type="radio"
                  name="proposerRole"
                  value="knows_users"
                  checked={proposerRole === 'knows_users'}
                  onChange={e => setProposerRole(e.target.value)}
                  className="accent-violet-500"
                />
                <div>
                  <div className="text-sm font-medium">I know people who need this</div>
                  <div className="text-xs text-gray-500">I'm proposing on behalf of others</div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              How many people would use this? <span className="text-gray-600">(estimate)</span>
            </label>
            <input
              type="number"
              value={expectedUsers}
              onChange={e => setExpectedUsers(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500 placeholder-gray-600"
              placeholder="e.g. 50"
              min={1}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Expected monthly value ($/month) <span className="text-gray-600">(optional, private)</span>
            </label>
            <input
              type="number"
              value={expectedMonthlyValue}
              onChange={e => setExpectedMonthlyValue(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500 placeholder-gray-600"
              placeholder="e.g. 29.99"
              min={0}
              step={0.01}
            />
            <p className="text-xs text-gray-600 mt-1">This is only visible to the admin team</p>
          </div>
        </div>
      )}

      {/* Step 3: Polish & Confirm */}
      {step === 3 && (
        <div className="space-y-6">
          {polishing ? (
            <div className="text-center py-12">
              <Sparkles className="w-8 h-8 text-violet-400 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-400">Synthia is polishing your description...</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Sparkles className="w-4 h-4 inline text-violet-400 mr-1" />
                  AI-Polished Description
                </label>
                <p className="text-xs text-gray-500 mb-2">Edit freely — this is what the public will see</p>
                <textarea
                  value={polished}
                  onChange={e => setPolished(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500 min-h-[200px] resize-y"
                />
              </div>

              <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Original Description</h3>
                <p className="text-sm text-gray-500 whitespace-pre-wrap">{description}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <div className="text-center py-8">
          <div className="text-5xl mb-6">🚀</div>
          <h2 className="text-2xl font-bold mb-3">Proposal Published!</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Share this link with friends and community members to gather support and feature suggestions.
          </p>

          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6 flex items-center gap-3">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 bg-transparent text-violet-300 text-sm truncate outline-none"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors"
            >
              {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate(`/proposals/${shareToken}`)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Proposal
            </button>
            <button
              onClick={() => navigate('/proposals')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white font-medium transition-colors"
            >
              Browse All Proposals
            </button>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      {step < 4 && (
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => step > 1 ? setStep((step - 1) as Step) : navigate('/proposals')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            onClick={handleNext}
            disabled={loading || polishing}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? 'Saving...' :
             step === 3 ? 'Publish Proposal' :
             'Continue'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
