import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessageSquare, ArrowRight } from 'lucide-react'
import { api } from '../services/api'
import type { FeedbackPublic } from '../services/api'

export default function FeedbackPreview() {
  const { t } = useTranslation('about')
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState<FeedbackPublic[]>([])

  useEffect(() => {
    api.getPublicFeedback(3)
      .then(data => setFeedback(data))
      .catch(() => {})
  }, [])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="mt-8 pt-6 border-t border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-violet-400" />
          {t('feedback.voices', 'Voices for Good AI')}
        </h3>
        <button
          onClick={() => navigate('/good-ai')}
          className="text-violet-400 hover:text-violet-300 text-sm font-medium flex items-center gap-1 transition-colors"
        >
          {t('feedback.viewAll', 'View All')}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {feedback.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p className="mb-2">{t('feedback.beFirst', 'Be the first to share your thoughts!')}</p>
          <button
            onClick={() => navigate('/good-ai')}
            className="text-violet-400 hover:text-violet-300 text-sm"
          >
            {t('feedback.leaveComment', 'Leave a comment')} →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map(fb => (
            <div key={fb.id} className="border-l-2 border-violet-500/30 pl-4 py-2">
              <p className="text-gray-300 text-sm leading-relaxed line-clamp-2">
                "{fb.message}"
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
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
          
          <button
            onClick={() => navigate('/good-ai')}
            className="w-full py-3 text-center text-violet-400 hover:text-violet-300 text-sm font-medium border border-gray-800 rounded-lg hover:border-violet-500/30 transition-colors"
          >
            {t('feedback.seeAllComments', 'See all comments & add yours')} →
          </button>
        </div>
      )}
    </div>
  )
}
