"use client"

import type React from "react"
import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Send, MessageSquare, Plus, Bot, User, Copy, ThumbsUp, ThumbsDown, Sparkles, ArrowUp } from "lucide-react"
import TextareaAutosize from "react-textarea-autosize"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: any
}

const TypingIndicator = () => (
  <div className="flex items-center gap-4 text-white/60">
    <div className="flex space-x-2">
      <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce" />
      <div
        className="w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-bounce"
        style={{ animationDelay: "0.2s" }}
      />
      <div
        className="w-3 h-3 bg-gradient-to-r from-pink-500 to-blue-500 rounded-full animate-bounce"
        style={{ animationDelay: "0.4s" }}
      />
    </div>
    <span className="text-sm animate-pulse font-medium">AI is thinking...</span>
  </div>
)

const MessageActions = ({ message }: { message: Message }) => (
  <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
    <Button
      size="sm"
      className="glass-effect text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 hover-lift"
    >
      <Copy className="w-3 h-3 mr-2" />
      Copy
    </Button>
    <Button
      size="sm"
      className="glass-effect text-white/60 hover:text-green-400 hover:bg-green-500/10 rounded-xl transition-all duration-200 hover-lift"
    >
      <ThumbsUp className="w-3 h-3 mr-2" />
      Good
    </Button>
    <Button
      size="sm"
      className="glass-effect text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 hover-lift"
    >
      <ThumbsDown className="w-3 h-3 mr-2" />
      Bad
    </Button>
  </div>
)

const WelcomeScreen = ({ onSuggestionClick }: { onSuggestionClick: (suggestion: string) => void }) => {
  const suggestions = [
    "Explain quantum computing applications in cryptography",
    "Summarize recent advances in machine learning",
    "Compare different renewable energy technologies",
  ]

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 pb-48 animate-fade-in">
      <div className="max-w-5xl w-full text-center">
        {/* Welcome Header */}
        <div className="mb-12">
          <div className="w-24 h-24 mx-auto mb-8 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-60 animate-pulse-glow" />
            <div className="relative w-full h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center hover-lift">
              <MessageSquare className="w-12 h-12 text-white drop-shadow-2xl" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full animate-bounce" />
          </div>

          <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-white mb-6 tracking-tight">
            Where should we <span className="gradient-text">begin</span>?
          </h2>

          <p className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto leading-relaxed mb-12">
            Ask me anything about research, academic papers, or trends. I'm here to help you discover and understand
            complex topics with <span className="gradient-text font-semibold">precision</span> and{" "}
            <span className="gradient-text font-semibold">insight</span>.
          </p>
        </div>

        {/* Suggestion Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {suggestions.map((suggestion, index) => (
            <Card
              key={index}
              className="glass-effect hover-lift hover:shadow-lg cursor-pointer group animate-fade-in"
              onClick={() => onSuggestionClick(suggestion)}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6 relative overflow-hidden">
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
          ))}
        </div>
      </div>
    </div>
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
    const handleScroll = () => {
      if (chatContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
        setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100)
      }
    }

    chatContainerRef.current?.addEventListener("scroll", handleScroll)
    return () => chatContainerRef.current?.removeEventListener("scroll", handleScroll)
  }, [])

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
      const response = await fetch("http://127.0.0.1:8000/api/chat/send/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, session_id: sessionId }),
      })

      const data = await response.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        sources: data.sources || [],
      }

      setMessages((prev) => [...prev, assistantMessage])
      if (data.session_id && !sessionId) setSessionId(data.session_id)
    } catch (error) {
      console.error(error)
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
    <div className="flex flex-col h-screen bg-black relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "5s" }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-white/10 glass-effect sticky top-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center animate-pulse-glow">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {sessionId ? "Continuing Research Session" : "AI Research Assistant"}
              </h1>
              <p className="text-xs text-white/60">
                {sessionId ? "Resuming your previous conversation" : "Powered by advanced AI • Always learning"}
              </p>
            </div>
          </div>
          <Button
            onClick={startNewChat}
            className="bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white font-semibold px-4 py-2 rounded-xl transition-all duration-300 hover:scale-105 border border-white/20 hover:border-white/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden relative z-10">
        {messages.length === 0 ? (
          <WelcomeScreen onSuggestionClick={(suggestion) => sendMessage(suggestion)} />
        ) : (
          <div ref={chatContainerRef} className="h-full overflow-y-auto scrollbar-custom">
            <div className="max-w-6xl mx-auto pb-32">
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`group py-8 px-6 transition-all duration-500 animate-fade-in ${
                    msg.role === "user" ? "bg-transparent" : "glass-effect"
                  }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex gap-6">
                    <Avatar className="w-12 h-12 shrink-0">
                      <AvatarFallback
                        className={`${
                          msg.role === "user"
                            ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                            : "bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white"
                        } transition-all duration-300 group-hover:scale-110 hover-lift`}
                      >
                        {msg.role === "user" ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="font-bold text-white text-lg">
                          {msg.role === "user" ? "You" : "AI Assistant"}
                        </span>
                        <span className="text-xs text-white/40 glass-effect px-3 py-1 rounded-full">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="prose-enhanced max-w-none">
                        <div className="chat-message text-white/90 leading-relaxed text-lg">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>

                      {msg.role === "assistant" && <MessageActions message={msg} />}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="py-8 px-6 glass-effect animate-pulse">
                  <div className="flex gap-6">
                    <Avatar className="w-12 h-12 shrink-0">
                      <AvatarFallback className="bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white">
                        <Bot className="w-6 h-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <TypingIndicator />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <Button
            onClick={scrollToBottom}
            className="fixed bottom-32 right-8 w-14 h-14 rounded-full glass-effect hover-lift hover:shadow-lg z-20"
            size="sm"
          >
            <ArrowUp className="w-5 h-5 text-white" />
          </Button>
        )}
      </div>

      {/* Input Area */}
      <div className="relative z-10 border-t border-white/10 glass-effect">
        <div className="max-w-6xl mx-auto p-6">
          <div className="relative glass-effect rounded-3xl shadow-2xl hover:shadow-lg group">
            <TextareaAutosize
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about research, papers, or trends..."
              className="w-full bg-transparent text-white placeholder-white/50 p-6 pr-20 resize-none focus:outline-none text-lg leading-relaxed"
              minRows={1}
              maxRows={6}
              disabled={isLoading}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!inputMessage.trim() || isLoading}
              className="absolute right-3 bottom-3 w-12 h-12 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all duration-300 hover-lift disabled:hover:scale-100"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-4 text-sm text-white/40">
            <p>
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

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>}>
      <ChatPageContent />
    </Suspense>
  )
}
