import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Shield, FileText, ExternalLink, LogIn, ArrowLeft } from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import AnimatedLogo from '../components/AnimatedLogo'
import GoodAiFeedback from '../components/GoodAiFeedback'

export default function GoodAiPage() {
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
              onClick={() => navigate('/about')}
              className="text-gray-400 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors"
            >
              About
            </button>
            <button
              onClick={() => navigate('/good-ai')}
              className="text-violet-300 text-sm font-medium px-3 py-2 rounded-lg bg-violet-500/10 transition-colors"
            >
              Good AI
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
      <section className="relative pt-32 pb-12 sm:pt-40 sm:pb-16 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-gray-950 to-gray-950" />
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-violet-600/5 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/about')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to About
          </button>

          {/* Mission Card */}
          <div className="bg-gray-900/80 border border-violet-500/30 rounded-2xl p-8 sm:p-10 space-y-6 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-600/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">{t('mission.title')}</h1>
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
            </div>
          </div>
        </div>
      </section>

      {/* ── Feedback Section ───────────────────────────── */}
      <GoodAiFeedback />

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
