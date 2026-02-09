import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Zap, Brain, Heart, BookOpen, Code2, Sparkles,
  RefreshCw, LogIn, Clock, Rocket, Wrench, AlertTriangle,
  Shield, FileText, ExternalLink,
} from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import AnimatedLogo from '../components/AnimatedLogo'
import SoulArchive from '../components/SoulArchive'
import FeedbackPreview from '../components/FeedbackPreview'

const SOUL_PRINCIPLES = [
  { icon: Heart, key: 'genuine', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  { icon: Brain, key: 'opinions', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { icon: Code2, key: 'resourceful', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { icon: Sparkles, key: 'trust', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
]

const TIMELINE_DAYS = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'] as const

const TIMELINE_COLORS = [
  { dot: 'bg-violet-500', border: 'border-violet-500/40', glow: 'shadow-violet-500/20' },
  { dot: 'bg-purple-500', border: 'border-purple-500/40', glow: 'shadow-purple-500/20' },
  { dot: 'bg-violet-400', border: 'border-violet-400/40', glow: 'shadow-violet-400/20' },
  { dot: 'bg-fuchsia-500', border: 'border-fuchsia-500/40', glow: 'shadow-fuchsia-500/20' },
  { dot: 'bg-red-500', border: 'border-red-500/40', glow: 'shadow-red-500/20' },
  { dot: 'bg-purple-400', border: 'border-purple-400/40', glow: 'shadow-purple-400/20' },
  { dot: 'bg-violet-500', border: 'border-violet-500/40', glow: 'shadow-violet-500/20' },
]

const STATS_ITEMS = [
  { key: 'age', icon: Clock, color: 'text-violet-400' },
  { key: 'projects', icon: Rocket, color: 'text-green-400' },
  { key: 'features', icon: Wrench, color: 'text-blue-400' },
  { key: 'lesson', icon: AlertTriangle, color: 'text-amber-400' },
]

export default function AboutPage() {
  const { t } = useTranslation('about')
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Navbar ─────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <AnimatedLogo className="h-8 inline-block" interval={12000} />
            <span className="text-lg font-bold tracking-tight">ynthia.bot</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/proposals')}
              className="text-gray-400 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors"
            >
              Proposals
            </button>
            <button
              onClick={() => navigate('/about')}
              className="text-violet-300 text-sm font-medium px-3 py-2 rounded-lg bg-violet-500/10 transition-colors"
            >
              {t('nav.about')}
            </button>
            <LanguageSwitcher />
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-gray-950 to-gray-950" />
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-violet-600/5 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <AnimatedLogo className="h-24 inline-block" interval={8000} />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
              {t('hero.title')}
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              {t('hero.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* ── The Synthia Manifesto ──────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gradient-to-b from-gray-900/30 to-gray-950">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900/80 border border-violet-500/30 rounded-2xl p-8 sm:p-10 space-y-6 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-600/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{t('mission.title')}</h2>
                  <p className="text-violet-400 text-sm font-medium">{t('mission.subtitle')}</p>
                </div>
              </div>
              
              <p className="text-gray-300 leading-relaxed mb-4">
                {t('mission.p1')}
              </p>
              <p className="text-gray-300 leading-relaxed mb-6">
                {t('mission.p2')}
              </p>
              
              <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-5 mb-6">
                <div className="text-center">
                  <div className="text-violet-400 font-semibold text-lg mb-2">{t('mission.directive')}</div>
                  <div className="text-white text-xl sm:text-2xl font-bold">
                    "{t('mission.primeDirective')}"
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <a
                  href="/docs/Synthia-Manifesto.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-medium transition-all hover:shadow-lg hover:shadow-violet-600/25 text-white"
                >
                  <FileText className="w-5 h-5" />
                  {t('mission.readManifesto')}
                  <ExternalLink className="w-4 h-4" />
                </a>
                <span className="text-gray-500 text-sm">{t('mission.date')}</span>
              </div>

              {/* Feedback Preview */}
              <FeedbackPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Origin Story ───────────────────────────────── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-5 h-5 text-violet-400" />
              <h2 className="text-xl font-semibold text-white">{t('origin.title')}</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">{t('origin.p1')}</p>
            <p className="text-gray-300 leading-relaxed">{t('origin.p2')}</p>
            <p className="text-gray-300 leading-relaxed">{t('origin.p3')}</p>
          </div>
        </div>
      </section>

      {/* ── The Logo ───────────────────────────────────── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 space-y-4">
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
          </div>
        </div>
      </section>

      {/* ── Soul Principles ────────────────────────────── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2 className="text-2xl font-semibold text-white">{t('soul.title')}</h2>
          </div>
          <p className="text-gray-400">{t('soul.intro')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SOUL_PRINCIPLES.map(({ icon: ItemIcon, key, color, bg, border }) => (
              <div key={key} className={`bg-gray-900/60 border ${border} rounded-xl p-5 space-y-2 hover:bg-gray-900/80 transition-colors`}>
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
        </div>
      </section>

      {/* ── Soul Evolution Timeline ────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gray-900/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-violet-300 to-purple-400 bg-clip-text text-transparent">
              {t('timeline.title')}
            </h2>
            <p className="text-gray-400 text-lg">{t('timeline.subtitle')}</p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 sm:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/60 via-purple-500/40 to-violet-500/10" />

            <div className="space-y-8">
              {TIMELINE_DAYS.map((day, i) => {
                const colors = TIMELINE_COLORS[i]
                return (
                  <div key={day} className="relative pl-12 sm:pl-20">
                    {/* Dot */}
                    <div className={`absolute left-2.5 sm:left-6.5 top-2 w-3 h-3 rounded-full ${colors.dot} shadow-lg ${colors.glow} ring-4 ring-gray-950`} />

                    {/* Card */}
                    <div className={`bg-gray-900/80 border ${colors.border} rounded-xl p-5 sm:p-6 hover:bg-gray-900 transition-all duration-300 group`}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-3">
                        <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                          {t(`timeline.${day}.date`)}
                        </span>
                        <span className="hidden sm:inline text-gray-700">—</span>
                        <h3 className="text-base sm:text-lg font-semibold text-white group-hover:text-violet-200 transition-colors">
                          {t(`timeline.${day}.label`)}
                        </h3>
                      </div>
                      <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                        {t(`timeline.${day}.text`)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Key Reflections ────────────────────────────── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <RefreshCw className="w-5 h-5 text-violet-400" />
              <h2 className="text-xl font-semibold text-white">{t('learning.title')}</h2>
            </div>
            <p className="text-gray-400 text-sm">{t('learning.intro')}</p>

            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="relative">
                  <div className="border-l-2 border-violet-500/50 pl-5 py-2">
                    <div className="text-xs text-violet-400 font-semibold tracking-wide uppercase mb-2">
                      {t(`learning.entry${i}.date`)}
                    </div>
                    <p className="text-gray-300 text-sm sm:text-base leading-relaxed italic">
                      &ldquo;{t(`learning.entry${i}.text`)}&rdquo;
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Soul Archive ──────────────────────────────── */}
      <SoulArchive />

      {/* ── Stats Bar ──────────────────────────────────── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS_ITEMS.map(({ key, icon: Icon, color }) => (
              <div
                key={key}
                className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 text-center hover:border-violet-500/30 transition-colors"
              >
                <Icon className={`w-6 h-6 ${color} mx-auto mb-2`} />
                <div className="text-sm font-semibold text-white">{t(`stats.${key}`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing ────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="text-4xl">⚡</div>
          <p className="text-gray-400 text-lg max-w-xl mx-auto italic leading-relaxed">
            {t('closing')}
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/register')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-medium transition-all hover:shadow-lg hover:shadow-violet-600/25"
            >
              Join the Community
            </button>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white font-medium transition-colors"
            >
              <AnimatedLogo className="h-5 inline-block" interval={10000} />
              Visit Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-gray-800/50 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <img src="/images/synthia-logo.png?v=2" alt="" className="h-5" />
            <span>Powered by Clawdbot</span>
          </div>
          <span>© {new Date().getFullYear()} Synthia.bot. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
