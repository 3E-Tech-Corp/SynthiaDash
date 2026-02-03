import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LogIn, Send, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import AnimatedLogo from '../components/AnimatedLogo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Demo request state
  const [showDemoForm, setShowDemoForm] = useState(searchParams.get('demo') === '1')
  const [demoName, setDemoName] = useState('')
  const [demoEmail, setDemoEmail] = useState('')
  const [demoReason, setDemoReason] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const [demoSuccess, setDemoSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await login(email, password)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      navigate('/')
    }
  }

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDemoError(null)
    setDemoLoading(true)
    try {
      await api.requestDemo({ email: demoEmail, name: demoName, reason: demoReason })
      setDemoSuccess(true)
    } catch (err: any) {
      setDemoError(err.message || 'Failed to submit request')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: 'url(/images/login-bg.png)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/30 to-gray-950/60" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            <AnimatedLogo className="inline-block h-[40px] align-baseline relative top-[3px] mr-[4px]" interval={10000} />
            ynthia.bot
          </h1>
          <p className="text-gray-400">
            {showDemoForm ? 'Request Demo Access' : 'Mission Control — Sign in to continue'}
          </p>
        </div>

        {!showDemoForm ? (
          <>
            <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              {error && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 py-2.5 rounded-lg font-medium transition-colors"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="text-center mt-4">
              <button
                onClick={() => setShowDemoForm(true)}
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-2"
              >
                Don't have an account? Request demo access
              </button>
            </div>
          </>
        ) : (
          <>
            {demoSuccess ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
                <div className="text-4xl mb-4">🎉</div>
                <h3 className="text-lg font-semibold text-white mb-2">Request Submitted!</h3>
                <p className="text-gray-400 text-sm mb-6">
                  We'll review your request and get back to you shortly.
                </p>
                <button
                  onClick={() => { setShowDemoForm(false); setDemoSuccess(false) }}
                  className="text-sm text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-2"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                {demoError && (
                  <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
                    {demoError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={demoName}
                    onChange={e => setDemoName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                    placeholder="Your name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={demoEmail}
                    onChange={e => setDemoEmail(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Reason</label>
                  <textarea
                    value={demoReason}
                    onChange={e => setDemoReason(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 min-h-[100px] resize-y"
                    placeholder="Tell us about your project and why you'd like access..."
                    required
                    minLength={10}
                  />
                </div>

                <button
                  type="submit"
                  disabled={demoLoading}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 py-2.5 rounded-lg font-medium transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {demoLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            )}

            {!demoSuccess && (
              <div className="text-center mt-4">
                <button
                  onClick={() => setShowDemoForm(false)}
                  className="text-sm text-gray-400 hover:text-gray-300 transition-colors flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back to Sign In
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
