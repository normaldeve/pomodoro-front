import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import dynamic from "next/dynamic"

// Toaster를 동적 import로 지연 로딩하여 초기 번들 크기 감소
// Toaster는 Client Component이므로 동적 import만으로도 충분히 지연 로딩됨
const Toaster = dynamic(() => import("@/components/ui/toaster").then((mod) => mod.Toaster))
const ServerStatusOverlay = dynamic(() => import("@/components/server-status-overlay").then((mod) => mod.ServerStatusOverlay))

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "600", "700"],
})

export const metadata: Metadata = {
  title: "뽀개더",
  description: "뽀모도로로 함께 집중하는 공부방 서비스",
  generator: "v0.app",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="font-sans">
        {children}
        <Toaster />
        <ServerStatusOverlay />
      </body>
    </html>
  )
}
