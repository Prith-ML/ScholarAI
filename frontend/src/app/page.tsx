"use client"

import Link from "next/link"
import {
  ArrowRight,
  Brain,
  MessageSquare,
  BarChart3,
  Sparkles,
  BookOpen,
  TrendingUp,
  Zap,
  Globe,
  Shield,
  Star,
  Rocket,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useEffect, useState } from "react"

export default function HomePage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isLoaded, setIsLoaded] = useState(false)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([])

  useEffect(() => {
    setIsLoaded(true)

    // Generate particles
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 20,
    }))
    setParticles(newParticles)

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      })
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  const features = [
    {
      icon: MessageSquare,
      title: "Neural Conversations",
      description: "Advanced AI that understands context and nuance",
      gradient: "from-blue-500 via-cyan-500 to-blue-600",
      delay: 0,
    },
    {
      icon: BookOpen,
      title: "Research Engine",
      description: "Access to millions of academic papers and sources",
      gradient: "from-purple-500 via-pink-500 to-purple-600",
      delay: 100,
    },
    {
      icon: TrendingUp,
      title: "Trend Analysis",
      description: "Real-time insights and predictive analytics",
      gradient: "from-green-500 via-emerald-500 to-green-600",
      delay: 200,
    },
    {
      icon: BarChart3,
      title: "Smart Dashboard",
      description: "Visualize your research journey and progress",
      gradient: "from-orange-500 via-red-500 to-orange-600",
      delay: 300,
    },
  ]

  const stats = [
    { value: "10M+", label: "Research Queries", icon: Zap, color: "text-blue-400" },
    { value: "500K+", label: "Academic Sources", icon: Globe, color: "text-purple-400" },
    { value: "99.9%", label: "Uptime", icon: Shield, color: "text-green-400" },
    { value: "4.9★", label: "User Rating", icon: Star, color: "text-yellow-400" },
  ]

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0">
        {/* Animated Gradient Mesh */}
        <div
          className="absolute inset-0 gradient-mesh opacity-40"
          style={{
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
          }}
        />

        {/* Floating Orbs */}
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 gradient-orb opacity-30 rounded-full blur-3xl animate-float"
          style={{
            transform: `translate(${mousePosition.x * 0.03}px, ${mousePosition.y * 0.03}px)`,
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 gradient-orb opacity-25 rounded-full blur-3xl animate-float"
          style={{
            transform: `translate(${mousePosition.x * -0.02}px, ${mousePosition.y * -0.02}px)`,
            animationDelay: "3s",
          }}
        />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />

        {/* Floating Particles */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="particle animate-float"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${15 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <div className="max-w-7xl w-full">
          {/* Hero Section */}
          <div
            className={`text-center mb-20 transition-all duration-1000 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            }`}
          >
            {/* Floating Badge */}
            <div className="inline-flex items-center gap-3 glass-effect rounded-full px-6 py-3 mb-8 hover-lift animate-pulse-glow">
              <Sparkles className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-sm font-semibold text-white/90">Next-Generation AI Research</span>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" />
            </div>

            {/* Logo */}
            <div className="relative mb-12 group">
              <div className="w-32 h-32 mx-auto relative">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-60 animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-xl opacity-80 animate-pulse-glow" />

                {/* Main Logo */}
                <div className="relative w-full h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center hover-lift group-hover:animate-bounce">
                  <Brain className="w-16 h-16 text-white drop-shadow-2xl" />
                </div>

                {/* Orbiting Elements */}
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-400 rounded-full animate-spin opacity-80" />
                <div
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-purple-400 rounded-full animate-spin opacity-60"
                  style={{ animationDirection: "reverse" }}
                />
              </div>
            </div>

            {/* Main Heading */}
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black mb-8 tracking-tight leading-none">
              <span className="block text-white mb-4 animate-fade-in">Agentic</span>
              <span className="block gradient-text animate-fade-in" style={{ animationDelay: "0.2s" }}>
                Research
              </span>
              <span
                className="block text-white/70 text-4xl md:text-5xl lg:text-6xl font-light mt-4 animate-fade-in"
                style={{ animationDelay: "0.4s" }}
              >
                Assistant
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="text-xl md:text-2xl lg:text-3xl text-white/80 max-w-4xl mx-auto leading-relaxed mb-12 animate-fade-in"
              style={{ animationDelay: "0.6s" }}
            >
              Experience the future of research with AI that{" "}
              <span className="gradient-text font-semibold">understands</span>,{" "}
              <span className="gradient-text font-semibold">analyzes</span>, and{" "}
              <span className="gradient-text font-semibold">discovers</span> insights across any field of study.
            </p>

            {/* CTA Buttons */}
            <div
              className="flex flex-col sm:flex-row gap-6 justify-center mb-20 animate-fade-in"
              style={{ animationDelay: "0.8s" }}
            >
              <Link href="/chat">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-300 hover:scale-105 group text-lg px-10 py-6 rounded-2xl shadow-2xl">
                  <Rocket className="mr-3 w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
                  Start Research Journey
                  <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
                </Button>
              </Link>
              <Link href="/research">
                <Button className="bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-300 hover:scale-105 group text-lg px-10 py-6 rounded-2xl border border-white/20 hover:border-white/30">
                  <BarChart3 className="mr-3 w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                  View Dashboard
                  <Target className="ml-3 w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
            {features.map((feature, index) => (
              <Card
                key={index}
                className={`glass-effect hover-lift hover:shadow-lg group cursor-pointer animate-fade-in`}
                style={{ animationDelay: `${1000 + feature.delay}ms` }}
              >
                <CardContent className="p-8 text-center relative overflow-hidden">
                  {/* Background Gradient */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
                  />

                  <div className="relative z-10">
                    {/* Icon */}
                    <div
                      className={`w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-r ${feature.gradient} p-1 group-hover:rotate-6 transition-transform duration-300`}
                    >
                      <div className="w-full h-full bg-black rounded-3xl flex items-center justify-center">
                        <feature.icon className="w-10 h-10 text-white" />
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="font-bold text-xl text-white mb-3 group-hover:gradient-text transition-all duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-white/70 group-hover:text-white/90 transition-colors duration-300 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stats Section */}
          <div
            className="flex flex-wrap justify-center items-center gap-12 md:gap-20 animate-fade-in"
            style={{ animationDelay: "1400ms" }}
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center group hover-lift">
                <div className="flex items-center justify-center gap-4 mb-3">
                  <div
                    className={`w-12 h-12 rounded-2xl glass-effect flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                  >
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div className="text-4xl md:text-5xl font-black text-white group-hover:gradient-text transition-all duration-300">
                    {stat.value}
                  </div>
                </div>
                <div className="text-white/60 font-semibold text-lg group-hover:text-white/80 transition-colors duration-300">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 