import { useAuthStore } from "@/store/authStore"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

async function attemptRefresh(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
      method: "POST",
      credentials: "include",
    })
    if (!response.ok) return null
    const { access } = await response.json()
    useAuthStore.getState().setAccessToken(access)
    return access
  } catch {
    return null
  }
}

/**
 * Drop-in replacement for fetch() against the Django API: attaches the
 * bearer token, always sends the refresh cookie, and retries once after a
 * silent token refresh on 401 before giving up.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = (token: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

  const { accessToken } = useAuthStore.getState()
  let response = await doFetch(accessToken)

  if (response.status === 401) {
    const refreshedToken = await attemptRefresh()
    if (refreshedToken) {
      response = await doFetch(refreshedToken)
    } else {
      useAuthStore.setState({ user: null, accessToken: null, status: "unauthenticated" })
    }
  }

  return response
}
