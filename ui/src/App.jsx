import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Send, StopCircle, Paperclip, X, Sparkles, Bot, Hash, ChevronDown, Rocket, Zap, Globe, Cpu } from 'lucide-react'
import { marked } from 'marked'

const API = 'http://localhost:11435'

// Configure marked for safe, clean rendering
marked.setOptions({ breaks: true, gfm: true })

// ── Persona Config ────────────────────────────────────────────────────────────
const PERSONAS = {
  voyager: {
    label: 'Voyager 1 (NASA)',
    icon: Rocket,
    color: 'from-blue-500 to-cyan-400',
    glow: 'rgba(56,189,248,0.4)',
    badge: '🚀 NASA Space Probe',
    desc: 'Interstellar AI from the cosmos',
  },
  jarvis: {
    label: 'J.A.R.V.I.S.',
    icon: Cpu,
    color: 'from-yellow-400 to-orange-500',
    glow: 'rgba(251,191,36,0.4)',
    badge: '🎩 Polished Assistant',
    desc: 'Highly polite & slightly sarcastic',
  },
  cyberpunk: {
    label: 'NEON (Cyberpunk)',
    icon: Zap,
    color: 'from-green-400 to-emerald-500',
    glow: 'rgba(52,211,153,0.4)',
    badge: '🌆 Rogue Hacker AI',
    desc: 'Gritty underground netrunner',
  },
  default: {
    label: 'MythosAI Default',
    icon: Globe,
    color: 'from-accent1 to-accent2',
    glow: 'rgba(124,106,255,0.4)',
    badge: '🧠 Default Intelligence',
    desc: 'Advanced general assistant',
  },
}

// ── Greeting based on time ────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

// ── Custom Hooks ──────────────────────────────────────────────────────────────
function useAutoResize(ref) {
  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [ref])
  return resize
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SidebarSelect({ label, value, onChange, options, Icon }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted mb-2">
        {label}
      </label>
      <div className="relative group">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-elevated border border-white/[0.08] hover:border-white/20 focus:border-accent1/60 focus:ring-2 focus:ring-accent1/20 rounded-xl py-2.5 pl-3 pr-9 text-sm text-primary outline-none transition-all duration-200 cursor-pointer"
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted" />}
          <ChevronDown className="w-3 h-3 text-muted" />
        </div>
      </div>
    </div>
  )
}

function PersonaBadge({ persona }) {
  const cfg = PERSONAS[persona] || PERSONAS.default
  const Icon = cfg.icon
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center shrink-0`}
           style={{ boxShadow: `0 0 12px ${cfg.glow}` }}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-primary truncate">{cfg.badge}</div>
        <div className="text-[10px] text-muted truncate">{cfg.desc}</div>
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 h-6 px-1">
      {[0, 0.18, 0.36].map((delay, i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-accent1/70"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

function AttachmentChip({ att, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-input border border-white/[0.08] px-2.5 py-1.5 rounded-lg text-xs text-secondary">
      {att.type === 'loading'
        ? <><span className="w-2 h-2 rounded-full bg-accent1 animate-pulse" /><span>Uploading {att.filename}…</span></>
        : att.type === 'image'
          ? <><img src={att.url} className="w-5 h-5 rounded object-cover border border-white/10" alt="" /><span className="truncate max-w-[120px]">{att.filename}</span></>
          : <><Paperclip className="w-3.5 h-3.5 shrink-0" /><span className="truncate max-w-[120px]">{att.filename}</span></>
      }
      {att.type !== 'loading' && (
        <button onClick={onRemove} className="ml-1 text-muted hover:text-red-400 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser      = msg.role === 'user'
  const isAssistant = msg.role === 'assistant'
  const isError     = msg.role === 'error'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} gap-3`}
    >
      {/* AI Avatar */}
      {isAssistant && (
        <div className="shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent1 to-accent2 flex items-center justify-center shadow-lg"
               style={{ boxShadow: '0 0 16px rgba(124,106,255,0.35)' }}>
            <Bot className="w-4.5 h-4.5 text-white" />
          </div>
        </div>
      )}

      <div className={`
        max-w-[78%] rounded-2xl text-[14.5px] leading-relaxed
        ${isUser
          ? 'bg-elevated border border-white/[0.07] rounded-tr-sm px-4 py-3 text-primary'
          : isError
            ? 'bg-red-500/10 border border-red-500/25 text-red-400 px-4 py-3 rounded-tl-sm'
            : 'text-primary px-1 py-0.5 rounded-tl-sm'
        }
      `}>
        {/* Attachments row */}
        {isUser && msg.displayAttachments?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {msg.displayAttachments.map((att, j) =>
              att.type === 'image'
                ? <img key={j} src={att.url} className="h-28 rounded-xl border border-white/10 object-cover" alt="uploaded" />
                : <div key={j} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-input rounded-lg text-xs border border-white/[0.08]">
                    <Paperclip className="w-3 h-3" />{att.filename}
                  </div>
            )}
          </div>
        )}

        {/* Content */}
        {isAssistant
          ? msg.isTyping
            ? <TypingDots />
            : <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || '') }} />
          : <div className="whitespace-pre-wrap">{msg.displayContent || msg.content}</div>
        }
      </div>
    </motion.div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [models,        setModels]        = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [persona,       setPersona]       = useState('voyager')
  const [messages,      setMessages]      = useState([])
  const [input,         setInput]         = useState('')
  const [isGenerating,  setIsGenerating]  = useState(false)
  const [attachments,   setAttachments]   = useState([])
  const [status,        setStatus]        = useState('Connecting…')
  const [statusOk,      setStatusOk]      = useState(null)   // null=loading, true=ok, false=error
  const [greeting]                        = useState(getGreeting)

  const chatEndRef = useRef(null)
  const abortCtrl  = useRef(null)
  const textareaRef = useRef(null)
  const resize = useAutoResize(textareaRef)

  // ── Fetch status + models ───────────────────────────────────────────────────
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const r = await fetch(`${API}/api/status`, { signal: AbortSignal.timeout(3000) })
        if (r.ok) { setStatus('Groq connected · 70B ready'); setStatusOk(true) }
        else throw new Error()
      } catch {
        setStatus('API offline'); setStatusOk(false)
      }
    }
    const fetchModels = async () => {
      try {
        const r = await fetch(`${API}/api/tags`)
        if (r.ok) {
          const data = await r.json()
          setModels(data.models)
          if (data.models.length > 0) setSelectedModel(data.models[0].id)
        }
      } catch { /* silent */ }
    }
    checkStatus()
    fetchModels()
    const id = setInterval(checkStatus, 10000)
    return () => clearInterval(id)
  }, [])

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating])

  // ── Auto-resize textarea ────────────────────────────────────────────────────
  useEffect(() => { resize() }, [input, resize])

  // ── File Upload ─────────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const loader = { type: 'loading', filename: file.name }
    setAttachments(prev => [...prev, loader])
    const formData = new FormData()
    formData.append('file', file)
    try {
      const r = await fetch(`${API}/api/upload`, { method: 'POST', body: formData })
      if (!r.ok) throw new Error('Upload failed')
      const data = await r.json()
      setAttachments(prev => prev.map(a => a === loader ? data : a))
    } catch (err) {
      alert(err.message)
      setAttachments(prev => prev.filter(a => a !== loader))
    }
    e.target.value = ''
  }

  // ── Send Message ────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isGenerating) return

    const userText = input.trim()
    setInput('')

    let contentPayload = []
    let pdfText = ''
    let displayAttachments = []

    attachments.forEach(att => {
      if (att.type === 'loading') return
      if (att.type === 'text') {
        pdfText += `[Content of ${att.filename}]:\n${att.content}\n\n`
        displayAttachments.push({ type: 'pdf', filename: att.filename })
      } else if (att.type === 'image') {
        contentPayload.push({ type: 'image_url', image_url: { url: att.url } })
        displayAttachments.push({ type: 'image', url: att.url })
      }
    })

    const combinedText = pdfText + userText
    if (combinedText.trim()) contentPayload.push({ type: 'text', text: combinedText })
    if (contentPayload.length === 0) contentPayload = userText

    const newUserMsg = { role: 'user', content: contentPayload, displayContent: userText, displayAttachments }
    const apiMessages = messages
      .map(m => ({ role: m.role, content: m.content }))
      .concat({ role: 'user', content: contentPayload })

    setMessages(prev => [...prev, newUserMsg, { role: 'assistant', content: '', isTyping: true }])
    setAttachments([])
    setIsGenerating(true)
    abortCtrl.current = new AbortController()

    try {
      const resp = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, persona, messages: apiMessages, stream: true }),
        signal: abortCtrl.current.signal,
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const reader  = resp.body.getReader()
      const decoder = new TextDecoder()
      let fullText  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.message?.content) {
              fullText += parsed.message.content
              setMessages(prev => {
                const arr = [...prev]
                arr[arr.length - 1] = { role: 'assistant', content: fullText, isTyping: false }
                return arr
              })
            }
          } catch (e) {
            if (e.name !== 'SyntaxError') throw e
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const arr = [...prev]
          arr[arr.length - 1] = { role: 'error', content: `Error: ${err.message}` }
          return arr
        })
      }
    } finally {
      setIsGenerating(false)
      abortCtrl.current = null
    }
  }

  const stopGeneration = () => abortCtrl.current?.abort()

  const personaCfg = PERSONAS[persona] || PERSONAS.default
  const PersonaIcon = personaCfg.icon

  return (
    <div className="flex h-screen w-screen bg-base text-primary overflow-hidden" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col z-20 border-r border-white/[0.06]" style={{ background: '#0c0c14' }}>

        {/* Logo */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-3 mb-5">
            <motion.div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent1 to-accent2 flex items-center justify-center shrink-0"
              animate={{ boxShadow: ['0 0 12px rgba(124,106,255,0.3)', '0 0 24px rgba(168,85,247,0.5)', '0 0 12px rgba(124,106,255,0.3)'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <div className="font-semibold text-[15px] tracking-tight text-white">MythosAI</div>
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold bg-gradient-to-r from-accent1 to-accent2 bg-clip-text text-transparent">
                Groq Powered
              </div>
            </div>
          </div>

          {/* New Chat */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setMessages([])}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-white transition-all duration-200 border"
            style={{
              background: 'linear-gradient(135deg, rgba(124,106,255,0.15), rgba(168,85,247,0.08))',
              borderColor: 'rgba(124,106,255,0.25)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(124,106,255,0.5)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(124,106,255,0.25)'}
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </motion.button>
        </div>

        {/* Controls */}
        <div className="px-4 pb-4 space-y-4 border-b border-white/[0.05]">
          <SidebarSelect
            label="Model"
            value={selectedModel}
            onChange={setSelectedModel}
            Icon={Hash}
            options={models.length
              ? models.map(m => ({ value: m.id, label: m.name }))
              : [{ value: '', label: 'Loading models…' }]
            }
          />
          <SidebarSelect
            label="Personality"
            value={persona}
            onChange={setPersona}
            options={Object.entries(PERSONAS).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <PersonaBadge persona={persona} />
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted mb-3">Recent</div>
          {messages.filter(m => m.role === 'user').slice(0, 8).map((m, i) => (
            <div key={i} className="text-xs text-muted/70 py-1.5 px-2 rounded-lg truncate hover:bg-white/[0.03] hover:text-secondary transition-colors cursor-default">
              {(m.displayContent || m.content || '').toString().slice(0, 45) || 'Attachment message'}
            </div>
          ))}
          {messages.filter(m => m.role === 'user').length === 0 && (
            <div className="text-xs text-muted/50 italic px-2">No conversations yet</div>
          )}
        </div>

        {/* Status */}
        <div className="p-4 border-t border-white/[0.05] flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            statusOk === null ? 'bg-yellow-400 animate-pulse' :
            statusOk ? 'bg-green-400' : 'bg-red-400'
          }`} style={statusOk ? { boxShadow: '0 0 8px rgba(74,222,128,0.6)' } : {}} />
          <span className="text-xs text-muted font-medium truncate">{status}</span>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-base">

        {/* Top bar showing active persona */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.05] shrink-0"
             style={{ background: 'rgba(9,9,15,0.8)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${personaCfg.color} flex items-center justify-center`}
                 style={{ boxShadow: `0 0 12px ${personaCfg.glow}` }}>
              <PersonaIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">{personaCfg.label}</span>
            <span className="text-xs text-muted hidden sm:inline">· {personaCfg.desc}</span>
          </div>
          <div className="flex items-center gap-2">
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-xs text-accent1 font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent1 animate-pulse" />
                Generating…
              </motion.div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 pb-44 pt-8 flex flex-col items-center">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="flex flex-col items-center justify-center h-full w-full max-w-2xl text-center"
            >
              <motion.div
                className={`w-24 h-24 rounded-[28px] bg-gradient-to-br ${personaCfg.color} flex items-center justify-center mb-8`}
                animate={{
                  boxShadow: [
                    `0 0 24px ${personaCfg.glow}`,
                    `0 0 64px ${personaCfg.glow.replace('0.4', '0.8')}`,
                    `0 0 24px ${personaCfg.glow}`,
                  ],
                  y: [0, -8, 0],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <PersonaIcon className="w-12 h-12 text-white" />
              </motion.div>

              <h1 className="text-4xl font-bold tracking-tight mb-3 bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent">
                {greeting}
              </h1>
              <p className="text-secondary text-base max-w-md leading-relaxed">
                You're talking to <span className="text-white font-medium">{personaCfg.label}</span>.{' '}
                {personaCfg.desc}. Ask anything!
              </p>

              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-2 mt-8 justify-center">
                {['Who are you?', 'Tell me about the cosmos', 'What is dark matter?', 'Explain quantum entanglement'].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); textareaRef.current?.focus() }}
                    className="px-4 py-2 rounded-xl text-sm text-secondary border border-white/[0.07] hover:border-accent1/40 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="w-full max-w-3xl flex flex-col gap-5">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* ── Input Bar ───────────────────────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center px-4 pb-6 pt-16"
             style={{ background: 'linear-gradient(to top, #09090f 50%, transparent)' }}>
          <div className="w-full max-w-3xl">

            {/* Attachment chips */}
            <AnimatePresence>
              {attachments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2 mb-2 px-1"
                >
                  {attachments.map((att, idx) => (
                    <AttachmentChip key={idx} att={att} onRemove={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main input box */}
            <motion.div
              className="flex items-end gap-2 rounded-2xl border px-3 py-3 transition-all duration-300"
              style={{
                background: 'rgba(15,15,24,0.9)',
                backdropFilter: 'blur(20px)',
                borderColor: 'rgba(255,255,255,0.08)',
                boxShadow: '0 4px 40px rgba(0,0,0,0.5)',
              }}
              whileFocusWithin={{
                borderColor: 'rgba(124,106,255,0.45)',
                boxShadow: '0 4px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,106,255,0.2), 0 0 30px rgba(124,106,255,0.08)',
              }}
            >
              {/* Attach button */}
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/*,application/pdf,.zip,application/zip"
                onChange={handleFileUpload}
              />
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => document.getElementById('file-upload').click()}
                className="p-2 text-muted hover:text-white rounded-xl transition-colors shrink-0"
                title="Attach file (PDF, image, ZIP)"
              >
                <Paperclip className="w-5 h-5" />
              </motion.button>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
                placeholder="Message MythosAI…"
                rows={1}
                className="flex-1 bg-transparent border-none outline-none resize-none text-[14.5px] text-primary placeholder-muted leading-relaxed py-1.5 min-h-[28px] max-h-[200px]"
                style={{ overflowY: 'auto' }}
              />

              {/* Send / Stop */}
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.button
                    key="stop"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={stopGeneration}
                    className="p-2 bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25 hover:border-red-500/50 rounded-xl transition-all shrink-0"
                    title="Stop generation"
                  >
                    <StopCircle className="w-5 h-5" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="send"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={sendMessage}
                    disabled={!input.trim() && attachments.length === 0}
                    className="p-2 rounded-xl transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #7c6aff, #a855f7)',
                      boxShadow: '0 0 16px rgba(124,106,255,0.35)',
                    }}
                    onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.boxShadow = '0 0 28px rgba(124,106,255,0.6)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 16px rgba(124,106,255,0.35)' }}
                    title="Send message (Enter)"
                  >
                    <Send className="w-5 h-5 text-white" />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="text-center text-[11px] text-muted/50 mt-2">
              Press <kbd className="px-1 py-0.5 bg-white/5 rounded text-muted/70 text-[10px]">Enter</kbd> to send · <kbd className="px-1 py-0.5 bg-white/5 rounded text-muted/70 text-[10px]">Shift+Enter</kbd> for new line
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
