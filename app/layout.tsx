import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import dynamic from "next/dynamic"
import { PwaClient } from "@/components/pwa-client"

// Toaster를 동적 import로 지연 로딩하여 초기 번들 크기 감소
// Toaster는 Client Component이므로 동적 import만으로도 충분히 지연 로딩됨
const Toaster = dynamic(() => import("@/components/ui/toaster").then((mod) => mod.Toaster))
const ServerStatusOverlay = dynamic(() =>
  import("@/components/server-status-overlay").then((mod) => mod.ServerStatusOverlay)
)
const FcmForegroundListener = dynamic(() =>
  import("@/components/fcm-foreground-listener").then((mod) => mod.FcmForegroundListener),
)

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "600", "700"],
})

export const metadata: Metadata = {
  title: "뽀개더 - 함께 포모도로!",
  description: "뽀모도로로 함께 집중하는 공부방 서비스",
  generator: "v0.app",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/images/home_icon.png", sizes: "32x32", type: "image/png" },
      { url: "/images/home_icon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/images/home_icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: "#2c5f2d",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="font-sans">
        <PwaClient />
        <FcmForegroundListener />
        {children}
        <Toaster />
        <ServerStatusOverlay />
      </body>
    </html>
  )
}
