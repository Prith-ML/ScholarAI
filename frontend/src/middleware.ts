import { NextRequest, NextResponse } from "next/server"

const PROTECTED_PATHS = ["/chat", "/research"]

export function middleware(request: NextRequest) {
  const isProtected = PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))
  if (!isProtected) return NextResponse.next()

  const hasRefreshCookie = request.cookies.has("refresh_token")
  if (hasRefreshCookie) return NextResponse.next()

  const signInUrl = new URL("/signin", request.url)
  signInUrl.searchParams.set("next", request.nextUrl.pathname)
  return NextResponse.redirect(signInUrl)
}

export const config = {
  matcher: ["/chat/:path*", "/research/:path*"],
}
