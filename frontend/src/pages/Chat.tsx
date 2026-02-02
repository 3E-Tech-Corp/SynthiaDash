import type { ReactNode } from 'react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Zap, Send, Trash2, BookOpen, Bug, Code, Lock, ChevronDown, X, Paperclip } from 'lucide-react'
import { api } from '../services/api'
import type { ChatMessageDto, ChatProject } from '../services/api'

const TIER_INFO: Record<string, { icon: typeof Zap; label: string; emoji: string; color: string }> = {
  guide: { icon: BookOpen, label: 'Guide', emoji: '📖', color: 'text-blue-400' },
  bug: { icon: Bug, label: 'Bug Hunter', emoji: '🐛', color: 'text-amber-400' },
  developer: { icon: Code, label: 'Developer', emoji: '⚡', color: 'text-violet-400' },
}

function renderMarkdown(text: string) {
  // Simple markdown renderer
  const parts: (string | ReactNode)[] = []
  let key = 0

  // Split by code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match

  const segments: { type: 'text' | 'code'; content: string; lang?: string }[] = []

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'code', content: match[2], lang: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }

  for (const segment of segments) {
    if (segment.type === 'code') {
      parts.push(
        <pre key={key++} className="bg-gray-800 border border-gray-700 rounded-lg p-3 my-2 overflow-x-auto text-sm">
          {segment.lang && (
            <div className="text-xs text-gray-500 mb-1">{segment.lang}</div>
          )}
          <code className="text-gray-300">{segment.content}</code>
        </pre>
      )
    } else {
      // Process inline markdown
      const lines = segment.content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i]

        // Inline code
        const inlineParts: (string | ReactNode)[] = []
        const inlineCodeRegex = /`([^`]+)`/g
        let inlineLastIndex = 0
        let inlineMatch

        while ((inlineMatch = inlineCodeRegex.exec(line)) !== null) {
          if (inlineMatch.index > inlineLastIndex) {
            const textBefore = line.slice(inlineLastIndex, inlineMatch.index)
            inlineParts.push(...renderInlineText(textBefore, key))
            key += 10
          }
          inlineParts.push(
            <code key={key++} className="bg-gray-800 text-violet-300 px-1.5 py-0.5 rounded text-sm">
              {inlineMatch[1]}
            </code>
          )
          inlineLastIndex = inlineMatch.index + inlineMatch[0].length
        }
        if (inlineLastIndex < line.length) {
          inlineParts.push(...renderInlineText(line.slice(inlineLastIndex), key))
          key += 10
        }

        if (inlineParts.length > 0 || i < lines.length - 1) {
          parts.push(<span key={key++}>{inlineParts}</span>)
          if (i < lines.length - 1) {
            parts.push(<br key={key++} />)
          }
        }
      }
    }
  }

  return parts
}

function renderInlineText(text: string, baseKey: number): (string | ReactNode)[] {
  const parts: (string | ReactNode)[] = []
  let key = baseKey

  // Bold
  const boldRegex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(<strong key={key++} className="font-semibold text-gray-100">{match[1]}</strong>)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  if (parts.length === 0) {
    parts.push(text)
  }

  return parts
}

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
  imageUrl?: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [chatAccess, setChatAccess] = useState<string>('none')
  const [projectName, setProjectName] = useState<string | null>(null)
  const [repoFullName, setRepoFullName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [projects, setProjects] = useState<ChatProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [pendingImageName, setPendingImageName] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const streamingRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Load projects list and auto-select first project
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectList = await api.getChatProjects()
        setProjects(projectList)
        // Auto-select first project if none selected
        if (projectList.length > 0 && !selectedProjectId) {
          setSelectedProjectId(projectList[0].id)
        }
      } catch {
        // ignore — projects endpoint may not be accessible
      }
    }
    loadProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load initial data
  useEffect(() => {
    const load = async () => {
      try {
        const history = await api.getChatHistory()
        setChatAccess(history.chatAccess)
        setProjectName(history.projectName || null)
        setRepoFullName(history.repoFullName || null)
        if (history.projectId && !selectedProjectId) {
          setSelectedProjectId(history.projectId)
        }
        setMessages(
          history.messages.map((m: ChatMessageDto) => ({
            id: String(m.id),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: m.createdAt,
          }))
        )
      } catch {
        // Try access endpoint as fallback
        try {
          const access = await api.getChatAccess()
          setChatAccess(access.chatAccess)
          setProjectName(access.projectName || null)
          setRepoFullName(access.repoFullName || null)
        } catch {
          // ignore
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Switch project handler
  const switchProject = useCallback(async (projectId: number) => {
    if (projectId === selectedProjectId || streaming) return
    setSelectedProjectId(projectId)
    setProjectsLoading(true)
    setShowClearConfirm(false)
    try {
      const history = await api.getChatHistory(50, projectId)
      setChatAccess(history.chatAccess)
      setProjectName(history.projectName || null)
      setRepoFullName(history.repoFullName || null)
      setMessages(
        history.messages.map((m: ChatMessageDto) => ({
          id: String(m.id),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          createdAt: m.createdAt,
        }))
      )
    } catch {
      // ignore
    } finally {
      setProjectsLoading(false)
      inputRef.current?.focus()
    }
  }, [selectedProjectId, streaming])

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        if (file.size > 5 * 1024 * 1024) {
          // Too large — ignore
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          setPendingImage(reader.result as string)
          setPendingImageName(file.name || 'pasted-image.png')
        }
        reader.readAsDataURL(file)
        break
      }
    }
  }

  const noProject = !selectedProjectId && projects.length === 0 && !projectName

  const handleSend = async () => {
    const msg = input.trim()
    if ((!msg && !pendingImage) || streaming || noProject) return

    const imageData = pendingImage

    // Add user message immediately
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: msg || '(image)',
      imageUrl: imageData || undefined,
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setPendingImage(null)
    setPendingImageName(null)
    setStreaming(true)
    streamingRef.current = true

    // Create placeholder for assistant response
    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: DisplayMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }
    setMessages(prev => [...prev, assistantMsg])

    await api.chatStream(
      msg,
      (chunk) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        )
      },
      () => {
        setStreaming(false)
        streamingRef.current = false
        inputRef.current?.focus()
      },
      (error) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${error}` }
              : m
          )
        )
        setStreaming(false)
        streamingRef.current = false
      },
      selectedProjectId || undefined,
      imageData || undefined
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = async () => {
    try {
      await api.clearChatHistory(selectedProjectId || undefined)
      setMessages([])
      setShowClearConfirm(false)
    } catch {
      // ignore
    }
  }

  const tierInfo = TIER_INFO[chatAccess]

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/3"></div>
          <div className="h-96 bg-gray-900 rounded-xl"></div>
          <div className="h-12 bg-gray-900 rounded-xl"></div>
        </div>
      </div>
    )
  }

  if (chatAccess === 'none') {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-8">
          <Zap className="w-8 h-8 text-violet-400" />
          Chat with Synthia
        </h1>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Lock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-300 mb-2">Chat Access Required</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            You don't have chat access yet. Ask your admin to enable chat for your account.
            Chat tiers include Guide (📖), Bug Hunter (🐛), and Developer (⚡).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Zap className="w-7 h-7 text-violet-400" />
          <h1 className="text-2xl font-bold">Chat with Synthia</h1>
          {tierInfo && (
            <span className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 ${tierInfo.color}`}>
              {tierInfo.emoji} {tierInfo.label}
            </span>
          )}
          {projects.length > 1 ? (
            <div className="relative">
              <select
                value={selectedProjectId || ''}
                onChange={(e) => switchProject(parseInt(e.target.value))}
                disabled={streaming || projectsLoading}
                className="appearance-none bg-gray-900 border border-gray-800 rounded-lg pl-3 pr-8 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-violet-600 hover:border-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
          ) : projectName ? (
            <span className="text-sm text-gray-500">
              · {projectName}
            </span>
          ) : null}
        </div>
        <div className="relative">
          {showClearConfirm ? (
            <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-400">Clear all messages?</span>
              <button
                onClick={handleClear}
                className="text-xs text-red-400 hover:text-red-300 font-medium"
              >
                Yes
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-gray-600 hover:text-gray-400 transition-colors p-2 rounded-lg hover:bg-gray-900"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-y-auto p-4 space-y-4 mb-4">
        {projects.length === 0 && !loading && !projectName && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Zap className="w-10 h-10 text-gray-600 mb-3" />
            <p className="text-gray-500 text-lg mb-1">No projects available</p>
            <p className="text-gray-600 text-sm">Ask your admin to add you to a project.</p>
          </div>
        )}

        {(projects.length > 0 || projectName) && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Zap className="w-10 h-10 text-violet-400/50 mb-3" />
            <p className="text-gray-500 text-lg mb-1">Start a conversation with Synthia</p>
            <p className="text-gray-600 text-sm">
              {chatAccess === 'guide' && 'Ask about your project features, code structure, and documentation.'}
              {chatAccess === 'bug' && 'Ask about your project or describe bugs for investigation.'}
              {chatAccess === 'developer' && 'Full development mode — ask anything about your project.'}
            </p>
            {repoFullName && (
              <p className="text-gray-700 text-xs mt-2 font-mono">{repoFullName}</p>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center mr-2 mt-1">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gray-800 text-gray-100'
                  : 'bg-gray-800/50 border border-gray-800 text-gray-200'
              }`}
            >
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              </div>
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt="Attached"
                  className="max-w-xs rounded-lg mt-2 cursor-pointer"
                  onClick={() => window.open(msg.imageUrl, '_blank')}
                />
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {streaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div className="flex items-center gap-2 text-gray-500 text-sm pl-9">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            Synthia is typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex flex-col">
        {pendingImage && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-gray-800 border border-gray-700 rounded-lg">
            <img src={pendingImage} alt="Preview" className="h-16 w-auto rounded" />
            <span className="text-xs text-gray-400 truncate flex-1">{pendingImageName}</span>
            <button
              onClick={() => { setPendingImage(null); setPendingImageName(null) }}
              className="p-1 text-gray-500 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end w-full min-w-0">
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={noProject ? 'Select a project to start chatting...' : streaming ? 'Synthia is responding...' : 'Message Synthia...'}
              disabled={streaming || noProject}
              rows={1}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-600 resize-none disabled:opacity-50 transition-colors"
              style={{ minHeight: '48px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = '48px'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={streaming}
              className="absolute right-2 bottom-2.5 text-gray-500 hover:text-gray-300 disabled:text-gray-700 p-1 transition-colors"
              title="Attach image"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              if (file.size > 5 * 1024 * 1024) return
              const reader = new FileReader()
              reader.onload = () => {
                setPendingImage(reader.result as string)
                setPendingImageName(file.name)
              }
              reader.readAsDataURL(file)
              e.target.value = ''
            }}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !pendingImage) || streaming || noProject}
            className="flex-shrink-0 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 text-white p-3 rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
