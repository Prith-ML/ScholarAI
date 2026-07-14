import { NextRequest, NextResponse } from "next/server"

// NOTE: This middleware is intentionally a no-op.
//
// The refresh cookie is set by Django with no `Domain=` attribute, so it is
// host-only to the Railway backend origin. In the real deployment (Vercel
// frontend + Railway backend, different domains), this edge middleware runs
// on the Vercel host and can never see that cookie — `request.cookies.has
// ("refresh_token")` is always false, which would redirect every user,
// including logged-in ones, away from /chat and /research. That only
// appeared to work in local dev because localhost:3000 and localhost:8000
// share the same host, so the cookie was visible there.
//
// The only check that can actually work cross-domain is the client-side
// guard in `frontend/src/components/AppShell.tsx`, which reads
// `useAuthStore`'s `status` once the silent-refresh hydration (a same-origin
// fetch from the browser to the backend, not an edge function) resolves.
//
// Keeping this file (rather than deleting it) so a future same-domain
// deployment (e.g. frontend and backend behind one domain via rewrites) can
// re-enable a cookie-based edge check here without re-plumbing route config.
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ["/chat/:path*", "/research/:path*"],
}
