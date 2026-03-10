import type { ReactNode } from 'react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Zap, Send, Trash2, Lock, X, Mic, Square, Volume2, Headphones, Paperclip } from 'lucide-react'
import { api } from '../services/api'

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
}

function renderMarkdown(text: string) {
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
          {segment.lang && <div className="text-xs text-gray-500 mb-1">{segment.lang}</div>}
          <code className="text-gray-300">{segment.content}</code>
        </pre>
      )
    } else {
      const lines = segment.content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i]

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
          if (i < lines.length - 1) parts.push(<br key={key++} />)
        }
      }
    }
  }

  return parts
}

function renderInlineText(text: string, baseKey: number): (string | ReactNode)[] {
  const parts: (string | ReactNode)[] = []
  let key = baseKey

  const boldRegex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push(<strong key={key++} className="font-semibold text-gray-100">{match[1]}</strong>)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  if (parts.length === 0) parts.push(text)

  return parts
}

export default function FullChatPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceMode, setVoiceMode] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceModeStatus, setVoiceModeStatus] = useState<'listening' | 'processing' | 'speaking' | null>(null)
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [voiceLang, setVoiceLang] = useState<'auto' | 'en' | 'zh'>(() => {
    // Load saved preference from localStorage, default to 'en'
    const saved = localStorage.getItem('synthia-voice-lang')
    return (saved === 'auto' || saved === 'en' || saved === 'zh') ? saved : 'en'
  })
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
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

  const supportsVoice = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Save voice language preference to localStorage
  useEffect(() => {
    localStorage.setItem('synthia-voice-lang', voiceLang)
  }, [voiceLang])

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
        body: JSON.stringify({ text: text.slice(0, 4000) }),
      })
      if (!resp.ok) throw new Error('TTS failed')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)

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
        if (voiceModeRef.current) autoResumeRef.current = true
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
        audioRef.current = null
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

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsSpeaking(false)
  }, [])

  // Check access on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const resp = await api.getFullChatAccess()
        setHasAccess(resp.hasAccess)
      } catch {
        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }
    checkAccess()
  }, [])

  const stopRecording = useCallback(() => {
    recordingRef.current = false
    setIsRecording(false)
    setInterimText('')

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }

    if (deepgramWsRef.current) {
      if (deepgramWsRef.current.readyState === WebSocket.OPEN) {
        deepgramWsRef.current.send(JSON.stringify({ type: 'CloseStream' }))
      }
      deepgramWsRef.current.close()
      deepgramWsRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    setVoiceError(null)

    let stream: MediaStream
    try {
      // Request 16kHz mono audio like CASEC
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      })
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('麦克风权限被拒绝 / Microphone permission denied')
      } else {
        setVoiceError('无法访问麦克风 / Could not access microphone')
      }
      return
    }

    mediaStreamRef.current = stream
    finalTranscriptRef.current = voiceModeRef.current ? '' : input
    setIsRecording(true)
    recordingRef.current = true
    if (voiceModeRef.current) setVoiceModeStatus('listening')

    // Direct connection to Deepgram (like CASEC) - use same working API key
    const DEEPGRAM_API_KEY = '7b6dcb8a7b12b97ab4196cec7ee1163ac8f792c7'
    // endpointing + utterance_end_ms for auto-send on pause
    // Language: auto-detect, English, or Chinese
    const langParam = voiceLang === 'auto' 
      ? 'detect_language=true' 
      : `language=${voiceLang}`
    const dgParams = `model=nova-2&encoding=linear16&sample_rate=16000&channels=1&punctuate=true&interim_results=true&smart_format=true&${langParam}&endpointing=300&utterance_end_ms=1500&vad_events=true`
    const dgUrl = `wss://api.deepgram.com/v1/listen?${dgParams}`

    console.log('Connecting to Deepgram directly (like CASEC)...')
    const ws = new WebSocket(dgUrl, ['token', DEEPGRAM_API_KEY])
    ws.binaryType = 'arraybuffer'
    deepgramWsRef.current = ws

    // Set up AudioContext for PCM conversion (like CASEC)
    let audioContext: AudioContext | null = null
    let processor: ScriptProcessorNode | null = null

    ws.onopen = () => {
      console.log('WebSocket opened, recordingRef:', recordingRef.current)
      if (!recordingRef.current) {
        console.log('Recording not active, closing WebSocket')
        ws.close()
        return
      }

      try {
        // Create AudioContext at 16kHz for Deepgram
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
        const source = audioContext.createMediaStreamSource(stream)
        
        // Create ScriptProcessor for PCM conversion
        processor = audioContext.createScriptProcessor(4096, 1, 1)
        source.connect(processor)
        processor.connect(audioContext.destination)
        
        let audioChunkCount = 0
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.log('WebSocket not open, skipping audio chunk')
            return
          }
          
          const inputData = e.inputBuffer.getChannelData(0)
          const int16Data = new Int16Array(inputData.length)
          
          // Convert float32 to int16
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]))
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
          
          audioChunkCount++
          if (audioChunkCount <= 5 || audioChunkCount % 20 === 0) {
            console.log(`Sending audio chunk #${audioChunkCount}: ${int16Data.buffer.byteLength} bytes`)
          }
          ws.send(int16Data.buffer)
        }
        
        console.log('AudioContext + ScriptProcessor started (Linear16 PCM @ 16kHz)')
      } catch (err) {
        console.error('AudioContext setup error:', err)
        setVoiceError('无法启动录音 / Could not start recording')
        stopRecording()
      }
    }
    
    // Store cleanup function
    const cleanupAudio = () => {
      if (processor) {
        processor.disconnect()
        processor = null
      }
      if (audioContext) {
        audioContext.close()
        audioContext = null
      }
    }
    
    ws.onclose = (event) => {
      console.log('WebSocket closed, code:', event.code, 'reason:', event.reason)
      cleanupAudio()
      if (recordingRef.current) {
        stopRecording()
        if (voiceModeRef.current && !streamingRef.current) {
          setTimeout(() => { autoResumeRef.current = true }, 1000)
        }
      }
    }

    ws.onmessage = (event) => {
      console.log('WebSocket message received:', typeof event.data === 'string' ? event.data.slice(0, 200) : '[binary]')
      try {
        const data = JSON.parse(event.data)
        console.log('Parsed message type:', data.type)
        
        // Log errors from Deepgram
        if (data.type === 'Error' || data.error) {
          console.error('Deepgram error:', data)
          setVoiceError(data.message || data.error || 'Deepgram error')
          return
        }
        
        if (data.type === 'Results') {
          const alt = data.channel?.alternatives?.[0]
          const transcript = alt?.transcript || ''

          if (data.is_final && transcript) {
            const separator = finalTranscriptRef.current ? ' ' : ''
            finalTranscriptRef.current += separator + transcript
            setInput(finalTranscriptRef.current)
            setInterimText('')
          } else if (!data.is_final && transcript) {
            setInterimText(transcript)
          }
        } else if (data.type === 'UtteranceEnd') {
          const finalText = finalTranscriptRef.current.trim()
          if (finalText && voiceModeRef.current) {
            const lower = finalText.toLowerCase()
            if (lower === 'stop' || lower === '停止' || lower === 'exit voice mode' || lower === 'stop listening') {
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
            setTimeout(() => {
              stopRecording()
              setVoiceModeStatus('processing')
              finalTranscriptRef.current = ''
              setInput('')
              handleSendRef.current(finalText)
            }, 0)
          }
        }
      } catch (e) {
        console.warn('Failed to parse WebSocket message:', e)
      }
    }

    ws.onerror = (event) => {
      console.error('Deepgram WebSocket error:', event)
      if (recordingRef.current) {
        setVoiceError('语音连接错误 / Voice connection error')
        stopRecording()
        if (voiceModeRef.current) {
          setTimeout(() => { autoResumeRef.current = true }, 2000)
        }
      }
    }

    ws.onclose = (event) => {
      console.log('WebSocket closed, code:', event.code, 'reason:', event.reason)
      if (recordingRef.current) {
        stopRecording()
        if (voiceModeRef.current && !streamingRef.current) {
          setTimeout(() => { autoResumeRef.current = true }, 1000)
        }
      }
    }
  }, [input, stopRecording, voiceLang])

  // Auto-resume recording after TTS in voice mode
  useEffect(() => {
    const interval = setInterval(() => {
      if (autoResumeRef.current && !recordingRef.current && !streamingRef.current) {
        autoResumeRef.current = false
        if (voiceModeRef.current) setVoiceModeStatus('listening')
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

  const toggleRecording = useCallback(() => {
    if (voiceModeRef.current) return
    if (isRecording) {
      const finalText = finalTranscriptRef.current.trim()
      stopRecording()
      if (finalText) {
        setTimeout(() => {
          handleSendRef.current(finalText)
          finalTranscriptRef.current = ''
        }, 100)
      }
    } else {
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

  const handleSend = async (voiceText?: string) => {
    const msg = (voiceText ?? input).trim()
    if ((!msg && !pendingImage) || streamingRef.current) return

    // Upload image if pending
    let imageUrl: string | undefined
    if (pendingImage) {
      setUploadingImage(true)
      try {
        const formData = new FormData()
        formData.append('file', pendingImage.file)
        const token = localStorage.getItem('token')
        const resp = await fetch('/api/chat/upload-image', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData
        })
        if (resp.ok) {
          const data = await resp.json()
          imageUrl = data.url
        }
      } catch {
        // Continue without image if upload fails
      } finally {
        setUploadingImage(false)
        clearPendingImage()
      }
    }

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: msg || (imageUrl ? '📷 [Image]' : ''),
      imageUrl,
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    streamingRef.current = true

    if (voiceModeRef.current) setVoiceModeStatus('processing')

    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: DisplayMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }
    setMessages(prev => [...prev, assistantMsg])

    let fullResponse = ''
    
    try {
      // Build history (last 20 messages for context)
      const historyMsgs = [...messages.slice(-20), userMsg].map(m => ({
        role: m.role,
        content: m.content,
        ...(m.imageUrl ? { imageUrl: m.imageUrl } : {})
      }))

      await api.streamFullChat(
        msg,
        historyMsgs,
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
          if (voiceModeRef.current && fullResponse.trim()) {
            setVoiceModeStatus('speaking')
            speakText(fullResponse)
          } else if (voiceModeRef.current) {
            setVoiceModeStatus('listening')
            autoResumeRef.current = true
          }
        },
        (error) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId ? { ...m, content: `⚠️ ${error}` } : m
            )
          )
          setStreaming(false)
          streamingRef.current = false
          if (voiceModeRef.current) {
            setVoiceModeStatus('listening')
            autoResumeRef.current = true
          }
        }
      )
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? { ...m, content: '⚠️ 连接错误 / Connection error' } : m
        )
      )
      setStreaming(false)
      streamingRef.current = false
    }
  }

  handleSendRef.current = handleSend

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([])
    setShowClearConfirm(false)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setVoiceError('请选择图片文件 / Please select an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setVoiceError('图片太大 (最大10MB) / Image too large (max 10MB)')
      return
    }
    
    const preview = URL.createObjectURL(file)
    setPendingImage({ file, preview })
    
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const clearPendingImage = () => {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.preview)
      setPendingImage(null)
    }
  }

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

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-8">
          <Zap className="w-8 h-8 text-violet-400" />
          与 Synthia 对话 / Chat with Synthia
        </h1>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Lock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-300 mb-2">需要完整访问权限 / Full Access Required</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            您还没有完整聊天访问权限。请联系管理员为您启用此功能。<br/>
            You don't have full chat access yet. Ask the admin to enable it for your account.
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
          <h1 className="text-2xl font-bold">Synthia</h1>
          <span className="text-sm text-gray-500">完整访问 / Full Access</span>
        </div>
        <div className="relative">
          {showClearConfirm ? (
            <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-400">清除所有消息？/ Clear all?</span>
              <button onClick={handleClear} className="text-xs text-red-400 hover:text-red-300 font-medium">是 / Yes</button>
              <button onClick={() => setShowClearConfirm(false)} className="text-xs text-gray-500 hover:text-gray-300">否 / No</button>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-gray-600 hover:text-gray-400 transition-colors p-2 rounded-lg hover:bg-gray-900"
              title="清除聊天记录 / Clear chat history"
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
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Zap className="w-10 h-10 text-violet-400/50 mb-3" />
            <p className="text-gray-500 text-lg mb-1">开始与 Synthia 对话</p>
            <p className="text-gray-600 text-sm">Start a conversation with Synthia</p>
            <p className="text-gray-700 text-xs mt-4">
              支持中文和英文 / Supports Chinese and English
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center mr-2 mt-1">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-gray-800 text-gray-100'
                : 'bg-gray-800/50 border border-gray-800 text-gray-200'
            }`}>
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {msg.imageUrl && (
                  <img 
                    src={msg.imageUrl} 
                    alt="Uploaded" 
                    className="max-w-full max-h-64 rounded-lg mb-2 cursor-pointer hover:opacity-90"
                    onClick={() => window.open(msg.imageUrl, '_blank')}
                  />
                )}
                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              </div>
            </div>
          </div>
        ))}

        {streaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div className="flex items-center gap-2 text-gray-500 text-sm pl-9">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            Synthia 正在输入... / typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex flex-col flex-shrink-0">
        {voiceMode && (
          <div className="flex items-center justify-between px-3 py-2 mb-2 bg-violet-950/50 border border-violet-800/50 rounded-xl">
            <div className="flex items-center gap-2">
              {voiceModeStatus === 'listening' && (
                <>
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-green-400 font-medium">🎙️ 正在聆听... / Listening...</span>
                </>
              )}
              {voiceModeStatus === 'processing' && (
                <>
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-sm text-amber-400 font-medium">⏳ 处理中... / Processing...</span>
                </>
              )}
              {voiceModeStatus === 'speaking' && (
                <>
                  <span className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-pulse" />
                  <span className="text-sm text-violet-400 font-medium">🔊 Synthia 正在说话...</span>
                </>
              )}
              {interimText && voiceModeStatus === 'listening' && (
                <span className="text-xs text-gray-500 italic truncate max-w-[200px]">{interimText}</span>
              )}
            </div>
            <span className="text-xs text-gray-600">说"停止"或点击 🎧 退出 / Say "stop" or tap 🎧</span>
            {/* Language selector */}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setVoiceLang('auto')}
                className={`px-2 py-0.5 text-xs rounded ${voiceLang === 'auto' ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
              >Auto</button>
              <button
                onClick={() => setVoiceLang('en')}
                className={`px-2 py-0.5 text-xs rounded ${voiceLang === 'en' ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
              >EN</button>
              <button
                onClick={() => setVoiceLang('zh')}
                className={`px-2 py-0.5 text-xs rounded ${voiceLang === 'zh' ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
              >中</button>
            </div>
          </div>
        )}

        {!voiceMode && isRecording && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400 font-medium">正在聆听... / Listening...</span>
            {interimText && <span className="text-xs text-gray-500 italic truncate">{interimText}</span>}
            {/* Language selector */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setVoiceLang('auto')}
                className={`px-2 py-0.5 text-xs rounded ${voiceLang === 'auto' ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
              >Auto</button>
              <button
                onClick={() => setVoiceLang('en')}
                className={`px-2 py-0.5 text-xs rounded ${voiceLang === 'en' ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
              >EN</button>
              <button
                onClick={() => setVoiceLang('zh')}
                className={`px-2 py-0.5 text-xs rounded ${voiceLang === 'zh' ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
              >中</button>
            </div>
          </div>
        )}

        {voiceError && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-xs text-red-400">{voiceError}</span>
            <button onClick={() => setVoiceError(null)} className="text-gray-500 hover:text-gray-300">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Pending image preview */}
        {pendingImage && (
          <div className="relative mb-2 inline-block">
            <img 
              src={pendingImage.preview} 
              alt="Pending upload" 
              className="max-h-32 rounded-lg border border-gray-700"
            />
            <button
              onClick={clearPendingImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            {uploadingImage && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <span className="text-xs text-white">上传中...</span>
              </div>
            )}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        <div className="flex gap-2 items-center w-full min-w-0">
          {/* Image attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming || voiceMode || uploadingImage}
            className="flex-shrink-0 w-12 h-12 rounded-xl transition-colors bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white disabled:bg-gray-800 disabled:text-gray-600 flex items-center justify-center"
            title="附加图片 / Attach image"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={streaming ? 'Synthia 正在回复...' : voiceMode ? '语音模式...' : '输入消息... / Type a message...'}
              disabled={streaming || voiceMode}
              rows={1}
              className="w-full h-12 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-base text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:bg-gray-900 resize-none disabled:opacity-50 transition-all"
              style={{ minHeight: '48px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = '48px'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />
          </div>

          {supportsVoice && (
            <>
              <button
                onClick={toggleVoiceMode}
                disabled={(streaming && !voiceMode)}
                className={`flex-shrink-0 w-12 h-12 rounded-xl transition-all flex items-center justify-center ${
                  voiceMode
                    ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white disabled:bg-gray-800 disabled:text-gray-600'
                }`}
                title={voiceMode ? '退出语音模式 / Exit voice mode' : '进入语音模式 / Enter voice mode'}
              >
                <Headphones className="w-5 h-5" />
              </button>

              {/* Language selector - always visible when not in voice mode */}
              {!voiceMode && !isRecording && (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setVoiceLang('en')}
                    className={`px-1.5 py-1 text-xs rounded-l ${voiceLang === 'en' ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                    title="English"
                  >EN</button>
                  <button
                    onClick={() => setVoiceLang('zh')}
                    className={`px-1.5 py-1 text-xs rounded-r ${voiceLang === 'zh' ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                    title="中文"
                  >中</button>
                </div>
              )}

              {!voiceMode && (
                <button
                  onClick={isSpeaking ? stopSpeaking : toggleRecording}
                  disabled={streaming}
                  className={`flex-shrink-0 w-12 h-12 rounded-xl transition-colors flex items-center justify-center ${
                    isRecording
                      ? 'mic-recording text-white'
                      : isSpeaking
                        ? 'bg-violet-600 hover:bg-violet-500 text-white'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white disabled:bg-gray-800 disabled:text-gray-600'
                  }`}
                  title={isRecording ? '停止录音 / Stop recording' : isSpeaking ? '停止播放 / Stop speaking' : `语音输入 (${voiceLang === 'en' ? 'EN' : '中'}) / Voice input`}
                >
                  {isRecording ? <Square className="w-5 h-5" /> : isSpeaking ? <Volume2 className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                </button>
              )}

              {voiceMode && isSpeaking && (
                <button
                  onClick={() => {
                    stopSpeaking()
                    if (voiceModeRef.current) {
                      setVoiceModeStatus('listening')
                      autoResumeRef.current = true
                    }
                  }}
                  className="flex-shrink-0 w-12 h-12 rounded-xl transition-colors bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center"
                  title="停止播放并继续聆听 / Stop speaking & resume listening"
                >
                  <Volume2 className="w-5 h-5 animate-pulse" />
                </button>
              )}
            </>
          )}

          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || streaming || voiceMode}
            className="flex-shrink-0 w-12 h-12 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl transition-colors flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
