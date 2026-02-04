/**
 * WebSocket 연결 및 메시지 관리
 */

import { Client } from '@stomp/stompjs'

// WebSocket URL 생성
// - 개발 환경 (localhost): 백엔드 직접 연결 (ws://localhost:8080/ws)
// - 운영 환경: 현재 페이지의 프로토콜 사용 (ws:// 또는 wss://)
const getWebSocketUrl = (): string => {
  // 브라우저 환경
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // localhost 또는 127.0.0.1이면 개발 환경
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'ws://localhost:8080/ws'
    }
    
    // 운영 환경: 현재 페이지의 프로토콜 사용
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}/ws`
  }
  
  // 서버 사이드 렌더링 환경 (빌드 시)
  // 환경 변수가 있으면 사용, 없으면 기본값
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
  if (apiBaseUrl) {
    try {
      const url = new URL(apiBaseUrl)
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${url.host}/ws`
    } catch {
      // URL 파싱 실패 시 기본값 반환
    }
  }
  
  // 기본값 (개발 환경)
  return 'ws://localhost:8080/ws'
}

const WS_URL = getWebSocketUrl()

/**
 * 다이얼 드래그 메시지 타입
 */
export type DialDragType = 'DIAL_DRAG_START' | 'DIAL_DRAG_MOVE' | 'DIAL_DRAG_END'

export interface DialDragMessage {
  type: DialDragType
  roomId: number
  minutes: number
  timestamp?: string
}

/**
 * 타이머 페이즈 타입 (백엔드와 동일)
 */
export type TimerPhase = 'FOCUS' | 'BREAK' | 'FINISHED'

/**
 * 타이머 상태 (백엔드에서 1초마다 전송하는 구조)
 */
export interface TimerState {
  roomId: number
  phase: TimerPhase
  remainingSeconds: number
  phaseDurationSeconds: number
  currentSession: number
  totalSessions: number
  running: boolean  // 백엔드와 동일하게 running 사용
  phaseStartTime: number
}

/**
 * 타이머 시작 요청 (백엔드와 동일)
 */
export interface TimerStartRequest {
  focusMinutes: number
  breakMinutes: number
  totalSessions: number
}

/**
 * 채팅 메시지 요청
 */
export interface SendMessageRequest {
  senderId: number
  content: string
}

/**
 * 채팅 메시지 응답 (백엔드에서 받는 형식)
 */
export interface MessageResponse {
  messageId: number  // 백엔드에서 messageId로 전송
  content: string
  senderId: number
  senderName?: string
  senderNickname?: string
  timestamp: string
  roomId?: number
}

/**
 * 방 참여 요청
 */
export interface EnterStudyRoomRequest {
  userId: number
  password?: string
  /**
   * 사용자가 방에 입장할 때 사용한 프론트엔드 URL
   * (백엔드에서 방 URL 검증/추적 시 사용)
   */
  roomUrl?: string
}

/**
 * 참여자 정보 (백엔드에서 받는 형식)
 */
export interface ParticipantMemberInfo {
  userId: number
  nickname: string
  profileUrl: string | null
}

/**
 * 방장 권한 위임 알림 (백엔드 HostTransferredResponse와 동일)
 */
export interface HostTransferredEvent {
  previousHostId: number
  previousHostNickname: string
  previousHostProfileUrl: string | null
  newHostId: number
  newHostNickname: string
  newHostProfileUrl: string | null
  isAutoTransfer: boolean
}

/**
 * 방 입장 응답 (백엔드에서 받는 형식)
 */
export interface EnterRoomWsResponse {
  success: boolean
  member: ParticipantMemberInfo | null
  errorCode: string | null
}

/**
 * 방 상태 타입 (백엔드와 동일)
 */
export type RoomStatus = 'WAITING' | 'FOCUS' | 'BREAK' | 'FINISHED'

/**
 * 방 상태 응답 (백엔드에서 받는 형식)
 */
export interface RoomStateResponse {
  status: RoomStatus
  focusMinutes: number
}

/**
 * 회고 다이얼로그 열기 알림 (백엔드에서 회고 작성 요청 시 전송)
 */
export interface ReflectionNotificationEvent {
  roomId: number
  sessionId: number
}

/**
 * 실제 회고 데이터 (백엔드 ReflectionResponse와 동일)
 */
export interface ReflectionEvent {
  reflectionId: number
  sessionId: number
  userId: number
  content: string
  nickname: string
  userProfileUrl: string | null
  focusScore: number | null
  imageUrl: string | null
  createdAt: string
}

/**
 * WebSocket 클라이언트 클래스
 */
export class StudyRoomWebSocket {
  private client: Client | null = null
  private roomId: number | null = null
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private onMessageCallback: ((message: DialDragMessage | TimerState) => void) | null = null
  private onChatMessageCallback: ((message: MessageResponse) => void) | null = null
  private onMemberEnterCallback: ((member: ParticipantMemberInfo | null) => void) | null = null
  private onMemberExitCallback: ((userId: number) => void) | null = null
  private onHostTransferredCallback: ((event: HostTransferredEvent) => void) | null = null
  private onRoomStatusCallback: ((status: RoomStatus) => void) | null = null
  private onFocusTimeChangedCallback: ((focusTime: number) => void) | null = null
  private onRoomStateCallback: ((state: RoomStateResponse) => void) | null = null
  private onFinishSessionCallback: ((status: RoomStatus) => void) | null = null
  private onReflectionCallback: ((event: ReflectionNotificationEvent) => void) | null = null
  private onReflectionDataCallback: ((event: ReflectionEvent) => void) | null = null
  private timerSubscription: any = null
  private chatSubscription: any = null
  private memberSubscription: any = null
  private roomStatusSubscription: any = null
  private focusTimeSubscription: any = null
  private roomStateSubscription: any = null
  private finishSessionSubscription: any = null
  private reflectionSubscription: any = null

  /**
   * WebSocket 연결
   */
  connect(
    roomId: number,
    onMessage: (message: DialDragMessage | TimerState) => void,
    onChatMessage?: (message: MessageResponse) => void,
    onMemberEnter?: (member: ParticipantMemberInfo | null) => void,
    onMemberExit?: (userId: number) => void,
    onReflection?: (event: ReflectionNotificationEvent) => void,
    onRoomStatus?: (status: RoomStatus) => void,
    onFocusTimeChanged?: (focusTime: number) => void,
    onRoomState?: (state: RoomStateResponse) => void,
    onFinishSession?: (status: RoomStatus) => void,
    onReflectionData?: (event: ReflectionEvent) => void,
    onHostTransferred?: (event: HostTransferredEvent) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // 콜백 저장 (재연결 시에도 사용)
      this.onMessageCallback = onMessage
      this.onChatMessageCallback = onChatMessage || null
      this.onMemberEnterCallback = onMemberEnter || null
      this.onMemberExitCallback = onMemberExit || null
      this.onHostTransferredCallback = onHostTransferred || null
      this.onReflectionCallback = onReflection || null
      this.onReflectionDataCallback = onReflectionData || null
      this.onRoomStatusCallback = onRoomStatus || null
      this.onFocusTimeChangedCallback = onFocusTimeChanged || null
      this.onRoomStateCallback = onRoomState || null
      this.onFinishSessionCallback = onFinishSession || null

      // 이미 연결되어 있고 같은 roomId면 구독만 다시 설정
      if (this.isConnected && this.client && this.roomId === roomId) {
        this.setupSubscriptions()
        resolve()
        return
      }

      // 기존 연결이 있으면 해제
      if (this.client) {
        this.client.deactivate()
        this.client = null
        this.isConnected = false
      }

      this.roomId = roomId
      const token = localStorage.getItem('accessToken')

      this.client = new Client({
        brokerURL: WS_URL,
        connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        debug: (str) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('STOMP:', str)
          }
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          this.isConnected = true
          this.reconnectAttempts = 0

          // 구독 설정
          this.setupSubscriptions()

          resolve()
        },
        onStompError: (frame) => {
          console.error('STOMP 에러:', frame)
          this.isConnected = false
          reject(new Error(frame.headers['message'] || 'WebSocket 연결 실패'))
        },
        onWebSocketClose: () => {
          this.isConnected = false
        },
        onDisconnect: () => {
          this.isConnected = false
        },
      })

      this.client.activate()
    })
  }

  /**
   * 구독 설정 (연결 시 및 재연결 시 호출)
   */
  private setupSubscriptions(): void {
    if (!this.client || !this.roomId) return

    // 기존 구독 해제
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe()
      this.timerSubscription = null
    }
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe()
      this.chatSubscription = null
    }
    if (this.memberSubscription) {
      this.memberSubscription.unsubscribe()
      this.memberSubscription = null
    }
    if (this.roomStatusSubscription) {
      this.roomStatusSubscription.unsubscribe()
      this.roomStatusSubscription = null
    }
    if (this.focusTimeSubscription) {
      this.focusTimeSubscription.unsubscribe()
      this.focusTimeSubscription = null
    }
    if (this.roomStateSubscription) {
      this.roomStateSubscription.unsubscribe()
      this.roomStateSubscription = null
    }
    if (this.finishSessionSubscription) {
      this.finishSessionSubscription.unsubscribe()
      this.finishSessionSubscription = null
    }

    // 타이머 관련 구독 (백엔드에서 TimerState를 1초마다 전송)
    if (this.onMessageCallback) {
      this.timerSubscription = this.client.subscribe(
        `/topic/study-room/${this.roomId}/timer`,
        (message) => {
          try {
            const data = JSON.parse(message.body)
            // 백엔드에서 보내는 TimerState 구조인지 확인
            if (data.phase && data.remainingSeconds !== undefined) {
              // TimerState 타입으로 처리
              this.onMessageCallback?.(data as TimerState)
            } else if (data.type && data.type.startsWith('DIAL_DRAG_')) {
              // DialDragMessage 타입으로 처리
              this.onMessageCallback?.(data as DialDragMessage)
            }
          } catch (error) {
            console.error('메시지 파싱 실패:', error)
          }
        }
      )
    }

    // 채팅 메시지 구독
    if (this.onChatMessageCallback) {
      this.chatSubscription = this.client.subscribe(
        `/topic/study-room/${this.roomId}/messages`,
        (message) => {
          try {
            const data = JSON.parse(message.body) as MessageResponse
            this.onChatMessageCallback?.(data)
          } catch (error) {
            console.error('채팅 메시지 파싱 실패:', error)
          }
        }
      )
    }

    // 참여자 입장/퇴장/방장 변경 구독
    if (this.onMemberEnterCallback || this.onMemberExitCallback || this.onHostTransferredCallback) {
      this.memberSubscription = this.client.subscribe(
        `/topic/study-room/${this.roomId}/members`,
        (message) => {
          try {
            const data = JSON.parse(message.body)
            
            // 퇴장 메시지: userId (숫자)만 전송되는 경우
            if (typeof data === 'number') {
              this.onMemberExitCallback?.(data)
              return
            }

            // 방장 변경 알림: HostTransferredEvent 구조
            if (
              typeof data === 'object' &&
              data !== null &&
              'previousHostId' in data &&
              'newHostId' in data
            ) {
              this.onHostTransferredCallback?.(data as HostTransferredEvent)
              return
            }

            // 입장 메시지: ParticipantMemberInfo 객체 또는 null
            if (data === null || data === undefined) {
              this.onMemberEnterCallback?.(null)
            } else if (typeof data === 'object' && 'userId' in data) {
              // 객체인 경우 입장 메시지로 처리
              this.onMemberEnterCallback?.(data as ParticipantMemberInfo)
            }
          } catch (error) {
            console.error('참여자 정보 파싱 실패:', error)
          }
        }
      )
    }

    // 방 상태 구독
    if (this.onRoomStatusCallback) {
      this.roomStatusSubscription = this.client.subscribe(
        `/topic/study-room/${this.roomId}/status`,
        (message) => {
          try {
            let status: RoomStatus
            
            // JSON으로 전송되는 경우와 문자열로 전송되는 경우 모두 처리
            try {
              const parsed = JSON.parse(message.body)
              // JSON 객체인 경우 문자열 값 추출
              status = (typeof parsed === 'string' ? parsed : parsed.toString()) as RoomStatus
            } catch {
              // JSON 파싱 실패 시 문자열로 직접 사용
              status = message.body as RoomStatus
            }
            
            // 유효한 상태인지 확인
            if (['WAITING', 'FOCUS', 'BREAK', 'FINISHED'].includes(status)) {
              this.onRoomStatusCallback?.(status)
            } else {
              console.warn('유효하지 않은 방 상태:', status)
            }
          } catch (error) {
            console.error('방 상태 파싱 실패:', error)
          }
        }
      )
    }

    // 집중 시간 변경 구독
    if (this.onFocusTimeChangedCallback) {
      this.focusTimeSubscription = this.client.subscribe(
        `/topic/study-room/${this.roomId}/focus-time`,
        (message) => {
          try {
            // 백엔드에서 숫자 값으로 전송
            let focusTime: number
            try {
              const parsed = JSON.parse(message.body)
              focusTime = typeof parsed === 'number' ? parsed : Number(parsed)
            } catch {
              // JSON 파싱 실패 시 문자열을 숫자로 변환
              focusTime = Number(message.body)
            }
            
            if (!isNaN(focusTime) && focusTime > 0) {
              this.onFocusTimeChangedCallback?.(focusTime)
            } else {
              console.warn('유효하지 않은 집중 시간:', focusTime)
            }
          } catch (error) {
            console.error('집중 시간 파싱 실패:', error)
          }
        }
      )
    }

    // 방 상태 응답 구독 (status와 focusMinutes를 함께 받음)
    if (this.onRoomStateCallback) {
      this.roomStateSubscription = this.client.subscribe(
        `/topic/study-room/${this.roomId}/room-state`,
        (message) => {
          try {
            const data = JSON.parse(message.body) as RoomStateResponse
            
            // 유효한 상태인지 확인
            if (data.status && ['WAITING', 'FOCUS', 'BREAK', 'FINISHED'].includes(data.status)) {
              // focusMinutes가 유효한 숫자인지 확인
              if (typeof data.focusMinutes === 'number' && data.focusMinutes > 0) {
                this.onRoomStateCallback?.(data)
              } else {
                console.warn('유효하지 않은 집중 시간:', data.focusMinutes)
              }
            } else {
              console.warn('유효하지 않은 방 상태:', data.status)
            }
          } catch (error) {
            console.error('방 상태 응답 파싱 실패:', error)
          }
        }
      )
    }

    // 회고 이벤트 구독 (다이얼로그 알림 + 실제 회고 데이터)
    if (this.onReflectionCallback || this.onReflectionDataCallback) {
      this.reflectionSubscription = this.client.subscribe(
        `/topic/study-room/${this.roomId}/reflection`,
        (message) => {
          try {
            const rawData = JSON.parse(message.body)
            
            // 실제 회고 데이터인지 확인 (전체 필드가 있는 경우)
            if (
              typeof rawData.reflectionId === 'number' &&
              typeof rawData.sessionId === 'number' &&
              typeof rawData.userId === 'number' &&
              typeof rawData.content === 'string' &&
              typeof rawData.nickname === 'string' &&
              (rawData.userProfileUrl === null || typeof rawData.userProfileUrl === 'string') &&
              (rawData.focusScore === null || typeof rawData.focusScore === 'number') &&
              (rawData.imageUrl === null || typeof rawData.imageUrl === 'string') &&
              typeof rawData.createdAt === 'string'
            ) {
              // 실제 회고 데이터
              const reflectionData: ReflectionEvent = {
                reflectionId: rawData.reflectionId,
                sessionId: rawData.sessionId,
                userId: rawData.userId,
                content: rawData.content,
                nickname: rawData.nickname,
                userProfileUrl: rawData.userProfileUrl,
                focusScore: rawData.focusScore,
                imageUrl: rawData.imageUrl,
                createdAt: rawData.createdAt,
              }
              this.onReflectionDataCallback?.(reflectionData)
            } 
            // 회고 다이얼로그 열기 알림인지 확인 (roomId, sessionId만 있는 경우)
            else if (
              typeof rawData.roomId === 'number' &&
              typeof rawData.sessionId === 'number' &&
              rawData.reflectionId === undefined
            ) {
              // 회고 다이얼로그 열기 알림
              const notification: ReflectionNotificationEvent = {
                roomId: rawData.roomId,
                sessionId: rawData.sessionId,
              }
              this.onReflectionCallback?.(notification)
            } else {
              console.warn('[WebSocket] 알 수 없는 회고 이벤트 형식:', rawData)
            }
          } catch (error) {
            console.error('회고 이벤트 파싱 실패:', error)
          }
        }
      )
    }

    // 세션 종료 구독
    if (this.onFinishSessionCallback) {
      this.finishSessionSubscription = this.client.subscribe(
        `/topic/study-room/${this.roomId}/finish-session`,
        (message) => {
          try {
            let status: RoomStatus
            
            // JSON으로 전송되는 경우와 문자열로 전송되는 경우 모두 처리
            try {
              const parsed = JSON.parse(message.body)
              // JSON 객체인 경우 문자열 값 추출
              status = (typeof parsed === 'string' ? parsed : parsed.toString()) as RoomStatus
            } catch {
              // JSON 파싱 실패 시 문자열로 직접 사용
              status = message.body as RoomStatus
            }
            
            // 유효한 상태인지 확인
            if (['WAITING', 'FOCUS', 'BREAK', 'FINISHED'].includes(status)) {
              this.onFinishSessionCallback?.(status)
            } else {
              console.warn('유효하지 않은 세션 종료 상태:', status)
            }
          } catch (error) {
            console.error('세션 종료 상태 파싱 실패:', error)
          }
        }
      )
    }
  }

  /**
   * 다이얼 드래그 메시지 전송
   */
  sendDialDrag(message: DialDragMessage): void {
    if (!this.client || !this.isConnected || !this.roomId) {
      console.warn('WebSocket이 연결되지 않았습니다.')
      return
    }

    const token = localStorage.getItem('accessToken')
    const payload = {
      ...message,
      roomId: this.roomId,
      timestamp: new Date().toISOString(),
    }

    this.client.publish({
      destination: `/app/study-room/${this.roomId}/timer/dial-drag`,
      body: JSON.stringify(payload),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  }

  /**
   * 타이머 시작 요청 전송 (방장용)
   */
  sendTimerStart(request: TimerStartRequest): void {
    if (!this.client || !this.isConnected || !this.roomId) {
      console.warn('WebSocket이 연결되지 않았습니다.')
      return
    }

    const token = localStorage.getItem('accessToken')
    const payload = {
      ...request,
    }

    this.client.publish({
      destination: `/app/study-room/${this.roomId}/timer/start`,
      body: JSON.stringify(payload),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  }

  /**
   * 타이머 일시정지 요청 전송 (방장용)
   */
  sendTimerPause(): void {
    if (!this.client || !this.isConnected || !this.roomId) {
      console.warn('WebSocket이 연결되지 않았습니다.')
      return
    }

    const token = localStorage.getItem('accessToken')

    this.client.publish({
      destination: `/app/study-room/${this.roomId}/timer/pause`,
      body: JSON.stringify({}),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  }

  /**
   * 타이머 재개 요청 전송 (방장용)
   */
  sendTimerResume(): void {
    if (!this.client || !this.isConnected || !this.roomId) {
      console.warn('WebSocket이 연결되지 않았습니다.')
      return
    }

    const token = localStorage.getItem('accessToken')

    this.client.publish({
      destination: `/app/study-room/${this.roomId}/timer/resume`,
      body: JSON.stringify({}),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  }

  /**
   * 다음 집중 시간 설정 (방장용 - 쉬는 시간 중)
   */
  sendNextFocusMinutes(minutes: number): void {
    if (!this.client || !this.isConnected || !this.roomId) {
      console.warn('WebSocket이 연결되지 않았습니다.')
      return
    }

    const token = localStorage.getItem('accessToken')

    this.client.publish({
      destination: `/app/study-room/${this.roomId}/timer/next-focus`,
      body: JSON.stringify({ focusMinutes: minutes }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  }

  /**
   * 채팅 메시지 전송
   */
  sendChatMessage(content: string, userId: number): void {
    if (!this.client || !this.isConnected || !this.roomId) {
      console.warn('WebSocket이 연결되지 않았습니다.')
      return
    }

    if (!userId) {
      console.warn('사용자 ID가 없습니다.')
      return
    }

    const token = localStorage.getItem('accessToken')
    const payload: SendMessageRequest = {
      senderId: userId,
      content,
    }

    this.client.publish({
      destination: `/app/study-room/${this.roomId}/messages`,
      body: JSON.stringify(payload),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  }

  /**
   * 방 참여 요청 전송
   */
  sendEnterRoom(request: EnterStudyRoomRequest): void {
    if (!this.client || !this.isConnected || !this.roomId) {
      console.warn('WebSocket이 연결되지 않았습니다.')
      return
    }

    const token = localStorage.getItem('accessToken')
    const payload: EnterStudyRoomRequest = {
      userId: request.userId,
      password: request.password,
      roomUrl: request.roomUrl,
    }

    this.client.publish({
      destination: `/app/study-room/${this.roomId}/members/enter`,
      body: JSON.stringify(payload),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  }

  /**
   * 방 떠나기 요청 전송
   */
  sendMemberExit(userId: number): void {
    if (!this.client || !this.isConnected || !this.roomId) {
      console.warn('WebSocket이 연결되지 않았습니다.')
      return
    }

    const token = localStorage.getItem('accessToken')

    this.client.publish({
      destination: `/app/study-room/${this.roomId}/members/exit`,
      body: JSON.stringify(userId),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  }

  /**
   * 회고 생성 요청 전송
   */
  sendReflection(request: {
    userId: number
    sessionId: number
    content: string
    focusScore: number | null
    imageUrl: string | null
  }): void {
    if (!this.client || !this.isConnected || !this.roomId) {
      console.warn('WebSocket이 연결되지 않았습니다.')
      return
    }

    const token = localStorage.getItem('accessToken')

    this.client.publish({
      destination: `/app/study-room/${this.roomId}/reflection`,
      body: JSON.stringify(request),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  }

  /**
   * WebSocket 연결 해제
   */
  disconnect(): void {
    if (this.client) {
      this.client.deactivate()
      this.client = null
    }
    this.isConnected = false
    this.roomId = null
  }

  /**
   * 연결 상태 확인
   */
  getConnected(): boolean {
    return this.isConnected
  }
}
