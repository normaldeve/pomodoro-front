"use client"

import { useEffect, useRef } from "react"

type WakeLockSentinelLike = {
  released: boolean
  release: () => Promise<void>
}

type WakeLockLike = {
  request: (type: "screen") => Promise<WakeLockSentinelLike>
}

export function useWakeLock(enabled: boolean) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!enabled) {
      if (sentinelRef.current && !sentinelRef.current.released) {
        void sentinelRef.current.release()
      }
      sentinelRef.current = null
      return
    }

    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock
    if (!wakeLock) {
      return
    }

    let isUnmounted = false

    const requestWakeLock = async () => {
      try {
        const sentinel = await wakeLock.request("screen")
        if (isUnmounted) {
          await sentinel.release()
          return
        }
        sentinelRef.current = sentinel
      } catch (error) {
        console.warn("[WakeLock] Failed to acquire wake lock:", error)
      }
    }

    const handleVisibilityChange = () => {
      if (!enabled) return
      if (document.visibilityState === "visible") {
        void requestWakeLock()
      } else if (sentinelRef.current && !sentinelRef.current.released) {
        void sentinelRef.current.release()
        sentinelRef.current = null
      }
    }

    void requestWakeLock()
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      isUnmounted = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (sentinelRef.current && !sentinelRef.current.released) {
        void sentinelRef.current.release()
      }
      sentinelRef.current = null
    }
  }, [enabled])
}
