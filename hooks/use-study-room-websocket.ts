/**
 * 스터디룸 WebSocket 훅
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { StudyRoomWebSocket, DialDragMessage, TimerState, TimerStartRequest, MessageResponse, ParticipantMemberInfo, EnterStudyRoomRequest, RoomStatus, RoomStateResponse, ReflectionEvent, ReflectionNotificationEvent, HostTransferredEvent } from '@/lib/websocket'
import { playNotificationSound } from '@/lib/sound-notification'

export function useStudyRoomWebSocket(roomId: number | null) {
  const wsRef = useRef<StudyRoomWebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isHostDragging, setIsHostDragging] = useState(false)
  const [chatMessages, setChatMessages] = useState<MessageResponse[]>([])
  const [timerState, setTimerState] = useState<TimerState | null>(null)
  const [dialMinutes, setDialMinutes] = useState<number | null>(null)
  const [newMember, setNewMember] = useState<ParticipantMemberInfo | null>(null)
  const [exitedMemberId, setExitedMemberId] = useState<number | null>(null)
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null)
  const [focusTime, setFocusTime] = useState<number | null>(null)
  const [roomState, setRoomState] = useState<RoomStateResponse | null>(null)
  const [finishSession, setFinishSession] = useState<RoomStatus | null>(null)
  const [reflectionEvent, setReflectionEvent] = useState<ReflectionNotificationEvent | null>(null)
  const [reflectionData, setReflectionData] = useState<ReflectionEvent[]>([])
  const [hostTransferredEvent, setHostTransferredEvent] = useState<HostTransferredEvent | null>(null)
  const previousRunningStateRef = useRef<boolean | null>(null)
  const previousPhaseRef = useRef<string | null>(null)
  const isFirstFocusTickRef = useRef<boolean>(false)
  
  // 콜백을 ref로 관리하여 최신 함수 참조 보장
  const handleDialDragMessageRef = useRef<(message: DialDragMessage) => void | undefined>(undefined)
  const handleTimerStateRef = useRef<(state: TimerState) => void | undefined>(undefined)
  const handleChatMessageRef = useRef<(message: MessageResponse) => void | undefined>(undefined)
  const handleMemberEnterRef = useRef<(member: ParticipantMemberInfo | null) => void | undefined>(undefined)
  const handleMemberExitRef = useRef<(userId: number) => void | undefined>(undefined)
  const handleRoomStatusRef = useRef<(status: RoomStatus) => void | undefined>(undefined)
  const handleFocusTimeChangedRef = useRef<(focusTime: number) => void | undefined>(undefined)
  const handleRoomStateRef = useRef<(state: RoomStateResponse) => void | undefined>(undefined)
  const handleFinishSessionRef = useRef<(status: RoomStatus) => void | undefined>(undefined)
  const handleReflectionEventRef = useRef<(event: ReflectionNotificationEvent) => void | undefined>(undefined)
  const handleReflectionDataRef = useRef<(event: ReflectionEvent) => void | undefined>(undefined)

  // 다이얼 드래그 메시지 처리
  const handleDialDragMessage = useCallback((message: DialDragMessage) => {
    switch (message.type) {
      case 'DIAL_DRAG_START':
        setStatusMessage('방장이 집중 시간을 설정 중입니다')
        setIsHostDragging(true)
        setDialMinutes(message.minutes)
        break
      case 'DIAL_DRAG_MOVE':
        // 드래그 중에는 실시간으로 다이얼 시간 업데이트
        setDialMinutes(message.minutes)
        break
      case 'DIAL_DRAG_END':
        setIsHostDragging(false)
        setStatusMessage(null)
        setDialMinutes(null) // 드래그 종료 시 초기화
        break
    }
  }, [])
  
  handleDialDragMessageRef.current = handleDialDragMessage

  // 백엔드에서 보내는 TimerState 처리 (1초마다 업데이트)
  const handleTimerState = useCallback((state: TimerState) => {
    const previousRunning = previousRunningStateRef.current
    const previousPhase = previousPhaseRef.current
    
    // phase가 변경되었는지 확인
    const phaseChanged = previousPhase !== null && previousPhase !== state.phase
    
    // FOCUS로 변경된 직후 첫 번째 tick은 재생하지 않음 (Pling-Sound와 겹침 방지)
    if (phaseChanged && state.phase === 'FOCUS') {
      isFirstFocusTickRef.current = true
    }
    
    // 타이머가 실행 중이고 FOCUS 상태일 때만 tick.mov 재생 (소리 설정 확인)
    // 단, FOCUS로 변경된 직후 첫 번째 tick은 재생하지 않음
    if (state.running && state.phase === 'FOCUS' && !isFirstFocusTickRef.current) {
      playNotificationSound('/sounds/tick.mov', true)
    }
    
    // 첫 번째 tick을 건너뛴 후에는 플래그 초기화
    if (isFirstFocusTickRef.current && state.phase === 'FOCUS') {
      isFirstFocusTickRef.current = false
    }
    
    // 이전 phase 업데이트
    previousPhaseRef.current = state.phase
    
    // running 상태 변경 감지 (정지/재개 메시지 표시)
    if (previousRunning !== null && previousRunning !== state.running) {
      if (!state.running) {
        // 정지됨
        setStatusMessage('타이머가 일시정지되었습니다')
      } else {
        // 재개됨
        setStatusMessage('타이머가 재개되었습니다')
      }
    } else {
      // running 상태가 변경되지 않았을 때는 메시지를 표시하지 않음
      // (다이얼 드래그 중이 아닐 때만 메시지 제거)
      if (!isHostDragging) {
        setStatusMessage(null)
      }
    }
    
    // 이전 running 상태 업데이트
    previousRunningStateRef.current = state.running
    
    setTimerState(state)
    // 타이머가 시작되면 다이얼 드래그 상태 초기화
    if (state.running) {
      setDialMinutes(null)
      setIsHostDragging(false)
    }
  }, [isHostDragging])
  
  handleTimerStateRef.current = handleTimerState

  // 채팅 메시지 수신 콜백
  const handleChatMessage = useCallback((chatMessage: MessageResponse) => {
    // 채팅 메시지 처리 - 배열에 누적 (중복 방지)
    setChatMessages((prev) => {
      // 이미 같은 ID의 메시지가 있는지 확인
      const exists = prev.some((msg) => msg.messageId === chatMessage.messageId)
      if (exists) {
        return prev
      }
      return [...prev, chatMessage]
    })
  }, [])
  
  handleChatMessageRef.current = handleChatMessage

  // 참여자 입장 메시지 처리
  const handleMemberEnter = useCallback((member: ParticipantMemberInfo | null) => {
    setNewMember(member)
  }, [])
  
  handleMemberEnterRef.current = handleMemberEnter

  // 참여자 퇴장 메시지 처리
  const handleMemberExit = useCallback((userId: number) => {
    setExitedMemberId(userId)
  }, [])
  
  handleMemberExitRef.current = handleMemberExit

  // exitedMemberId 초기화 함수 (컴포넌트에서 처리 완료 후 호출)
  const clearExitedMemberId = useCallback(() => {
    setExitedMemberId(null)
  }, [])

  // 회고 다이얼로그 열기 알림 처리
  const handleReflectionEvent = useCallback((event: ReflectionNotificationEvent) => {
    setReflectionEvent(event)
  }, [])

  // 실제 회고 데이터 처리 (배열에 추가)
  const handleReflectionData = useCallback((event: ReflectionEvent) => {
    setReflectionData((prev) => {
      // 중복 방지: 이미 같은 reflectionId가 있는지 확인
      const exists = prev.some((r) => r.reflectionId === event.reflectionId)
      if (exists) {
        return prev
      }
      return [...prev, event]
    })
  }, [])

  // reflectionData에서 특정 항목 제거 함수
  const removeReflectionData = useCallback((reflectionId: number) => {
    setReflectionData((prev) => prev.filter((r) => r.reflectionId !== reflectionId))
  }, [])

  handleReflectionEventRef.current = handleReflectionEvent
  handleReflectionDataRef.current = handleReflectionData

  // 방장 권한 위임 알림 처리
  const handleHostTransferred = useCallback((event: HostTransferredEvent) => {
    setHostTransferredEvent(event)
  }, [])

  const handleHostTransferredRef = useRef<(event: HostTransferredEvent) => void | undefined>(undefined)
  handleHostTransferredRef.current = handleHostTransferred

  // 방 상태 변경 메시지 처리
  const handleRoomStatus = useCallback((status: RoomStatus) => {
    setRoomStatus(status)
    // 웹소켓 status 수신 시 소리 알림 재생
    playNotificationSound()
  }, [])
  
  handleRoomStatusRef.current = handleRoomStatus

  // 집중 시간 변경 메시지 처리
  const handleFocusTimeChanged = useCallback((newFocusTime: number) => {
    setFocusTime(newFocusTime)
  }, [])
  
  handleFocusTimeChangedRef.current = handleFocusTimeChanged

  // 방 상태 응답 메시지 처리 (status와 focusMinutes를 함께 받음)
  const handleRoomState = useCallback((state: RoomStateResponse) => {
    setRoomState(state)
  }, [])
  
  handleRoomStateRef.current = handleRoomState

  // 세션 종료 메시지 처리
  const handleFinishSession = useCallback((status: RoomStatus) => {
    setFinishSession(status)
  }, [])
  
  handleFinishSessionRef.current = handleFinishSession

  // WebSocket 연결
  useEffect(() => {
    if (!roomId) {
      // roomId가 없으면 메시지 배열 초기화
      setChatMessages([])
      return
    }

    // 기존 연결이 있으면 해제
    if (wsRef.current) {
      wsRef.current.disconnect()
      wsRef.current = null
    }

    const ws = new StudyRoomWebSocket()
    wsRef.current = ws

    ws.connect(
      roomId,
      (message: DialDragMessage | TimerState) => {
        // 백엔드에서 보내는 TimerState 처리
        if ('phase' in message && 'remainingSeconds' in message) {
          const timerState = message as TimerState
          handleTimerStateRef.current?.(timerState)
        }
        // 다이얼 드래그 메시지 처리
        else if ('type' in message && message.type.startsWith('DIAL_DRAG_')) {
          const dialMessage = message as DialDragMessage
          handleDialDragMessageRef.current?.(dialMessage)
        }
      },
      (chatMessage: MessageResponse) => {
        // ref를 통해 최신 콜백 호출
        handleChatMessageRef.current?.(chatMessage)
      },
      (member: ParticipantMemberInfo | null) => {
        // ref를 통해 최신 콜백 호출
        handleMemberEnterRef.current?.(member)
      },
      (userId: number) => {
        // ref를 통해 최신 콜백 호출
        handleMemberExitRef.current?.(userId)
      },
      (event: ReflectionNotificationEvent) => {
        // ref를 통해 최신 콜백 호출 (회고 다이얼로그 열기 알림)
        handleReflectionEventRef.current?.(event)
      },
      (status: RoomStatus) => {
        // ref를 통해 최신 콜백 호출
        handleRoomStatusRef.current?.(status)
      },
      (focusTime: number) => {
        // ref를 통해 최신 콜백 호출
        handleFocusTimeChangedRef.current?.(focusTime)
      },
      (roomState: RoomStateResponse) => {
        // ref를 통해 최신 콜백 호출
        handleRoomStateRef.current?.(roomState)
      },
      (status: RoomStatus) => {
        // ref를 통해 최신 콜백 호출
        handleFinishSessionRef.current?.(status)
      },
      (event: ReflectionEvent) => {
        // ref를 통해 최신 콜백 호출 (실제 회고 데이터)
        handleReflectionDataRef.current?.(event)
      },
      (event: HostTransferredEvent) => {
        // 방장 권한 위임 알림
        handleHostTransferredRef.current?.(event)
      }
    )
      .then(() => {
        setIsConnected(true)
      })
      .catch((error) => {
        console.error('WebSocket 연결 실패:', error)
        setIsConnected(false)
      })

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect()
        wsRef.current = null
      }
      setIsConnected(false)
      // 연결 해제 시 메시지 배열은 유지 (페이지 이동 시에만 초기화)
    }
  }, [roomId]) // roomId만 dependency로 사용하여 불필요한 재연결 방지

  // 다이얼 드래그 메시지 전송 (방장용)
  const sendDialDrag = useCallback((type: DialDragMessage['type'], minutes: number) => {
    if (!wsRef.current || !roomId) return

    wsRef.current.sendDialDrag({
      type,
      roomId,
      minutes,
    })
  }, [roomId])

  // 타이머 시작 요청 전송 (방장용)
  const sendTimerStart = useCallback((request: TimerStartRequest) => {
    if (!wsRef.current || !roomId) return

    wsRef.current.sendTimerStart(request)
  }, [roomId])

  // 타이머 일시정지 요청 전송 (방장용)
  const sendTimerPause = useCallback(() => {
    if (!wsRef.current || !roomId) return

    wsRef.current.sendTimerPause()
  }, [roomId])

  // 타이머 재개 요청 전송 (방장용)
  const sendTimerResume = useCallback(() => {
    if (!wsRef.current || !roomId) return

    wsRef.current.sendTimerResume()
  }, [roomId])

  // 다음 집중 시간 설정 전송 (방장용)
  const sendNextFocusMinutes = useCallback((minutes: number) => {
    if (!wsRef.current || !roomId) return

    wsRef.current.sendNextFocusMinutes(minutes)
  }, [roomId])

  // 채팅 메시지 전송
  const sendChatMessage = useCallback((content: string, userId: number) => {
    if (!wsRef.current || !roomId || !userId) return

    wsRef.current.sendChatMessage(content, userId)
  }, [roomId])

  // 방 참여 요청 전송
  const sendEnterRoom = useCallback((request: EnterStudyRoomRequest) => {
    if (!wsRef.current || !roomId) return

    wsRef.current.sendEnterRoom(request)
  }, [roomId])

  // 방 떠나기 요청 전송
  const sendMemberExit = useCallback((userId: number) => {
    if (!wsRef.current || !roomId) return

    wsRef.current.sendMemberExit(userId)
  }, [roomId])

  // 회고 생성 요청 전송
  const sendReflection = useCallback((
    request: {
      userId: number
      sessionId: number
      content: string
      focusScore: number | null
      imageUrl: string | null
    }
  ) => {
    if (!wsRef.current || !roomId) return

    wsRef.current.sendReflection(request)
  }, [roomId])

  return {
    isConnected,
    statusMessage,
    isHostDragging,
    timerState,
    dialMinutes,
    sendDialDrag,
    sendTimerStart,
    sendTimerPause,
    sendTimerResume,
    sendNextFocusMinutes,
    sendChatMessage,
    chatMessages,
    newMember,
    exitedMemberId,
    clearExitedMemberId,
    sendEnterRoom,
    sendMemberExit,
    sendReflection,
    roomStatus,
    focusTime,
    roomState,
    finishSession,
    reflectionEvent,
    reflectionData,
    removeReflectionData,
    hostTransferredEvent,
  }
}
