import type { Metadata, Viewport } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { ToastProvider } from "@/hooks/useToast"
import { Toaster } from "@/components/ui/Toaster"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Inter } from "next/font/google" // CHANGED: self-hosted font, replaces the render-blocking Google Fonts @import in globals.css
import "./globals.css"

// CHANGED: downloaded at build time and served from our own domain, with a size-matched
// fallback so text doesn't jump when it loads. Sets --font-inter (used by globals.css
// and tailwind's font-sans).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })

export const metadata: Metadata = {
  title: "Anchal Caterers - Event Management System",
  description: "Manage your catering events, menus, and ingredients efficiently",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d7377",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>{/* CHANGED: + inter.variable */}
        <body>
          <ToastProvider>
            {children}
            <Toaster />
          </ToastProvider>
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  )
}
