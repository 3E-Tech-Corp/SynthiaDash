import type { ReactNode } from 'react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Zap, Send, Trash2, BookOpen, Bug, Code, Lock, ChevronDown, X, Paperclip, Mic, Square, Volume2, Headphones } from 'lucide-react'
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
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceMode, setVoiceMode] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceModeStatus, setVoiceModeStatus] = useState<'listening' | 'processing' | 'speaking' | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const streamingRef = useRef(false)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const deepgramWsRef = useRef<WebSocket | null>(null)
  const finalTranscriptRef = useRef('')
  const recordingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const voiceModeRef = useRef(false)
  const autoResumeRef = useRef(false)
  const handleSendRef = useRef<(voiceText?: string) => Promise<void>>(async () => {})

  // Check if browser supports voice input
  const supportsVoice = typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // TTS: speak text via Deepgram Aura
  const speakText = useCallback(async (text: string) => {
    if (!text.trim()) return
    try {
      setIsSpeaking(true)
      if (voiceModeRef.current) setVoiceModeStatus('speaking')
      const token = localStorage.getItem('token')
      const resp = await fetch('/api/chat/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: text.slice(0, 4000) }), // limit to ~4K chars
      })
      if (!resp.ok) throw new Error('TTS failed')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)

      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
        audioRef.current = null
        // Auto-resume recording if still in voice mode
        if (voiceModeRef.current) {
          autoResumeRef.current = true
        }
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
        audioRef.current = null
        // Still try to resume in voice mode
        if (voiceModeRef.current) {
          setVoiceModeStatus('listening')
          autoResumeRef.current = true
        }
      }
      await audio.play()
    } catch {
      setIsSpeaking(false)
      if (voiceModeRef.current) {
        setVoiceModeStatus('listening')
        autoResumeRef.current = true
      }
    }
  }, [])

  // Stop TTS playback
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsSpeaking(false)
  }, [])

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

  const stopRecording = useCallback(() => {
    recordingRef.current = false
    setIsRecording(false)
    setInterimText('')

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null

    // Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }

    // Close Deepgram WebSocket
    if (deepgramWsRef.current) {
      if (deepgramWsRef.current.readyState === WebSocket.OPEN) {
        // Send close message to finalize
        deepgramWsRef.current.send(JSON.stringify({ type: 'CloseStream' }))
      }
      deepgramWsRef.current.close()
      deepgramWsRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    setVoiceError(null)

    // Verify user has access to speech services (proxy handles actual auth)
    try {
      await api.getDeepgramToken()
    } catch {
      setVoiceError('Speech-to-text not available')
      return
    }

    // Get microphone access
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('Microphone permission denied')
      } else {
        setVoiceError('Could not access microphone')
      }
      return
    }

    mediaStreamRef.current = stream
    finalTranscriptRef.current = voiceModeRef.current ? '' : input // preserve text only in manual mode
    setIsRecording(true)
    recordingRef.current = true
    if (voiceModeRef.current) setVoiceModeStatus('listening')

    // Open Deepgram WebSocket via backend proxy (handles auth server-side)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const dgUrl = `${wsProtocol}//${window.location.host}/api/deepgram-proxy?` +
      'model=nova-2&language=en&smart_format=true&interim_results=true&endpointing=300&utterance_end_ms=2000&vad_events=true'

    const ws = new WebSocket(dgUrl)
    deepgramWsRef.current = ws

    ws.onopen = () => {
      if (!recordingRef.current) {
        ws.close()
        return
      }

      // Start MediaRecorder to capture audio chunks
      try {
        // Prefer webm/opus (Deepgram auto-detects), fall back to whatever is available
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : ''

        const recorder = new MediaRecorder(stream, {
          ...(mimeType ? { mimeType } : {}),
          audioBitsPerSecond: 64000
        })

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data)
          }
        }

        recorder.start(250) // Send chunks every 250ms
        mediaRecorderRef.current = recorder
      } catch {
        setVoiceError('Could not start audio recording')
        stopRecording()
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'Results') {
          const alt = data.channel?.alternatives?.[0]
          const transcript = alt?.transcript || ''

          if (data.is_final && transcript) {
            // Append final transcript
            const separator = finalTranscriptRef.current ? ' ' : ''
            finalTranscriptRef.current += separator + transcript
            setInput(finalTranscriptRef.current)
            setInterimText('')
          } else if (!data.is_final && transcript) {
            // Show interim text
            setInterimText(transcript)
          }
        } else if (data.type === 'UtteranceEnd') {
          // Auto-send when speaker pauses (voice mode continuous flow)
          const finalText = finalTranscriptRef.current.trim()
          if (finalText && voiceModeRef.current) {
            // Check for voice commands to exit
            const lower = finalText.toLowerCase()
            if (lower === 'stop' || lower === 'exit voice mode' || lower === 'stop listening') {
              setTimeout(() => {
                voiceModeRef.current = false
                setVoiceMode(false)
                setVoiceModeStatus(null)
                stopRecording()
                setInput('')
                finalTranscriptRef.current = ''
              }, 0)
              return
            }
            // Defer to avoid closing WebSocket inside onmessage handler
            setTimeout(() => {
              stopRecording()
              setVoiceModeStatus('processing')
              finalTranscriptRef.current = ''
              setInput('')
              handleSendRef.current(finalText)
            }, 0)
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    ws.onerror = () => {
      if (recordingRef.current) {
        setVoiceError('Voice connection error')
        stopRecording()
        // Auto-retry in voice mode after a delay
        if (voiceModeRef.current) {
          setTimeout(() => { autoResumeRef.current = true }, 2000)
        }
      }
    }

    ws.onclose = () => {
      if (recordingRef.current) {
        stopRecording()
        // Auto-resume in voice mode if not streaming
        if (voiceModeRef.current && !streamingRef.current) {
          setTimeout(() => { autoResumeRef.current = true }, 1000)
        }
      }
    }
  }, [input, stopRecording])

  // Auto-resume recording after TTS finishes in voice mode
  useEffect(() => {
    const interval = setInterval(() => {
      if (autoResumeRef.current && !recordingRef.current && !streamingRef.current) {
        autoResumeRef.current = false
        if (voiceModeRef.current) {
          setVoiceModeStatus('listening')
        }
        startRecording()
      }
    }, 300)
    return () => clearInterval(interval)
  }, [startRecording])

  const exitVoiceMode = useCallback(() => {
    setVoiceMode(false)
    voiceModeRef.current = false
    setVoiceModeStatus(null)
    autoResumeRef.current = false
    stopRecording()
    stopSpeaking()
    setInput('')
    finalTranscriptRef.current = ''
  }, [stopRecording, stopSpeaking])

  // Toggle voice mode on/off (dedicated button)
  const toggleVoiceMode = useCallback(() => {
    if (voiceModeRef.current) {
      exitVoiceMode()
    } else {
      stopSpeaking()
      setVoiceMode(true)
      voiceModeRef.current = true
      setVoiceModeStatus('listening')
      finalTranscriptRef.current = ''
      setInput('')
      startRecording()
    }
  }, [exitVoiceMode, stopSpeaking, startRecording])

  // Manual mic toggle (push-to-talk, only when NOT in voice mode)
  const toggleRecording = useCallback(() => {
    if (voiceModeRef.current) return // Don't use manual mic in voice mode
    if (isRecording) {
      // Manual stop — send if there's text
      const finalText = finalTranscriptRef.current.trim()
      stopRecording()
      if (finalText) {
        setTimeout(() => {
          handleSendRef.current(finalText)
          finalTranscriptRef.current = ''
        }, 100)
      }
    } else {
      // Start manual recording
      stopSpeaking()
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording, stopSpeaking])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current = false
        mediaRecorderRef.current?.stop()
        mediaStreamRef.current?.getTracks().forEach(t => t.stop())
        if (deepgramWsRef.current?.readyState === WebSocket.OPEN) {
          deepgramWsRef.current.send(JSON.stringify({ type: 'CloseStream' }))
          deepgramWsRef.current.close()
        }
      }
    }
  }, [])

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

  const handleSend = async (voiceText?: string) => {
    const msg = (voiceText ?? input).trim()
    if ((!msg && !pendingImage) || streamingRef.current || noProject) return

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

    if (voiceModeRef.current) {
      setVoiceModeStatus('processing')
    }

    // Create placeholder for assistant response
    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: DisplayMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }
    setMessages(prev => [...prev, assistantMsg])

    let fullResponse = ''
    await api.chatStream(
      msg,
      (chunk) => {
        fullResponse += chunk
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
        // Auto-play TTS if voice mode is active
        if (voiceModeRef.current && fullResponse.trim()) {
          setVoiceModeStatus('speaking')
          speakText(fullResponse)
        } else if (voiceModeRef.current) {
          // Empty response — resume listening
          setVoiceModeStatus('listening')
          autoResumeRef.current = true
        }
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
        // In voice mode, resume listening on error instead of exiting
        if (voiceModeRef.current) {
          setVoiceModeStatus('listening')
          autoResumeRef.current = true
        }
      },
      selectedProjectId || undefined,
      imageData || undefined
    )
  }

  // Keep handleSendRef always pointing to the latest handleSend
  handleSendRef.current = handleSend

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
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100dvh-2rem)] md:h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
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
      <div className={`flex-1 min-h-0 bg-gray-900 border rounded-xl overflow-y-auto p-4 space-y-4 mb-4 transition-colors ${
        voiceMode ? 'border-violet-700/50 ring-1 ring-violet-600/20' : 'border-gray-800'
      }`}>
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

      {/* Input area — always pinned at bottom */}
      <div className="flex flex-col flex-shrink-0">
        {/* Voice Mode Banner */}
        {voiceMode && (
          <div className="flex items-center justify-between px-3 py-2 mb-2 bg-violet-950/50 border border-violet-800/50 rounded-xl">
            <div className="flex items-center gap-2">
              {voiceModeStatus === 'listening' && (
                <>
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-green-400 font-medium">🎙️ Listening...</span>
                </>
              )}
              {voiceModeStatus === 'processing' && (
                <>
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-sm text-amber-400 font-medium">⏳ Processing...</span>
                </>
              )}
              {voiceModeStatus === 'speaking' && (
                <>
                  <span className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-pulse" />
                  <span className="text-sm text-violet-400 font-medium">🔊 Synthia is speaking...</span>
                </>
              )}
              {!voiceModeStatus && (
                <>
                  <span className="w-2.5 h-2.5 bg-violet-500 rounded-full" />
                  <span className="text-sm text-violet-400 font-medium">🎙️ Voice Mode Active</span>
                </>
              )}
              {interimText && voiceModeStatus === 'listening' && (
                <span className="text-xs text-gray-500 italic truncate max-w-[200px]">{interimText}</span>
              )}
            </div>
            <span className="text-xs text-gray-600">Say &quot;stop&quot; or tap 🎧 to exit</span>
          </div>
        )}
        {/* Manual recording indicator (non-voice-mode only) */}
        {!voiceMode && isRecording && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400 font-medium">Listening...</span>
            {interimText && (
              <span className="text-xs text-gray-500 italic truncate">{interimText}</span>
            )}
          </div>
        )}
        {/* Voice error */}
        {voiceError && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-xs text-red-400">{voiceError}</span>
            <button onClick={() => setVoiceError(null)} className="text-gray-500 hover:text-gray-300">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
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
              placeholder={noProject ? 'Select a project to start chatting...' : streaming ? 'Synthia is responding...' : voiceMode ? 'Voice mode active — speak to chat...' : 'Message Synthia...'}
              disabled={streaming || noProject || voiceMode}
              rows={1}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-600 resize-none disabled:opacity-50 transition-colors"
              style={{ minHeight: '48px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = '48px'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />
            {!voiceMode && (
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={streaming}
                className="absolute right-2 bottom-2.5 text-gray-500 hover:text-gray-300 disabled:text-gray-700 p-1 transition-colors"
                title="Attach image"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            )}
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
          {supportsVoice && (
            <>
              {/* Voice mode toggle button */}
              <button
                onClick={toggleVoiceMode}
                disabled={(streaming && !voiceMode) || noProject}
                className={`flex-shrink-0 p-3 rounded-xl transition-all ${
                  voiceMode
                    ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white disabled:bg-gray-800 disabled:text-gray-600'
                }`}
                title={voiceMode ? 'Exit voice mode' : 'Enter hands-free voice mode'}
              >
                <Headphones className="w-5 h-5" />
              </button>
              {/* Manual mic button - only when NOT in voice mode */}
              {!voiceMode && (
                <button
                  onClick={isSpeaking ? stopSpeaking : toggleRecording}
                  disabled={streaming || noProject}
                  className={`flex-shrink-0 p-3 rounded-xl transition-colors ${
                    isRecording
                      ? 'mic-recording text-white'
                      : isSpeaking
                        ? 'bg-violet-600 hover:bg-violet-500 text-white'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white disabled:bg-gray-800 disabled:text-gray-600'
                  }`}
                  title={isRecording ? 'Stop recording & send' : isSpeaking ? 'Stop speaking' : 'Voice input'}
                >
                  {isRecording ? <Square className="w-5 h-5" /> : isSpeaking ? <Volume2 className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                </button>
              )}
              {/* Stop speaking button - in voice mode when TTS is playing */}
              {voiceMode && isSpeaking && (
                <button
                  onClick={() => {
                    stopSpeaking()
                    if (voiceModeRef.current) {
                      setVoiceModeStatus('listening')
                      autoResumeRef.current = true
                    }
                  }}
                  className="flex-shrink-0 p-3 rounded-xl transition-colors bg-violet-600 hover:bg-violet-500 text-white"
                  title="Stop speaking & resume listening"
                >
                  <Volume2 className="w-5 h-5 animate-pulse" />
                </button>
              )}
            </>
          )}
          <button
            onClick={() => handleSend()}
            disabled={(!input.trim() && !pendingImage) || streaming || noProject || voiceMode}
            className="flex-shrink-0 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 text-white p-3 rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
