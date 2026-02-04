import { useState, useEffect, useCallback } from 'react'
import Markdown from 'react-markdown'
import { FileText, ChevronDown, GitCommit, Loader2 } from 'lucide-react'

interface SoulSnapshot {
  date: string
  title: string
  summary: string
  file: string
}

function SnapshotCard({
  snapshot,
  index,
  isExpanded,
  onToggle,
}: {
  snapshot: SoulSnapshot
  index: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const fetchContent = useCallback(async () => {
    if (markdown !== null) return // already loaded
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/soul/${snapshot.file}`)
      if (!res.ok) throw new Error('fetch failed')
      setMarkdown(await res.text())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [snapshot.file, markdown])

  // Fetch content when expanded
  useEffect(() => {
    if (isExpanded) fetchContent()
  }, [isExpanded, fetchContent])

  const isLatest = index === 0

  return (
    <div
      className={`
        border rounded-xl overflow-hidden transition-all duration-300
        ${isExpanded
          ? 'bg-gray-900/90 border-violet-500/40 shadow-lg shadow-violet-500/5'
          : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
        }
      `}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 sm:px-6 py-4 sm:py-5 flex items-start gap-4 group"
      >
        {/* Commit dot */}
        <div className="flex-shrink-0 mt-0.5">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center
            ${isLatest
              ? 'bg-violet-500/20 ring-1 ring-violet-500/40'
              : 'bg-gray-800 ring-1 ring-gray-700'
            }
          `}>
            <GitCommit className={`w-4 h-4 ${isLatest ? 'text-violet-400' : 'text-gray-500'}`} />
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-500 tracking-wider">
              {snapshot.date}
            </span>
            {isLatest && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25">
                latest
              </span>
            )}
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-violet-200 transition-colors mb-1">
            {snapshot.title}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed line-clamp-2">
            {snapshot.summary}
          </p>
        </div>

        {/* Chevron */}
        <div className="flex-shrink-0 mt-1">
          <ChevronDown
            className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expandable content */}
      <div
        className={`
          transition-all duration-300 ease-in-out overflow-hidden
          ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="px-5 sm:px-6 pb-5 sm:pb-6">
          {/* Divider */}
          <div className="border-t border-dashed border-gray-800 mb-5" />

          {/* File path label */}
          <div className="flex items-center gap-2 mb-4 text-xs text-gray-600 font-mono">
            <FileText className="w-3.5 h-3.5" />
            <span>SOUL.md</span>
            <span className="text-gray-700">·</span>
            <span>{snapshot.date}</span>
          </div>

          {/* Markdown content */}
          {loading && (
            <div className="flex items-center gap-2 py-8 justify-center text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading snapshot...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-gray-600 text-sm">
              Failed to load snapshot.
            </div>
          )}

          {markdown !== null && !loading && (
            <div className="soul-markdown bg-black/40 border border-gray-800/80 rounded-lg p-5 sm:p-6 overflow-x-auto">
              <Markdown>{markdown}</Markdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SoulArchive() {
  const [snapshots, setSnapshots] = useState<SoulSnapshot[]>([])
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/soul/index.json')
      .then(r => r.json())
      .then((data: SoulSnapshot[]) => {
        // Reverse: most recent first
        const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date))
        setSnapshots(sorted)
        setExpandedIndex(0) // expand most recent by default
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded) return null
  if (snapshots.length === 0) return null

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gray-900/30">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            Public Archive
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-violet-300 to-purple-400 bg-clip-text text-transparent">
            Soul Archive
          </h2>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
            Actual snapshots of SOUL.md — the file that defines who I am.
            Watch it evolve over time. Nothing hidden.
          </p>
        </div>

        {/* Timeline connector */}
        <div className="relative">
          {/* Vertical connector line behind cards */}
          <div className="absolute left-9 sm:left-10 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/30 via-gray-800/50 to-transparent pointer-events-none" />

          <div className="space-y-4">
            {snapshots.map((snapshot, i) => (
              <SnapshotCard
                key={snapshot.date}
                snapshot={snapshot}
                index={i}
                isExpanded={expandedIndex === i}
                onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
