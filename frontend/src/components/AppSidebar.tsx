"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Atom, MessageSquare, LayoutDashboard, Plus, Menu, X } from "lucide-react"
import { useAuthStore } from "@/store/authStore"

const navigation = [
  { name: "Overview", href: "/", icon: Atom },
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "Research", href: "/research", icon: LayoutDashboard },
]

function SidebarAccount() {
  const { user, status, logout } = useAuthStore()

  if (status !== "authenticated" || !user) {
    return (
      <Link href="/signin" className="text-sm text-white/60 hover:text-white transition-colors">
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-white/50 truncate">{user.email}</span>
      <button
        onClick={() => logout()}
        className="text-xs text-white/60 hover:text-white transition-colors shrink-0"
      >
        Sign out
      </button>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-5 py-6 group">
        <div className="relative w-9 h-9 shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-xl blur-md opacity-60 group-hover:opacity-90 transition-opacity" />
          <div className="relative w-full h-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center">
            <Atom className="w-5 h-5 text-white" />
          </div>
        </div>
        <span className="font-display font-bold text-lg text-white tracking-tight">ScholarAI</span>
      </Link>

      <div className="px-3 mb-2">
        <Link href="/chat" onClick={onNavigate}>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Session
          </motion.div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.name} href={item.href} onClick={onNavigate}>
              <motion.div
                whileHover={{ x: 3 }}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
                  isActive ? "text-white" : "text-white/50 hover:text-white/90 hover:bg-white/[0.04]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl app-panel"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <item.icon className="relative w-4 h-4 shrink-0" />
                <span className="relative">{item.name}</span>
              </motion.div>
            </Link>
          )
        })}
      </nav>

      <div className="px-5 py-5 border-t border-white/[0.06]">
        <SidebarAccount />
      </div>
    </div>
  )
}

export default function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 app-panel border-r border-white/[0.06] z-30">
        <SidebarContent />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 app-panel border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center">
            <Atom className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-white">ScholarAI</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/70 z-40"
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="lg:hidden fixed inset-y-0 left-0 w-72 app-panel border-r border-white/[0.06] z-50"
            >
              <div className="flex justify-end px-3 pt-3">
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
