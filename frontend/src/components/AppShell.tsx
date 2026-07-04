"use client"

import type React from "react"
import AppSidebar from "./AppSidebar"

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-[#05060a] relative">
      <div className="fixed inset-0 command-glow command-grid pointer-events-none" aria-hidden="true" />
      <AppSidebar />
      <div className="flex-1 min-w-0 relative z-10 flex flex-col">{children}</div>
    </div>
  )
}
