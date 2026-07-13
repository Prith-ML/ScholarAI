import type React from "react"
import type { Metadata } from "next"
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import AuthHydrator from "@/components/AuthHydrator"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "ScholarAI",
  description: "Your AI-powered research command center",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} font-sans bg-[#05060a] min-h-screen h-full antialiased`}
      >
        {/* ScholarAI has no theme toggle - forced dark so useTheme() (used by
            components like DottedSurface) resolves correctly without adding
            a real light/dark switch nobody asked for. */}
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
          <AuthHydrator />
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: "app-glass border border-white/10 text-white",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
