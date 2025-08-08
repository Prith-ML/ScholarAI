"use client"

import Link from "next/link"
import {
  ArrowLeft,
  BarChart3,
  MessageSquare,
  BookOpen,
  TrendingUp,
  Clock,
  Star,
  Search,
  Filter,
  Zap,
  Target,
  Brain,
  Globe,
  Plus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"

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

export default function ResearchPage() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeFilter, setActiveFilter] = useState("all")
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
    setIsLoaded(true)
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all data in parallel
      const [statsResponse, sessionsResponse, insightsResponse] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/chat/dashboard/stats/'),
        fetch('http://127.0.0.1:8000/api/chat/dashboard/sessions/'),
        fetch('http://127.0.0.1:8000/api/chat/dashboard/insights/'),
      ])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json()
        setRecentSessions(sessionsData.sessions || [])
      }

      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json()
        setInsights(insightsData.insights || [])
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const deleteSession = async (sessionId: number) => {
    if (!confirm('🗑️ Are you sure you want to delete this research session?\n\nThis will permanently remove all messages and sources from this session. This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/chat/dashboard/sessions/${sessionId}/delete/`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove the session from the list
        setRecentSessions(prev => prev.filter(session => session.id !== sessionId))
        // Refresh dashboard data to update stats
        fetchDashboardData()
      } else {
        console.error('Failed to delete session')
        setError('Failed to delete session. Please try again.')
      }
    } catch (err) {
      console.error('Error deleting session:', err)
      setError('Failed to delete session. Please try again.')
    }
  }

  const statsConfig = [
    {
      title: "Research Sessions",
      value: stats.research_sessions.toString(),
      change: stats.research_sessions === 0 ? "Start your first session" : `${stats.research_sessions} active sessions`,
      icon: BarChart3,
      color: "from-blue-500 to-cyan-500",
      trend: "none",
    },
    {
      title: "Messages Exchanged",
      value: stats.messages_exchanged.toString(),
      change: stats.messages_exchanged === 0 ? "Begin chatting with AI" : `${stats.messages_exchanged} total messages`,
      icon: MessageSquare,
      color: "from-green-500 to-emerald-500",
      trend: "none",
    },
    {
      title: "Sources Cited",
      value: stats.sources_cited.toString(),
      change: stats.sources_cited === 0 ? "AI will find sources for you" : `${stats.sources_cited} sources found`,
      icon: BookOpen,
      color: "from-purple-500 to-pink-500",
      trend: "none",
    },
    {
      title: "Research Hours",
      value: stats.research_hours.toString(),
      change: stats.research_hours === 0 ? "Track your research time" : `${stats.research_hours} hours spent`,
      icon: Clock,
      color: "from-orange-500 to-red-500",
      trend: "none",
    },
  ]

  // Default insights if none are provided
  const defaultInsights = [
    {
      title: "Research Focus",
      description: "Start your first research session to discover your focus areas",
      action: "Begin research",
    },
    {
      title: "Trending Topics",
      description: "Explore current trends in AI, machine learning, and technology",
      action: "Explore topics",
    },
    {
      title: "Knowledge Gaps",
      description: "Identify areas where you can expand your research",
      action: "Start exploring",
    },
    {
      title: "Global Trends",
      description: "Stay updated with the latest developments worldwide",
      action: "Learn more",
    },
  ]

  const displayInsights = insights.length > 0 ? insights : defaultInsights

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <p className="text-white/60">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-white/10 glass-effect sticky top-0">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
            <div>
                  <h1 className="text-xl font-bold text-white">Research Dashboard</h1>
                  <p className="text-xs text-white/60">Track your research journey</p>
                </div>
              </div>
            </div>
            <Link href="/chat">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl transition-all duration-300 hover:scale-105">
                <MessageSquare className="w-4 h-4 mr-2" />
                Start Research
            </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
            <Button 
              onClick={fetchDashboardData}
              className="mt-2 bg-red-500/20 hover:bg-red-500/30 text-red-400"
              size="sm"
            >
              Retry
            </Button>
                </div>
        )}

        {/* Stats Grid */}
        <div
          className={`grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          {statsConfig.map((stat, index) => (
            <Card
              key={index}
              className="glass-effect hover-lift hover:shadow-lg group transition-all duration-500"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6 relative overflow-hidden">
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
                />

                <div className="relative z-10 flex items-center justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${stat.color} p-0.5 group-hover:rotate-6 transition-transform duration-300`}
                  >
                    <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center">
                      <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white group-hover:gradient-text transition-all duration-300">
                      {stat.value}
                    </p>
                </div>
                </div>

                <div>
                  <p className="text-sm text-white/80 font-medium mb-1">{stat.title}</p>
                  <p className="text-xs text-white/60 flex items-center gap-1">
                    {stat.change}
                  </p>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Sessions */}
          <div
            className={`lg:col-span-2 transition-all duration-1000 delay-300 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          >
            <Card className="glass-effect">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-400" />
                    Recent Research Sessions
                  </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
                      variant="outline"
                      className="border-white/20 text-white/80 hover:bg-white/10 bg-transparent rounded-xl"
            >
                      <Search className="w-4 h-4 mr-2" />
                      Search
            </Button>
            <Button
              size="sm"
                      variant="outline"
                      className="border-white/20 text-white/80 hover:bg-white/10 bg-transparent rounded-xl"
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {recentSessions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">No Research Sessions Yet</h3>
                    <p className="text-white/60 mb-6 max-w-md mx-auto">
                      Start your first research session to begin tracking your AI-powered research journey.
                    </p>
                    <Link href="/chat">
                      <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl transition-all duration-300 hover:scale-105">
                        <Plus className="w-4 h-4 mr-2" />
                        Start First Session
            </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                                         {recentSessions.map((session, index) => (
                       <div
                         key={session.id}
                         className="group p-6 glass-effect rounded-2xl hover-lift hover:shadow-lg transition-all duration-300"
                         style={{ animationDelay: `${index * 100}ms` }}
                       >
                         <div className="flex items-start justify-between mb-4">
                           <div className="flex-1">
                             <Link href={`/chat?session_id=${session.id}`}>
                               <h3 className="font-semibold text-white mb-2 group-hover:gradient-text transition-all duration-300 cursor-pointer">
                                 {session.title}
                               </h3>
                             </Link>
                             <div className="flex items-center gap-4 text-sm text-white/60 mb-3">
                               <div className="flex items-center gap-1">
                                 <MessageSquare className="w-3 h-3" />
                                 {session.messages} messages
                               </div>
                               <div className="flex items-center gap-1">
                                 <Clock className="w-3 h-3" />
                                 {session.lastActive}
                               </div>
                               <div
                                 className={`px-2 py-1 rounded-full text-xs ${
                                   session.status === "active"
                                     ? "bg-green-500/20 text-green-400"
                                     : session.status === "completed"
                                       ? "bg-blue-500/20 text-blue-400"
                                       : "bg-yellow-500/20 text-yellow-400"
                                 }`}
                               >
                                 {session.status}
                               </div>
                             </div>
                           </div>
                           <div className="flex items-center gap-2">
                             <Star className="w-4 h-4 text-white/40 hover:text-yellow-400 cursor-pointer transition-colors duration-200" />
            <Button
                               onClick={(e) => {
                                 e.stopPropagation()
                                 deleteSession(session.id)
                               }}
              size="sm"
                               variant="ghost"
                               className="text-white/40 hover:text-red-400 hover:bg-red-500/10 p-2 h-auto transition-colors duration-200"
            >
                               <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

                         <div className="flex gap-2">
                           {session.topics.map((topic: string) => (
                             <Badge
                               key={topic}
                               variant="secondary"
                               className="bg-white/10 text-white/80 hover:bg-white/20 transition-colors duration-200"
                             >
                               {topic}
                             </Badge>
                           ))}
                         </div>
                       </div>
                     ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Insights */}
          <div
            className={`transition-all duration-1000 delay-500 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          >
            <Card className="glass-effect mb-6">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  AI Insights
                </CardTitle>
              </CardHeader>
                <CardContent className="p-6">
                <div className="space-y-4">
                  {displayInsights.map((insight, index) => (
                    <div
                      key={index}
                      className="group p-4 glass-effect rounded-xl hover-lift cursor-pointer transition-all duration-300"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                          <Brain className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-white mb-1 group-hover:gradient-text transition-all duration-300">
                            {insight.title}
                          </h4>
                          <p className="text-sm text-white/70 mb-2">{insight.description}</p>
                          <Link href="/chat">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 p-0 h-auto font-medium"
                            >
                              {insight.action} →
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                </CardContent>
              </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 