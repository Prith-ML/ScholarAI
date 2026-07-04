"use client"

import Link from "next/link"
import {
  BarChart3,
  MessageSquare,
  BookOpen,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import AppShell from "@/components/AppShell"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

interface DashboardStats {
  research_sessions: number
  messages_exchanged: number
  sources_cited: number
  research_hours: number
}

interface ResearchSession {
  id: number
  title: string
  messages: number
  lastActive: string
  topics: string[]
  status: string
}

interface AIInsight {
  title: string
  description: string
  action: string
}

const defaultInsights: AIInsight[] = [
  { title: "Research Focus", description: "Start your first research session to discover your focus areas", action: "Begin research" },
  { title: "Trending Topics", description: "Explore current trends in AI, machine learning, and technology", action: "Explore topics" },
  { title: "Knowledge Gaps", description: "Identify areas where you can expand your research", action: "Start exploring" },
]

export default function ResearchPage() {
  const [stats, setStats] = useState<DashboardStats>({
    research_sessions: 0,
    messages_exchanged: 0,
    sources_cited: 0,
    research_hours: 0,
  })
  const [recentSessions, setRecentSessions] = useState<ResearchSession[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [statsResponse, sessionsResponse, insightsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/chat/dashboard/stats/`),
        fetch(`${API_BASE}/api/chat/dashboard/sessions/`),
        fetch(`${API_BASE}/api/chat/dashboard/insights/`),
      ])

      if (statsResponse.ok) setStats(await statsResponse.json())
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json()
        setRecentSessions(sessionsData.sessions || [])
      }
      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json()
        setInsights(insightsData.insights || [])
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err)
      setError("Failed to load dashboard data. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const deleteSession = async (sessionId: number) => {
    if (!confirm("Delete this research session? This will permanently remove all messages and sources. This cannot be undone.")) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/chat/dashboard/sessions/${sessionId}/delete/`, { method: "DELETE" })
      if (response.ok) {
        setRecentSessions((prev) => prev.filter((session) => session.id !== sessionId))
        toast.success("Session deleted")
        fetchDashboardData()
      } else {
        toast.error("Failed to delete session")
      }
    } catch (err) {
      console.error("Error deleting session:", err)
      toast.error("Failed to delete session")
    }
  }

  const statsConfig = [
    { title: "Research Sessions", value: stats.research_sessions.toString(), icon: BarChart3 },
    { title: "Messages Exchanged", value: stats.messages_exchanged.toString(), icon: MessageSquare },
    { title: "Sources Cited", value: stats.sources_cited.toString(), icon: BookOpen },
    { title: "Research Hours", value: stats.research_hours.toString(), icon: Clock },
  ]

  const displayInsights = insights.length > 0 ? insights : defaultInsights

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto scrollbar-custom">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">Research Dashboard</h1>
              <p className="text-sm text-white/50 mt-1">Track your research journey</p>
            </div>
            <Link href="/chat">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Button className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Start Research
                </Button>
              </motion.div>
            </Link>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
              <p className="text-red-400 text-sm">{error}</p>
              <Button onClick={fetchDashboardData} size="sm" className="bg-red-500/20 hover:bg-red-500/30 text-red-300">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry
              </Button>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {statsConfig.map((stat, index) => (
              <motion.div key={stat.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                <Card className="app-panel h-full">
                  <CardContent className="p-4 sm:p-5">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 flex items-center justify-center mb-3">
                      <stat.icon className="w-[18px] h-[18px] text-violet-300" />
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {loading ? <span className="inline-block w-10 h-6 rounded skeleton-shimmer align-middle" /> : stat.value}
                    </p>
                    <p className="text-xs text-white/45 mt-1">{stat.title}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Recent sessions */}
            <div className="lg:col-span-2">
              <Card className="app-panel">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 text-base">
                    <Sparkles className="w-4 h-4 text-violet-300" />
                    Recent Research Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-20 rounded-xl skeleton-shimmer" />
                      ))}
                    </div>
                  ) : recentSessions.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="w-6 h-6 text-violet-300" />
                      </div>
                      <h3 className="font-display text-lg font-bold text-white mb-2">No Research Sessions Yet</h3>
                      <p className="text-white/50 mb-6 max-w-md mx-auto text-sm">
                        Start your first research session to begin tracking your AI-powered research journey.
                      </p>
                      <Link href="/chat">
                        <Button className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl">
                          <Plus className="w-4 h-4 mr-2" />
                          Start First Session
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {recentSessions.map((session) => (
                          <motion.div
                            key={session.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            whileHover={{ y: -2 }}
                            className="group p-4 app-glass rounded-xl"
                          >
                            <div className="flex items-start justify-between mb-3 gap-3">
                              <Link href={`/chat?session_id=${session.id}`} className="flex-1 min-w-0">
                                <h3 className="font-semibold text-white text-sm mb-1.5 group-hover:text-violet-300 transition-colors truncate">
                                  {session.title}
                                </h3>
                                <div className="flex items-center gap-3 text-xs text-white/45">
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    {session.messages} messages
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {session.lastActive}
                                  </span>
                                </div>
                              </Link>
                              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteSession(session.id)
                                  }}
                                  size="sm"
                                  variant="ghost"
                                  aria-label={`Delete session ${session.title}`}
                                  className="text-white/30 hover:text-red-400 hover:bg-red-500/10 p-2 h-auto shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </motion.div>
                            </div>
                            {session.topics.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {session.topics.map((topic) => (
                                  <Badge key={topic} variant="secondary" className="bg-white/[0.06] text-white/60 text-[11px]">
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Insights */}
            <div>
              <Card className="app-panel">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 text-base">
                    <Sparkles className="w-4 h-4 text-fuchsia-300" />
                    AI Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {displayInsights.map((insight, index) => (
                    <motion.div key={index} whileHover={{ x: 3 }} className="group p-3.5 app-glass rounded-xl cursor-pointer">
                      <h4 className="font-medium text-white text-sm mb-1 group-hover:text-violet-300 transition-colors">
                        {insight.title}
                      </h4>
                      <p className="text-xs text-white/55 mb-2 leading-relaxed">{insight.description}</p>
                      <Link href="/chat">
                        <span className="text-xs font-medium text-violet-300 hover:text-violet-200">
                          {insight.action} &rarr;
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
