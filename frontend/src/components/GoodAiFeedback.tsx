import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Send, User, Building2, Mail, CheckCircle, Loader2 } from 'lucide-react'
import { api } from '../services/api'
import type { FeedbackPublic } from '../services/api'

export default function GoodAiFeedback() {
  const { t } = useTranslation('about')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [message, setMessage] = useState('')
  const [allowPublic, setAllowPublic] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [publicFeedback, setPublicFeedback] = useState<FeedbackPublic[]>([])

  useEffect(() => {
    // Load approved public feedback
    api.getPublicFeedback(10)
      .then(data => setPublicFeedback(data))
      .catch(() => {}) // Silently fail
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!name.trim() || !message.trim()) {
      setError('Name and message are required')
      return
    }

    setIsSubmitting(true)
    try {
      await api.submitFeedback({
        name: name.trim(),
        email: email.trim() || undefined,
        organization: organization.trim() || undefined,
        message: message.trim(),
        allowPublic
      })
      setSubmitted(true)
      setName('')
      setEmail('')
      setOrganization('')
      setMessage('')
      // Reload public feedback to show the new comment
      if (allowPublic) {
        api.getPublicFeedback(10)
          .then(data => setPublicFeedback(data))
          .catch(() => {})
      }
    } catch (err: unknown) {
      const error = err as { message?: string }
      setError(error.message || 'Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-3">
            {t('feedback.title', 'Join the Good AI Initiative')}
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {t('feedback.subtitle', 'Share your thoughts on building AI that protects humanity. Your voice matters.')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Feedback Form */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="w-5 h-5 text-violet-400" />
              <h3 className="text-lg font-semibold text-white">
                {t('feedback.formTitle', 'Leave a Comment')}
              </h3>
            </div>

            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-white font-medium mb-2">
                  {t('feedback.thankYou', 'Thank you for your feedback!')}
                </p>
                <p className="text-gray-400 text-sm">
                  {t('feedback.willReview', 'Your comment will be reviewed before being published.')}
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 text-violet-400 hover:text-violet-300 text-sm"
                >
                  {t('feedback.submitAnother', 'Submit another comment')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    <User className="w-4 h-4 inline mr-1.5" />
                    {t('feedback.name', 'Name')} *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                    placeholder={t('feedback.namePlaceholder', 'Your name')}
                    maxLength={100}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    <Mail className="w-4 h-4 inline mr-1.5" />
                    {t('feedback.email', 'Email')} <span className="text-gray-600">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                    placeholder={t('feedback.emailPlaceholder', 'your@email.com')}
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    <Building2 className="w-4 h-4 inline mr-1.5" />
                    {t('feedback.organization', 'Organization')} <span className="text-gray-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={e => setOrganization(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                    placeholder={t('feedback.orgPlaceholder', 'Company or organization')}
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    <MessageSquare className="w-4 h-4 inline mr-1.5" />
                    {t('feedback.message', 'Your Thoughts')} *
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                    placeholder={t('feedback.messagePlaceholder', 'Share your thoughts on the Good AI initiative...')}
                    rows={4}
                    maxLength={2000}
                    required
                  />
                  <div className="text-right text-xs text-gray-500 mt-1">
                    {message.length}/2000
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPublic}
                    onChange={e => setAllowPublic(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
                  />
                  <span className="text-sm text-gray-400">
                    {t('feedback.allowPublic', 'Allow my comment to be displayed publicly (after review)')}
                  </span>
                </label>

                {error && (
                  <div className="text-red-400 text-sm">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      {t('feedback.submit', 'Submit Feedback')}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Public Comments */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-white mb-6">
              {t('feedback.voices', 'Voices for Good AI')}
            </h3>

            {publicFeedback.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>{t('feedback.beFirst', 'Be the first to share your thoughts!')}</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {publicFeedback.map(fb => (
                  <div key={fb.id} className="border-l-2 border-violet-500/30 pl-4 py-2">
                    <p className="text-gray-300 text-sm leading-relaxed mb-2">
                      "{fb.message}"
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="font-medium text-violet-400">{fb.name}</span>
                      {fb.organization && (
                        <>
                          <span>•</span>
                          <span>{fb.organization}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatDate(fb.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
