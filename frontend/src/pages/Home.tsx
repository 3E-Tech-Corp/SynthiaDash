import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bot, GitBranch, TicketCheck, FolderGit2,
  Users, Bell, ArrowRight, LogIn, Sparkles,
  ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import AnimatedLogo from '../components/AnimatedLogo'
import { api } from '../services/api'
import type { FeaturedProject } from '../services/api'

const FEATURES = [
  { key: 'codeAgent', icon: Bot, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { key: 'cicd', icon: GitBranch, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { key: 'tickets', icon: TicketCheck, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { key: 'multiRepo', icon: FolderGit2, color: 'text-green-400', bg: 'bg-green-500/10' },
  { key: 'collaboration', icon: Users, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  { key: 'notifications', icon: Bell, color: 'text-orange-400', bg: 'bg-orange-500/10' },
] as const

const STEPS = ['step1', 'step2', 'step3'] as const

function ShinyTitle({ text, interval = 8000 }: { text: string; interval?: number }) {
  const [shining, setShining] = useState(false)

  const triggerShine = useCallback(() => {
    setShining(false)
    // Force reflow to restart animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setShining(true))
    })
  }, [])

  useEffect(() => {
    const init = setTimeout(triggerShine, 3000)
    const timer = setInterval(triggerShine, interval)
    return () => { clearTimeout(init); clearInterval(timer) }
  }, [triggerShine, interval])

  // Split "Meet Synthia ⚡" → "Meet " + logo + "ynthia ⚡"
  const synthiaIdx = text.indexOf('Synthia')
  let before = text
  let after = ''
  if (synthiaIdx >= 0) {
    before = text.slice(0, synthiaIdx)
    after = text.slice(synthiaIdx + 1) // skip the "S", keep "ynthia ⚡"
  }

  return (
    <h1
      className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 relative cursor-pointer select-none"
      onClick={triggerShine}
    >
      {/* Base gradient text */}
      <span className="bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
        {synthiaIdx >= 0 ? (
          <>
            {before}
            <AnimatedLogo className="inline-block h-[80px] align-baseline relative top-[5px] ml-[-0.02em] mr-[6px]" interval={8000} />
            {after}
          </>
        ) : text}
      </span>

      {/* Shine overlay */}
      {shining && (
        <span
          className="absolute inset-0 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          <span className="shine-sweep absolute inset-0" />
        </span>
      )}
    </h1>
  )
}

function FeaturedExamples() {
  const [projects, setProjects] = useState<FeaturedProject[]>([])
  const [scrollIndex, setScrollIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    api.getFeaturedProjects()
      .then(setProjects)
      .catch(() => {}) // silently fail on public page
  }, [])

  // Auto-scroll every 5s
  useEffect(() => {
    if (projects.length <= 1) return
    autoScrollRef.current = setInterval(() => {
      setScrollIndex(prev => (prev + 1) % projects.length)
    }, 5000)
    return () => clearInterval(autoScrollRef.current)
  }, [projects.length])

  // Scroll to index
  useEffect(() => {
    if (!scrollRef.current) return
    const cardWidth = scrollRef.current.firstElementChild?.clientWidth ?? 0
    const gap = 24 // gap-6 = 1.5rem = 24px
    scrollRef.current.scrollTo({
      left: scrollIndex * (cardWidth + gap),
      behavior: 'smooth',
    })
  }, [scrollIndex])

  const scrollPrev = () => {
    clearInterval(autoScrollRef.current)
    setScrollIndex(prev => Math.max(0, prev - 1))
  }

  const scrollNext = () => {
    clearInterval(autoScrollRef.current)
    setScrollIndex(prev => Math.min(projects.length - 1, prev + 1))
  }

  if (projects.length === 0) return null

  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6 bg-gray-900/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Featured Examples</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Real projects built and deployed with Synthia
          </p>
        </div>

        <div className="relative">
          {/* Arrow buttons */}
          {projects.length > 1 && (
            <>
              <button
                onClick={scrollPrev}
                className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-gray-800/80 hover:bg-gray-700 border border-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-all backdrop-blur-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={scrollNext}
                className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-gray-800/80 hover:bg-gray-700 border border-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-all backdrop-blur-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Carousel */}
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex-shrink-0 snap-start w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] group"
              >
                <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-300">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-gray-800 relative overflow-hidden">
                    {(project.thumbnailAssetId || project.thumbnailPath) ? (
                      <img
                        src={project.thumbnailAssetId ? `/api/asset/${project.thumbnailAssetId}` : `/api/featuredprojects/${project.id}/thumbnail`}
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className="w-10 h-10 text-gray-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-violet-300 transition-colors">
                      {project.title}
                    </h3>
                    {project.description && (
                      <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/15 border border-violet-500/20 text-violet-300 text-sm font-medium hover:bg-violet-600/25 hover:text-violet-200 transition-colors"
                    >
                      View Project
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dots indicator */}
          {projects.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {projects.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { clearInterval(autoScrollRef.current); setScrollIndex(i) }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === scrollIndex
                      ? 'bg-violet-500 w-6'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const { t } = useTranslation('home')
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Navbar ─────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-2">
            <AnimatedLogo className="h-8" interval={12000} />
            <span className="text-lg font-bold tracking-tight">Synthia.bot</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.signIn')}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-4 sm:px-6 overflow-hidden">
        {/* Hero background image */}
        <div className="absolute inset-0 z-0">
          <img src="/images/dashboard-hero.png" alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/60 via-gray-950/80 to-gray-950" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm">
            <Sparkles className="w-4 h-4" />
            synthia.bot
          </div>

          <ShinyTitle text={t('hero.title')} />

          <p className="text-lg sm:text-xl text-violet-300 font-medium mb-4">
            {t('hero.subtitle')}
          </p>

          <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('hero.description')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-lg transition-all hover:shadow-lg hover:shadow-violet-600/25"
            >
              {t('hero.cta')}
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white font-medium text-lg transition-colors"
            >
              <LogIn className="w-5 h-5" />
              {t('hero.secondaryCta')}
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('features.sectionTitle')}</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('features.sectionSubtitle')}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ key, icon: Icon, color, bg }) => (
              <div
                key={key}
                className="group bg-gray-900/60 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 hover:bg-gray-900 transition-all duration-200"
              >
                <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t(`features.${key}.title`)}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{t(`features.${key}.description`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Examples ──────────────────────────── */}
      <FeaturedExamples />

      {/* ── How It Works ───────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-gray-900/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('howItWorks.sectionTitle')}</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('howItWorks.sectionSubtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step} className="relative text-center">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-gradient-to-r from-violet-600/40 to-violet-600/0" />
                )}

                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600/15 border border-violet-500/20 text-violet-400 text-2xl font-bold mb-6">
                  {t(`howItWorks.${step}.number`)}
                </div>
                <h3 className="text-xl font-semibold mb-3">{t(`howItWorks.${step}.title`)}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{t(`howItWorks.${step}.description`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-b from-violet-600/10 to-transparent border border-violet-500/20 rounded-3xl p-10 sm:p-14">
            <AnimatedLogo className="h-16 mx-auto mb-6" interval={10000} />
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('cta.title')}</h2>
            <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">{t('cta.description')}</p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-lg transition-all hover:shadow-lg hover:shadow-violet-600/25"
            >
              {t('cta.button')}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-gray-800/50 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <img src="/images/synthia-logo.png?v=2" alt="" className="h-5" />
            <span>{t('footer.poweredBy')}</span>
          </div>
          <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
        </div>
      </footer>
    </div>
  )
}
