import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { MessageResponse } from './api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 메시지 응답에서 타임스탬프를 Date 객체로 변환
 */
export function parseMessageTimestamp(msg: MessageResponse): Date {
  try {
    const timeString = msg.createdAt || msg.timestamp
    if (!timeString) {
      return new Date()
    }
    const timestamp = new Date(timeString)
    if (isNaN(timestamp.getTime())) {
      return new Date()
    }
    return timestamp
  } catch (error) {
    return new Date()
  }
}

/**
 * 방 상태를 한글로 변환
 */
export function getStatusText(status: string): string {
  switch (status) {
    case "WAITING":
      return "시작 전"
    case "FOCUS":
      return "집중 시간"
    case "BREAK":
      return "쉬는 시간"
    case "FINISHED":
      return "세션 종료"
    default:
      return "시작 전"
  }
}

/**
 * 방 상태에 따른 색상
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "WAITING":
      return "#22c55e"
    case "FOCUS":
      return "#d2001a"
    case "BREAK":
      return "#f59e0b"
    case "FINISHED":
      return "#9ca3af"
    default:
      return "#22c55e"
  }
}
