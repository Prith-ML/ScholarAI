"use client"

import type React from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import AppSidebar from "./AppSidebar"
import { useAuthStore } from "@/store/authStore"

const PROTECTED_PATHS = ["/chat", "/research"]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const status = useAuthStore((state) => state.status)

  useEffect(() => {
    const isProtected = PROTECTED_PATHS.some((path) => pathname?.startsWith(path))
    if (isProtected && status === "unauthenticated") {
      router.replace(`/signin?next=${encodeURIComponent(pathname || "/chat")}`)
    }
  }, [pathname, status, router])

  return (
    <div className="flex min-h-[100dvh] bg-[#05060a] relative">
      <div className="fixed inset-0 command-glow command-grid pointer-events-none" aria-hidden="true" />
      <AppSidebar />
      <div className="flex-1 min-w-0 relative z-10 flex flex-col">{children}</div>
    </div>
  )
}
