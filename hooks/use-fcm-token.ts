"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { getToken, onMessage, type MessagePayload, type Unsubscribe } from "firebase/messaging"
import { getFirebaseMessaging } from "@/lib/firebase"

type FcmStatus = "idle" | "requesting_permission" | "getting_token" | "success" | "error"

interface UseFcmTokenOptions {
  /**
   * FCM VAPID 키
   * 기본값: NEXT_PUBLIC_FIREBASE_VAPID_KEY
   */
  vapidKey?: string
  /**
   * 포그라운드 메시지를 수신했을 때의 콜백
   */
  onMessageReceived?: (payload: MessagePayload) => void
  /**
   * 자동으로 토큰 발급 요청할지 여부 (기본값: false)
   * true로 설정하면 컴포넌트 마운트 시 자동 실행
   */
  autoRequest?: boolean
}

export function useFcmToken(options: UseFcmTokenOptions = {}) {
  const [token, setToken] = useState<string | null>(null)
  const [status, setStatus] = useState<FcmStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  
  // onMessage 리스너 중복 방지를 위한 ref
  const unsubscribeRef = useRef<Unsubscribe | null>(null)

  const requestPermissionAndGetToken = useCallback(async () => {
    try {
      setError(null)

      // 1. 브라우저 환경 체크
      if (typeof window === "undefined") {
        setError("브라우저 환경에서만 FCM을 사용할 수 있습니다.")
        setStatus("error")
        return null
      }

      if (!("Notification" in window)) {
        setError("이 브라우저는 알림을 지원하지 않습니다.")
        setStatus("error")
        return null
      }

      // 2. 알림 권한 요청
      setStatus("requesting_permission")
      const permission = await Notification.requestPermission()

      if (permission !== "granted") {
        setError("알림 권한이 거부되었습니다.")
        setStatus("error")
        return null
      }

      console.log("✅ 알림 권한 승인됨")

      // 3. Service Worker 지원 확인
      if (!("serviceWorker" in navigator)) {
        setError("이 브라우저는 Service Worker를 지원하지 않습니다.")
        setStatus("error")
        return null
      }

      setStatus("getting_token")

      // 4. Service Worker 등록
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js")
      console.log("✅ Service Worker 등록:", registration.scope)
      
      // ✅ 추가: Service Worker 활성화 대기
      await navigator.serviceWorker.ready
      console.log("✅ Service Worker 활성화 완료")

      // 5. Firebase Messaging 초기화
      const messaging = await getFirebaseMessaging()

      if (!messaging) {
        setError("Firebase Messaging을 초기화할 수 없습니다.")
        setStatus("error")
        return null
      }

      // 6. VAPID 키 검증
      // 기본적으로 환경변수(NEXT_PUBLIC_FIREBASE_VAPID_KEY)를 사용하고,
      // 필요하면 options.vapidKey로 오버라이드할 수 있게 함
      const vapidKey = options.vapidKey ?? process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

      if (!vapidKey) {
        setError("VAPID 키가 설정되지 않았습니다. 환경변수를 확인해주세요.")
        setStatus("error")
        return null
      }

      console.log("🔑 VAPID 키 확인:", vapidKey.substring(0, 20) + "...")

      // 7. FCM 토큰 발급
      const currentToken = await getToken(messaging, {
        vapidKey: vapidKey,
        serviceWorkerRegistration: registration,
      })

      if (!currentToken) {
        setError("FCM 토큰을 가져오지 못했습니다.")
        setStatus("error")
        return null
      }

      console.log("✅ FCM 토큰 발급 성공:", currentToken.substring(0, 30) + "...")

      setToken(currentToken)
      setStatus("success")

      // 8. 로그아웃 시 사용하기 위해 로컬 스토리지에 저장
      try {
        window.localStorage.setItem("fcmToken", currentToken)
      } catch (e) {
        console.warn("[FCM] fcmToken을 localStorage에 저장하지 못했습니다.", e)
      }

      // 9. 포그라운드 메시지 리스너 등록 (중복 방지)
      if (options.onMessageReceived) {
        // 기존 리스너가 있으면 제거
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
        }
        
        // 새 리스너 등록
        unsubscribeRef.current = onMessage(messaging, (payload) => {
          console.log("📨 포그라운드 메시지 수신:", payload)
          options.onMessageReceived?.(payload)
        })
      }

      return currentToken
    } catch (err) {
      console.error("[FCM] 토큰 발급 중 오류:", err)
      
      // 더 구체적인 에러 메시지
      if (err instanceof Error) {
        setError(`FCM 토큰 발급 실패: ${err.message}`)
      } else {
        setError("FCM 토큰 발급 중 알 수 없는 오류가 발생했습니다.")
      }
      
      setStatus("error")
      return null
    }
  }, [options])

  // ✅ 자동 실행 옵션
  useEffect(() => {
    if (options.autoRequest && status === "idle") {
      requestPermissionAndGetToken()
    }
  }, [options.autoRequest, status, requestPermissionAndGetToken])

  // ✅ Cleanup: 컴포넌트 언마운트 시 리스너 제거
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [])

  return {
    token,
    status,
    error,
    requestPermissionAndGetToken,
  }
}