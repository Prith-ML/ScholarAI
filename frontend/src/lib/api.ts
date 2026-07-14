import { useAuthStore, attemptRefresh } from "@/store/authStore"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

// Token refresh itself is single-flighted in authStore.ts (shared by
// hydrate() and any number of concurrent apiFetch() 401 retries below) so
// that only one refresh request is ever in flight at a time.

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
