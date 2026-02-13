"use client"

import { useEffect } from "react"
import { onMessage, type MessagePayload } from "firebase/messaging"
import { getFirebaseMessaging } from "@/lib/firebase"
import { showInfoNotification } from "@/lib/system-notification"

/**
 * 웹이 활성화(포그라운드)되어 있을 때 수신하는 FCM 메시지를 처리하는 리스너
 * - 알림 클릭 시 이동은 하지 않고, 내용만 토스트로 보여준다.
 */
export function FcmForegroundListener() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const setupListener = async () => {
      try {
        const messaging = await getFirebaseMessaging()
        if (!messaging) {
          return
        }

        unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
          // 디버깅용 로그
          console.log("[FCM] 포그라운드 메시지 수신:", payload)

          const title = payload.notification?.title ?? "스터디 알림"
          const body = payload.notification?.body ?? ""

          // 타입/추가 데이터는 필요 시 콘솔에서 확인
          if (payload.data) {
            console.log("[FCM] data:", payload.data)
          }

          // 1순위: 브라우저/OS 알림(Notification API)
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              // 브라우저 알림 표시 (스크린샷과 같은 형태)
              new Notification(title, {
                body,
                data: payload.data,
                icon: payload.notification?.icon ?? "/images/home_icon.png",
              })
              return
            } catch (e) {
              console.warn("[FCM] 브라우저 Notification 표시 중 오류, 토스트로 대체:", e)
            }
          }

          // 2순위: 브라우저 알림을 못 쓸 때는 기존 시스템 토스트 사용
          showInfoNotification({
            title,
            description: body || undefined,
          })
        })
      } catch (error) {
        console.error("[FCM] 포그라운드 메시지 리스너 설정 중 오류:", error)
      }
    }

    void setupListener()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  return null
}

