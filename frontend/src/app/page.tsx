"use client"

import Link from "next/link"
import {
  ArrowRight,
  Atom,
  MessageSquare,
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Bookmark,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ShaderAnimation } from "@/components/ui/shader-animation"
import AppShell from "@/components/AppShell"
import { useAuthStore } from "@/store/authStore"

const features = [
  {
    icon: BookOpen,
    title: "Dual-source research",
    description: "Searches academic papers and industry articles side by side, and tells you which it chose and why.",
  },
  {
    icon: TrendingUp,
    title: "Proactive follow-ups",
    description: "Every answer surfaces the next question worth asking, not just the current one.",
  },
  {
    icon: Bookmark,
    title: "Save straight to Notion",
    description: "Turn any answer into a permanent research note in your own workspace, one click.",
  },
  {
    icon: ShieldCheck,
    title: "Cited, not invented",
    description: "Every claim links back to a real source, with a relevance score you can judge for yourself.",
  },
]

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
}

export default function HomePage() {
  const reduceMotion = useReducedMotion()
  const status = useAuthStore((state) => state.status)

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto scrollbar-custom">
        {/* Hero with animated shader background */}
        <div className="relative min-h-screen flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0" aria-hidden="true">
            {reduceMotion ? (
              // Static gradient stand-in - the shader is a continuous WebGL
              // animation loop with no built-in reduced-motion handling.
              <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-[#05060a] to-fuchsia-950" />
            ) : (
              <ShaderAnimation />
            )}
          </div>
          {/* Scrim so hero text stays readable over the bright shader lines,
              fading into the app's solid background at the bottom edge. */}
          <div
            className="absolute inset-0 z-[1] bg-gradient-to-b from-black/50 via-black/60 to-[#05060a]"
            aria-hidden="true"
          />

          <motion.div
            variants={item}
            initial="hidden"
            animate="show"
            className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center"
          >
            <div className="inline-flex items-center gap-2 app-glass rounded-full px-4 py-1.5 mb-8 text-xs font-medium text-white/70">
              <Sparkles className="w-3.5 h-3.5 text-violet-300" />
              Agentic research, grounded in real sources
            </div>

            <div className="w-16 h-16 mx-auto mb-8 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-2xl blur-xl opacity-50 animate-pulse-glow" />
              <div className="relative w-full h-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center">
                <Atom className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold text-white mb-6 tracking-tight leading-[1.05]">
              <span className="gradient-text">ScholarAI</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed mb-10">
              ScholarAI reads academic papers and industry sources together, cites everything it says, and turns
              answers into permanent notes in your own workspace.
            </p>

            {status !== "authenticated" && (
              <p className="mb-4 text-sm text-white/50">
                <Link href="/signup" className="text-white underline">
                  Sign up
                </Link>{" "}
                or{" "}
                <Link href="/signin" className="text-white underline">
                  sign in
                </Link>{" "}
                to save your research sessions.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/chat">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-semibold px-6 py-5 rounded-xl text-base shadow-lg shadow-indigo-500/25">
                    <MessageSquare className="mr-2 w-4 h-4" />
                    Start Researching
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/research">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button className="app-glass text-white/80 hover:text-white hover:bg-white/10 font-semibold px-6 py-5 rounded-xl text-base">
                    <LayoutDashboard className="mr-2 w-4 h-4" />
                    View Dashboard
                  </Button>
                </motion.div>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Feature bento grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24"
        >
          <motion.div variants={item} className="grid sm:grid-cols-2 gap-4">
            {features.map((feature) => (
              <motion.div key={feature.title} whileHover={{ y: -4 }}>
                <Card className="app-panel glow-border h-full">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 flex items-center justify-center shrink-0">
                      <feature.icon className="w-5 h-5 text-violet-300" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-white mb-1.5">{feature.title}</h3>
                      <p className="text-sm text-white/60 leading-relaxed">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </AppShell>
  )
}
