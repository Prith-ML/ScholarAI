"use client"

import type React from "react"
import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  Send,
  MessageSquare,
  Plus,
  Bot,
  User,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ArrowUp,
  BookmarkPlus,
  BookmarkCheck,
  Loader2,
  AlertCircle,
} from "lucide-react"
import TextareaAutosize from "react-textarea-autosize"
import ReactMarkdown from "react-markdown"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

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
    <div className="flex items-center gap-4 text-white/60">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400"
            animate={reduce ? {} : { y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <span className="text-sm font-medium bg-gradient-to-r from-white/60 via-white/90 to-white/60 bg-clip-text text-transparent bg-[length:200%_100%] animate-[shimmer_2s_ease-in-out_infinite]">
        Analyzing research sources...
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
      const response = await fetch(`${API_BASE}/api/chat/messages/${message.id}/save-to-notion/`, {
        method: "POST",
      })
      const data = await response.json()
      if (!response.ok || data.error) {
        const message = data.error || "Failed to save to Notion"
        setNotionError(message)
        toast.error(message)
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
    } catch (err) {
      const message = "Failed to save to Notion"
      setNotionError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const actionButtonClass =
    "glass-effect text-white/60 rounded-xl transition-colors duration-200"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileHover="visible"
      animate="visible"
      className="flex flex-wrap items-center gap-2 mt-4"
    >
      <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
        <Button
          size="sm"
          onClick={copyToClipboard}
          className={`${actionButtonClass} hover:text-white hover:bg-white/10`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="copied"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center"
              >
                <Check className="w-3 h-3 mr-2 text-green-400" />
                Copied
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center"
              >
                <Copy className="w-3 h-3 mr-2" />
                Copy
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
        <Button
          size="sm"
          aria-pressed={feedback === "good"}
          onClick={() => toggleFeedback("good")}
          className={`${actionButtonClass} ${
            feedback === "good"
              ? "text-green-400 bg-green-500/15 border-green-500/30"
              : "hover:text-green-400 hover:bg-green-500/10"
          }`}
        >
          <ThumbsUp className="w-3 h-3 mr-2" />
          Good
        </Button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
        <Button
          size="sm"
          aria-pressed={feedback === "bad"}
          onClick={() => toggleFeedback("bad")}
          className={`${actionButtonClass} ${
            feedback === "bad"
              ? "text-red-400 bg-red-500/15 border-red-500/30"
              : "hover:text-red-400 hover:bg-red-500/10"
          }`}
        >
          <ThumbsDown className="w-3 h-3 mr-2" />
          Bad
        </Button>
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        {notionUrl ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              asChild
              size="sm"
              className={`${actionButtonClass} text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 border-emerald-500/20`}
            >
              <a href={notionUrl} target="_blank" rel="noopener noreferrer">
                <BookmarkCheck className="w-3 h-3 mr-2" />
                View in Notion
              </a>
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="save"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={saving ? {} : { scale: 1.05, y: -2 }}
            whileTap={saving ? {} : { scale: 0.95 }}
          >
            <Button
              size="sm"
              disabled={saving}
              onClick={saveToNotion}
              className={`${actionButtonClass} hover:text-white hover:bg-white/10 disabled:opacity-70`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {saving ? (
                  <motion.span
                    key="saving"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center"
                  >
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Saving...
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center"
                  >
                    <BookmarkPlus className="w-3 h-3 mr-2" />
                    Save to Notion
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {notionError && !notionUrl && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1.5 text-xs text-red-400"
        >
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

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-12 pb-48"
    >
      <div className="max-w-5xl w-full text-center">
        <motion.div variants={item} className="mb-12">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-8 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-60 animate-pulse-glow" />
            <div className="relative w-full h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center hover-lift">
              <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow-2xl" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full animate-bounce" />
          </div>

          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white mb-6 tracking-tight">
            Where should we <span className="gradient-text">begin</span>?
          </h2>

          <p className="text-lg sm:text-xl md:text-2xl text-white/80 max-w-3xl mx-auto leading-relaxed mb-12">
            Ask me anything about research, academic papers, or trends. I&apos;m here to help you discover and understand
            complex topics with <span className="gradient-text font-semibold">precision</span> and{" "}
            <span className="gradient-text font-semibold">insight</span>.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-16">
          {suggestions.map((suggestion, index) => (
            <motion.div key={index} variants={item} whileHover={{ y: -6, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className="glass-effect glow-border hover:shadow-lg cursor-pointer group h-full"
                onClick={() => onSuggestionClick(suggestion)}
              >
                <CardContent className="p-6 relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative z-10 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <Sparkles className="w-5 h-5 text-blue-400 group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                    <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300 text-left leading-relaxed">
                      {suggestion}
                    </p>
                  </div>
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle session_id from URL parameter
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get('session_id')
    if (sessionIdFromUrl && !sessionId) {
      setSessionId(sessionIdFromUrl)
      // You could also load existing messages for this session here
      // For now, we'll just set the session ID
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
      const response = await fetch(`${API_BASE}/api/chat/send/`, {
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
      toast.error("Connection trouble", {
        description: "Couldn't reach the research assistant. Please try again.",
      })
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
    <div className="flex flex-col h-[100dvh] bg-black relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "5s" }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-white/10 glass-effect sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center animate-pulse-glow">
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.h1
                  key={sessionId ? "resumed" : "new"}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2 }}
                  className="text-lg sm:text-xl font-bold text-white truncate"
                >
                  {sessionId ? "Continuing Research Session" : "AI Research Assistant"}
                </motion.h1>
              </AnimatePresence>
              <p className="text-xs text-white/60 truncate">
                {sessionId ? "Resuming your previous conversation" : "Powered by advanced AI • Always learning"}
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="shrink-0">
            <Button
              onClick={startNewChat}
              className="bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white font-semibold px-3 sm:px-4 py-2 rounded-xl transition-colors duration-300 border border-white/20 hover:border-white/30"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Chat</span>
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden relative z-10">
        {messages.length === 0 ? (
          <WelcomeScreen onSuggestionClick={(suggestion) => sendMessage(suggestion)} />
        ) : (
          <div ref={chatContainerRef} className="h-full overflow-y-auto scrollbar-custom">
            <div className="max-w-6xl mx-auto pb-32">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className={`group py-6 sm:py-8 px-4 sm:px-6 ${
                      msg.role === "user" ? "bg-transparent" : "glass-effect"
                    }`}
                  >
                    <div className="flex gap-4 sm:gap-6">
                      <Avatar className="w-10 h-10 sm:w-12 sm:h-12 shrink-0">
                        <AvatarFallback
                          className={`${
                            msg.role === "user"
                              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                              : "bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white"
                          } transition-transform duration-300 group-hover:scale-110`}
                        >
                          {msg.role === "user" ? <User className="w-5 h-5 sm:w-6 sm:h-6" /> : <Bot className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="font-bold text-white text-base sm:text-lg">
                            {msg.role === "user" ? "You" : "AI Assistant"}
                          </span>
                          <span className="text-xs text-white/40 glass-effect px-3 py-1 rounded-full">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="prose-enhanced max-w-none">
                          <div className="chat-message text-white/90 leading-relaxed text-base sm:text-lg break-words">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>

                        {msg.role === "assistant" && <MessageActions message={msg} />}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-8 px-4 sm:px-6 glass-effect"
                >
                  <div className="flex gap-4 sm:gap-6">
                    <Avatar className="w-10 h-10 sm:w-12 sm:h-12 shrink-0">
                      <AvatarFallback className="bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white">
                        <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <TypingIndicator />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              className="fixed bottom-32 right-6 sm:right-8 z-20"
            >
              <Button
                onClick={scrollToBottom}
                aria-label="Scroll to latest message"
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full glass-effect hover:shadow-lg"
                size="sm"
              >
                <ArrowUp className="w-5 h-5 text-white" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="relative z-10 border-t border-white/10 glass-effect">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="relative glass-effect glow-border rounded-3xl shadow-2xl focus-within:shadow-lg">
            <TextareaAutosize
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about research, papers, or trends..."
              className="w-full bg-transparent text-white placeholder-white/50 p-4 sm:p-6 pr-16 sm:pr-20 resize-none focus:outline-none text-base sm:text-lg leading-relaxed"
              minRows={1}
              maxRows={6}
              disabled={isLoading}
              aria-label="Research question"
            />
            <motion.div
              className="absolute right-3 bottom-3"
              whileHover={inputMessage.trim() && !isLoading ? { scale: 1.08 } : {}}
              whileTap={inputMessage.trim() && !isLoading ? { scale: 0.92 } : {}}
            >
              <Button
                onClick={() => sendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                aria-label="Send message"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-colors duration-300"
              >
                <Send className="w-5 h-5" />
              </Button>
            </motion.div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 gap-2 text-xs sm:text-sm text-white/40">
            <p className="hidden sm:block">
              Press <kbd className="glass-effect px-3 py-1 rounded-lg text-white/60 font-mono">Enter</kbd> to send,
              <kbd className="glass-effect px-3 py-1 rounded-lg text-white/60 ml-2 font-mono">Shift + Enter</kbd> for
              new line
            </p>
            <p>AI can make mistakes. Verify important information.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatPageFallback() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-2xl skeleton-shimmer" />
      <div className="w-48 h-4 rounded-full skeleton-shimmer" />
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatPageFallback />}>
      <ChatPageContent />
    </Suspense>
  )
}
