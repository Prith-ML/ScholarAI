"use client"

import type React from "react"
import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  Send,
  Sparkles,
  Bot,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  ArrowUp,
  BookmarkPlus,
  BookmarkCheck,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react"
import TextareaAutosize from "react-textarea-autosize"
import ReactMarkdown from "react-markdown"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DottedSurface } from "@/components/ui/dotted-surface"
import AppShell from "@/components/AppShell"
import { apiFetch } from "@/lib/api"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: any
  notionUrl?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

const TypingIndicator = () => {
  const reduce = useReducedMotion()

  return (
    <div className="flex items-center gap-3 text-white/60">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400"
            animate={reduce ? {} : { y: [0, -7, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </div>
      <span className="text-sm font-medium bg-gradient-to-r from-white/50 via-white/90 to-white/50 bg-clip-text text-transparent bg-[length:200%_100%] animate-[shimmer_2s_ease-in-out_infinite]">
        Synthesizing sources...
      </span>
    </div>
  )
}

const MessageActions = ({ message }: { message: Message }) => {
  const [notionUrl, setNotionUrl] = useState<string | null>(message.notionUrl ?? null)
  const [saving, setSaving] = useState(false)
  const [notionError, setNotionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(null)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy - try selecting the text instead")
    }
  }

  const toggleFeedback = (value: "good" | "bad") => {
    setFeedback((prev) => (prev === value ? null : value))
  }

  const saveToNotion = async () => {
    setSaving(true)
    setNotionError(null)
    try {
      const response = await apiFetch(`/api/chat/messages/${message.id}/save-to-notion/`, {
        method: "POST",
      })
      const data = await response.json()
      if (!response.ok || data.error) {
        const msg = data.error || "Failed to save to Notion"
        setNotionError(msg)
        toast.error(msg)
      } else {
        setNotionUrl(data.notion_url)
        toast.success("Saved to Notion", {
          description: "Your research note is ready to view.",
          action: {
            label: "Open",
            onClick: () => window.open(data.notion_url, "_blank", "noopener,noreferrer"),
          },
        })
      }
    } catch {
      const msg = "Failed to save to Notion"
      setNotionError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const actionButtonClass = "app-glass text-white/50 rounded-lg h-8 px-2.5 transition-colors duration-200"

  return (
    <motion.div className="flex flex-wrap items-center gap-1.5 mt-3">
      <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
        <Button size="sm" onClick={copyToClipboard} className={`${actionButtonClass} hover:text-white hover:bg-white/10`}>
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span key="copied" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center">
                <Check className="w-3 h-3 mr-1.5 text-emerald-400" />
                Copied
              </motion.span>
            ) : (
              <motion.span key="copy" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center">
                <Copy className="w-3 h-3 mr-1.5" />
                Copy
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
        <Button
          size="sm"
          aria-pressed={feedback === "good"}
          onClick={() => toggleFeedback("good")}
          className={`${actionButtonClass} ${
            feedback === "good" ? "text-emerald-400 bg-emerald-500/15" : "hover:text-emerald-400 hover:bg-emerald-500/10"
          }`}
        >
          <ThumbsUp className="w-3 h-3" />
        </Button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
        <Button
          size="sm"
          aria-pressed={feedback === "bad"}
          onClick={() => toggleFeedback("bad")}
          className={`${actionButtonClass} ${
            feedback === "bad" ? "text-red-400 bg-red-500/15" : "hover:text-red-400 hover:bg-red-500/10"
          }`}
        >
          <ThumbsDown className="w-3 h-3" />
        </Button>
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        {notionUrl ? (
          <motion.div key="saved" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button asChild size="sm" className={`${actionButtonClass} text-fuchsia-300 hover:text-fuchsia-200 hover:bg-fuchsia-500/10`}>
              <a href={notionUrl} target="_blank" rel="noopener noreferrer">
                <BookmarkCheck className="w-3 h-3 mr-1.5" />
                View in Notion
              </a>
            </Button>
          </motion.div>
        ) : (
          <motion.div key="save" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} whileHover={saving ? {} : { scale: 1.05 }} whileTap={saving ? {} : { scale: 0.95 }}>
            <Button size="sm" disabled={saving} onClick={saveToNotion} className={`${actionButtonClass} hover:text-white hover:bg-white/10 disabled:opacity-70`}>
              <AnimatePresence mode="wait" initial={false}>
                {saving ? (
                  <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center">
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    Saving...
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center">
                    <BookmarkPlus className="w-3 h-3 mr-1.5" />
                    Save to Notion
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {notionError && !notionUrl && (
        <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          {notionError}
        </motion.span>
      )}
    </motion.div>
  )
}

const WelcomeScreen = ({ onSuggestionClick }: { onSuggestionClick: (suggestion: string) => void }) => {
  const suggestions = [
    "Explain quantum computing applications in cryptography",
    "Summarize recent advances in machine learning",
    "Compare different renewable energy technologies",
  ]

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-12">
      <div className="max-w-3xl w-full text-center">
        <motion.div variants={item} className="mb-10">
          <div className="w-16 h-16 mx-auto mb-8 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-2xl blur-xl opacity-50 animate-pulse-glow" />
            <div className="relative w-full h-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
            What are we <span className="gradient-text">investigating</span> today?
          </h1>
          <p className="text-base sm:text-lg text-white/60 max-w-xl mx-auto leading-relaxed">
            Ask a research question and I&apos;ll synthesize academic papers and industry sources into a grounded answer.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-1 gap-3">
          {suggestions.map((suggestion, index) => (
            <motion.div key={index} variants={item} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
              <Card
                className="app-panel glow-border hover:shadow-lg cursor-pointer group text-left"
                onClick={() => onSuggestionClick(suggestion)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-indigo-300" />
                  </div>
                  <p className="text-sm text-white/70 group-hover:text-white transition-colors duration-300">{suggestion}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function ChatPageContent() {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const sessionIdFromUrl = searchParams.get('session_id')
    if (sessionIdFromUrl && !sessionId) {
      setSessionId(sessionIdFromUrl)
    }
  }, [searchParams, sessionId])

  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100)
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [messages.length])

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputMessage
    if (!textToSend.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputMessage("")
    setIsLoading(true)

    try {
      const response = await apiFetch(`/api/chat/send/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, session_id: sessionId }),
      })

      const data = await response.json()
      const assistantMessage: Message = {
        id: data.message_id ? data.message_id.toString() : (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        sources: data.sources || [],
      }

      setMessages((prev) => [...prev, assistantMessage])
      if (data.session_id && !sessionId) setSessionId(data.session_id)
    } catch (error) {
      console.error(error)
      toast.error("Connection trouble", { description: "Couldn't reach the research assistant. Please try again." })
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const startNewChat = () => {
    setMessages([])
    setSessionId(null)
  }

  return (
    <div className="relative flex flex-col h-[100dvh] overflow-hidden">
      {/* Ambient background - confined to this chat column (via the parent's
          `relative`, which overrides the component's default fixed/viewport
          positioning), not the sidebar. Skipped under reduced-motion, same as
          the home page's shader background - this is a continuous WebGL
          animation loop with no built-in reduced-motion handling. */}
      {!reduceMotion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0 z-0"
        >
          <DottedSurface className="absolute inset-0 opacity-30" />
        </motion.div>
      )}

      {/* Slim session toolbar */}
      <div className="relative z-10 shrink-0 border-b border-white/[0.06] app-glass">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.p
                key={sessionId ? "resumed" : "new"}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2 }}
                className="text-sm font-semibold text-white truncate"
              >
                {sessionId ? "Continuing research session" : "New research session"}
              </motion.p>
            </AnimatePresence>
            <p className="text-xs text-white/40">Grounded in academic and industry sources</p>
          </div>
          {messages.length > 0 && (
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Button
                onClick={startNewChat}
                size="sm"
                className="app-glass text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:mr-2" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Message area */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <WelcomeScreen onSuggestionClick={(suggestion) => sendMessage(suggestion)} />
        ) : (
          <div ref={chatContainerRef} className="h-full overflow-y-auto scrollbar-custom">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: "easeOut" }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 mr-3 mt-1">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[85%] sm:max-w-[75%] ${msg.role === "user" ? "" : "min-w-0"}`}>
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          msg.role === "user"
                            ? "bubble-user text-white rounded-tr-sm"
                            : "bubble-assistant text-white/90 rounded-tl-sm"
                        }`}
                      >
                        <div className="chat-message text-[15px] leading-relaxed break-words">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                      <p className={`text-[11px] text-white/30 mt-1.5 ${msg.role === "user" ? "text-right" : ""}`}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                      {msg.role === "assistant" && <MessageActions message={msg} />}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 mr-3 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bubble-assistant rounded-2xl rounded-tl-sm px-4 py-3">
                    <TypingIndicator />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        <AnimatePresence>
          {showScrollButton && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              className="absolute bottom-6 right-6 z-20"
            >
              <Button onClick={scrollToBottom} aria-label="Scroll to latest message" className="w-11 h-11 rounded-full app-glass hover:shadow-lg" size="sm">
                <ArrowUp className="w-4 h-4 text-white" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="relative z-10 shrink-0 border-t border-white/[0.06] app-glass">
        <div className="max-w-3xl mx-auto p-4 sm:p-5">
          <div className="relative app-panel glow-border rounded-2xl focus-within:shadow-lg focus-within:shadow-indigo-500/10">
            <TextareaAutosize
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a research question..."
              className="w-full bg-transparent text-white placeholder-white/40 p-4 pr-14 resize-none focus:outline-none text-[15px] leading-relaxed"
              minRows={1}
              maxRows={6}
              disabled={isLoading}
              aria-label="Research question"
            />
            <motion.div
              className="absolute right-2.5 bottom-2.5"
              whileHover={inputMessage.trim() && !isLoading ? { scale: 1.08 } : {}}
              whileTap={inputMessage.trim() && !isLoading ? { scale: 0.92 } : {}}
            >
              <Button
                onClick={() => sendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                aria-label="Send message"
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 disabled:opacity-40 transition-colors duration-300 p-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
          <p className="text-[11px] text-white/30 mt-2 text-center sm:text-left">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}

function ChatPageFallback() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-2xl skeleton-shimmer" />
      <div className="w-48 h-4 rounded-full skeleton-shimmer" />
    </div>
  )
}

export default function ChatPage() {
  return (
    <AppShell>
      <Suspense fallback={<ChatPageFallback />}>
        <ChatPageContent />
      </Suspense>
    </AppShell>
  )
}
