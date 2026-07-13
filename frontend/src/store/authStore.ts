import { create } from "zustand"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

export interface AuthUser {
  id: number
  email: string
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated"

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  status: AuthStatus
  setAccessToken: (token: string) => void
  hydrate: () => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data.error === "string") return data.error
    const firstField = Object.values(data)[0]
    if (Array.isArray(firstField) && typeof firstField[0] === "string") return firstField[0]
  } catch {
    // fall through to generic message
  }
  return "Something went wrong. Please try again."
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "loading",

  setAccessToken: (token: string) => set({ accessToken: token }),

  hydrate: async () => {
    try {
      const refreshResponse = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
        method: "POST",
        credentials: "include",
      })
      if (!refreshResponse.ok) {
        set({ user: null, accessToken: null, status: "unauthenticated" })
        return
      }
      const { access } = await refreshResponse.json()

      const meResponse = await fetch(`${API_BASE}/api/auth/me/`, {
        headers: { Authorization: `Bearer ${access}` },
        credentials: "include",
      })
      if (!meResponse.ok) {
        set({ user: null, accessToken: null, status: "unauthenticated" })
        return
      }
      const user = await meResponse.json()
      set({ user, accessToken: access, status: "authenticated" })
    } catch {
      set({ user: null, accessToken: null, status: "unauthenticated" })
    }
  },

  signup: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/api/auth/signup/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) throw new Error(await parseErrorMessage(response))
    const data = await response.json()
    set({ user: data.user, accessToken: data.access, status: "authenticated" })
  },

  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) throw new Error(await parseErrorMessage(response))
    const data = await response.json()
    set({ user: data.user, accessToken: data.access, status: "authenticated" })
  },

  logout: async () => {
    const { accessToken } = useAuthStore.getState()
    await fetch(`${API_BASE}/api/auth/logout/`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      credentials: "include",
    })
    set({ user: null, accessToken: null, status: "unauthenticated" })
  },
}))
