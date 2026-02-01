import { useState, useRef, useEffect } from 'react'
import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors text-sm"
        aria-label="Change language"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{current.flag} {current.label}</span>
        <span className="sm:hidden">{current.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 min-w-[160px]">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => {
                i18n.changeLanguage(lang.code)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                lang.code === i18n.language
                  ? 'bg-violet-600/20 text-violet-300'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
