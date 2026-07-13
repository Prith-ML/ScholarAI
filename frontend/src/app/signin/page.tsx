"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/store/authStore"

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const login = useAuthStore((state) => state.login)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(email, password)
      router.push(searchParams.get("next") || "/chat")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#05060a] px-4">
      <Card className="app-panel glow-border w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-white text-xl">Sign in to ScholarAI</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="text-sm text-white/50 mt-4 text-center">
            No account?{" "}
            <Link href="/signup" className="text-white underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  )
}
