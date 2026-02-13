"use client"

import { useEffect } from "react"

export function PwaClient() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async () => {
          // 이전 버전 FCM 전용 SW가 남아 있으면 충돌 방지 위해 정리
          const registrations = await navigator.serviceWorker.getRegistrations()
          await Promise.all(
            registrations
              .filter((reg) => reg.active?.scriptURL.includes("/firebase-messaging-sw.js"))
              .map((reg) => reg.unregister())
          )
        })
        .catch((error) => {
          console.error("Service worker registration failed:", error)
        })
    }

    if (document.readyState === "complete") {
      register()
    } else {
      window.addEventListener("load", register)
      return () => window.removeEventListener("load", register)
    }
  }, [])

  return null
}
