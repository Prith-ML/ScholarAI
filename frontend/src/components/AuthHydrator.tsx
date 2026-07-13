"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/store/authStore"

/** Fires the silent-refresh call once on app load so a returning user's session resumes without re-entering credentials. Renders nothing. */
export default function AuthHydrator() {
  const hydrate = useAuthStore((state) => state.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return null
}
