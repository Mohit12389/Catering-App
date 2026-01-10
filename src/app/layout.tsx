import type { Metadata, Viewport } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { ToastProvider } from "@/hooks/useToast"
import { Toaster } from "@/components/ui/Toaster"
import "./globals.css"

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
      <html lang="en">
        <body>
          <ToastProvider>
            {children}
            <Toaster />
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
