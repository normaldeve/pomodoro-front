/**
 * 시스템 알림 관리
 * 오른쪽 상단에서 슬라이드 형식으로 표시되는 알림 시스템
 */

import { toast } from '@/hooks/use-toast'

export type NotificationType = 'success' | 'error' | 'info' | 'warning'

export interface SystemNotificationOptions {
  type?: NotificationType
  duration?: number
}

/**
 * 시스템 알림 표시 함수
 * @param message 알림 메시지 (또는 { title, description } 객체)
 * @param options 알림 옵션
 */
export function showSystemNotification(
  message: string | { title: string; description?: string },
  options: SystemNotificationOptions = {}
) {
  const { type = 'success', duration = 6000 } = options

  const variant = type === 'error' ? 'destructive' : 'default'

  // 타입에 따라 배경색 결정
  // success: 초록색, error/warning/info: 오렌지색
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-orange-500'

  // message가 객체인 경우 title과 description 분리
  const title = typeof message === 'string' ? message : message.title
  const description = typeof message === 'string' ? undefined : message.description

  const toastId = toast({
    title,
    description,
    variant,
    className: `${bgColor} text-white border-none rounded-none shadow-lg`,
  })

  // duration 후 자동으로 닫기
  if (duration > 0) {
    setTimeout(() => {
      toastId.dismiss()
    }, duration)
  }
}

/**
 * 성공 알림
 */
export function showSuccessNotification(message: string | { title: string; description?: string }) {
  showSystemNotification(message, { type: 'success' })
}

/**
 * 에러 알림
 */
export function showErrorNotification(message: string | { title: string; description?: string }) {
  showSystemNotification(message, { type: 'error' })
}

/**
 * 정보 알림
 */
export function showInfoNotification(message: string | { title: string; description?: string }) {
  showSystemNotification(message, { type: 'info' })
}

/**
 * 경고 알림
 */
export function showWarningNotification(message: string | { title: string; description?: string }) {
  showSystemNotification(message, { type: 'warning' })
}
