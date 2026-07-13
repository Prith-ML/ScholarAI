"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/store/authStore"

export default function SignUpPage() {
  const router = useRouter()
  const signup = useAuthStore((state) => state.signup)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await signup(email, password)
      router.push("/chat")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign up failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#05060a] px-4">
      <Card className="app-panel glow-border w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-white text-xl">Create your account</CardTitle>
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
              autoComplete="new-password"
              minLength={8}
            />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Creating account..." : "Sign up"}
            </Button>
          </form>
          <p className="text-sm text-white/50 mt-4 text-center">
            Already have an account?{" "}
            <Link href="/signin" className="text-white underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
