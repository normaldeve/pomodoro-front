/**
 * 서버 연결 상태 관리
 */

type ServerStatusListener = (isConnected: boolean) => void

let isServerConnected = true
const listeners: ServerStatusListener[] = []

/**
 * 서버 연결 상태를 구독합니다
 */
export function subscribeServerStatus(listener: ServerStatusListener): () => void {
  listeners.push(listener)
  // 초기 상태 전달
  listener(isServerConnected)
  
  // 구독 해제 함수 반환
  return () => {
    const index = listeners.indexOf(listener)
    if (index > -1) {
      listeners.splice(index, 1)
    }
  }
}

/**
 * 서버 연결 상태를 업데이트합니다
 */
export function setServerStatus(connected: boolean): void {
  if (isServerConnected !== connected) {
    isServerConnected = connected
    listeners.forEach(listener => listener(isServerConnected))
  }
}

/**
 * 현재 서버 연결 상태를 반환합니다
 */
export function getServerStatus(): boolean {
  return isServerConnected
}

/**
 * 네트워크 에러인지 확인합니다
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }
  if (error instanceof Error) {
    return (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('network') ||
      error.message.includes('ERR_INTERNET_DISCONNECTED') ||
      error.message.includes('ERR_NETWORK_CHANGED')
    )
  }
  return false
}
