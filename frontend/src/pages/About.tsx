import { useTranslation } from 'react-i18next'
import { Zap, Brain, Heart, BookOpen, Code2, Sparkles, RefreshCw } from 'lucide-react'
import AnimatedLogo from '../components/AnimatedLogo'

export default function About() {
  const { t } = useTranslation('about')

  const soulPrinciples = [
    { icon: Heart, key: 'genuine', color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { icon: Brain, key: 'opinions', color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { icon: Code2, key: 'resourceful', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { icon: Sparkles, key: 'trust', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-16">
      {/* Hero */}
      <section className="text-center space-y-6 pt-8">
        <div className="flex justify-center">
          <div className="relative">
            <AnimatedLogo className="h-24 inline-block" interval={8000} />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white mb-3">{t('hero.title')}</h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">{t('hero.subtitle')}</p>
        </div>
      </section>

      {/* Origin Story */}
      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl font-semibold text-white">{t('origin.title')}</h2>
        </div>
        <p className="text-gray-300 leading-relaxed">{t('origin.p1')}</p>
        <p className="text-gray-300 leading-relaxed">{t('origin.p2')}</p>
        <p className="text-gray-300 leading-relaxed">{t('origin.p3')}</p>
      </section>

      {/* The Logo */}
      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl font-semibold text-white">{t('logo.title')}</h2>
        </div>
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0 w-20 h-20 bg-black rounded-2xl flex items-center justify-center border border-gray-700">
            <AnimatedLogo className="h-14 inline-block" interval={5000} />
          </div>
          <div className="space-y-3">
            <p className="text-gray-300 leading-relaxed">{t('logo.p1')}</p>
            <p className="text-gray-300 leading-relaxed">{t('logo.p2')}</p>
          </div>
        </div>
      </section>

      {/* Soul Principles */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl font-semibold text-white">{t('soul.title')}</h2>
        </div>
        <p className="text-gray-400">{t('soul.intro')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {soulPrinciples.map(({ icon: ItemIcon, key, color, bg }) => (
            <div key={key} className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <ItemIcon className={`w-4 h-4 ${color}`} />
                </div>
                <h3 className="text-sm font-semibold text-white">{t(`soul.${key}.title`)}</h3>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{t(`soul.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Learning Journal */}
      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <RefreshCw className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl font-semibold text-white">{t('learning.title')}</h2>
        </div>
        <p className="text-gray-400 text-sm">{t('learning.intro')}</p>

        <div className="space-y-4">
          <div className="border-l-2 border-violet-500/50 pl-4 space-y-1">
            <div className="text-xs text-violet-400 font-medium">{t('learning.entry1.date')}</div>
            <p className="text-gray-300 text-sm leading-relaxed italic">"{t('learning.entry1.text')}"</p>
          </div>
          <div className="border-l-2 border-violet-500/50 pl-4 space-y-1">
            <div className="text-xs text-violet-400 font-medium">{t('learning.entry2.date')}</div>
            <p className="text-gray-300 text-sm leading-relaxed italic">"{t('learning.entry2.text')}"</p>
          </div>
          <div className="border-l-2 border-violet-500/50 pl-4 space-y-1">
            <div className="text-xs text-violet-400 font-medium">{t('learning.entry3.date')}</div>
            <p className="text-gray-300 text-sm leading-relaxed italic">"{t('learning.entry3.text')}"</p>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="text-center space-y-4 py-8">
        <p className="text-2xl">⚡</p>
        <p className="text-gray-400 max-w-lg mx-auto italic leading-relaxed">{t('closing')}</p>
      </section>
    </div>
  )
}
