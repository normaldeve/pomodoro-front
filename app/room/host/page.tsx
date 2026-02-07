"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef, Suspense } from "react"
import { DoorClosed } from "lucide-react"
import PomodoroTimer from "@/components/pomodoro-timer"
import FlipTimer from "@/components/flip-timer"
import { TimerType } from "@/lib/api"
import LiquidChat from "@/components/liquid-chat"
import { GoalsList } from "@/components/ui/goals-list"
import { Reflection } from "@/components/ui/reflection"
import { ReflectionDialog } from "@/components/ui/reflection-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getStudyRoomMembers, StudyRoomMemberResponse, getStudyRoom, getMessages, RoomMemberRole, getRoomReflections, ReflectionResponse, transferHost, getCurrentUser } from "@/lib/api"
import { getStatusText, getStatusColor } from "@/lib/utils"
import { ParticipantsList } from "@/components/ui/participants-list"
import { parseMessageTimestamp } from "@/lib/utils"
import { useStudyRoomWebSocket } from "@/hooks/use-study-room-websocket"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound-notification"
import { Volume2, VolumeX, MessageSquare, Clock, BookOpen, Users, MoreVertical, X } from "lucide-react"

// 초를 00:00 형식으로 변환하는 함수
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

function HostRoomPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isReflectionDialogOpen, setIsReflectionDialogOpen] = useState(false)
  const [isWelcomeDialogOpen, setIsWelcomeDialogOpen] = useState(false)
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [isSessionFinishedDialogOpen, setIsSessionFinishedDialogOpen] = useState(false)
  const [isHostTransferredDialogOpen, setIsHostTransferredDialogOpen] = useState(false)
  const [hostTransferredMessage, setHostTransferredMessage] = useState<string>("")
  const [isTransferHostDialogOpen, setIsTransferHostDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"timer" | "reflection">("timer")
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false)
  const [isFloatingMenuOpen, setIsFloatingMenuOpen] = useState(false)
  const [hasNewChat, setHasNewChat] = useState(false)
  const [hasNewParticipantsEvent, setHasNewParticipantsEvent] = useState(false)
  const [transferTargetUserId, setTransferTargetUserId] = useState<number | null>(null)
  const [transferTargetNickname, setTransferTargetNickname] = useState<string>("")
  const [currentReflectionSessionId, setCurrentReflectionSessionId] = useState<number | null>(null)
  const isNavigatingToSummary = useRef(false)
  const hasShownFinishedDialog = useRef(false)
  const [roomInfo, setRoomInfo] = useState<{
    roomId: number
    title: string
    hashtags: string[]
    focusMinutes: number
    breakMinutes: number
    totalSessions: number
    currentSession: number
    currentParticipants: number
    maxParticipants: number
    secret: boolean
    hostId: number
    status: string
    timerType: string
    isPermanent: boolean
    createdAt: string
  } | null>(null)
  const [participants, setParticipants] = useState<StudyRoomMemberResponse[]>([])
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false)
  const [soundEnabled, setSoundEnabledState] = useState(true)

  // WebSocket 연결
  const { sendDialDrag, sendTimerStart, sendTimerPause, sendTimerResume, sendNextFocusMinutes, statusMessage, timerState, sendChatMessage, chatMessages, newMember, exitedMemberId, clearExitedMemberId, sendEnterRoom, sendMemberExit, sendReflection, roomStatus, focusTime, roomState, finishSession, reflectionEvent, reflectionData, removeReflectionData, hostTransferredEvent } = useStudyRoomWebSocket(roomInfo?.roomId || null)
  const [currentUser, setCurrentUser] = useState<{ id: number; nickname: string } | null>(null)
  const [liquidChatMessages, setLiquidChatMessages] = useState<Array<{
    id: number
    text: string
    sender: "user" | "system"
    timestamp: Date
    userName?: string
  }>>([])
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false)
  const [processedReflectionIds, setProcessedReflectionIds] = useState<Set<number>>(new Set())
  const [initialReflections, setInitialReflections] = useState<Array<{
    id: number
    authorName: string
    authorAvatar?: string
    content: string
    images?: string[]
    timestamp: Date
    focusScore?: number | null
    sessionId?: number
  }>>([])
  const [currentLiveReflection, setCurrentLiveReflection] = useState<{
    reflectionId: number
    sessionId: number
    userName: string
    userProfileUrl: string | null
    content: string
    focusScore: number | null
    imageUrl: string | null
    createdAt: Date
  } | null>(null)

  // 소리 설정 로드
  useEffect(() => {
    setSoundEnabledState(isSoundEnabled())
  }, [])

  // 멤버 페이지에서 방장으로 전환된 경우, 세션 저장소에 저장된 메시지로 알림 표시
  useEffect(() => {
    if (!roomInfo?.roomId) return

    const storedRoomId = sessionStorage.getItem("hostTransferredRoomId")
    const storedMessage = sessionStorage.getItem("hostTransferredMessage")

    if (storedRoomId && storedMessage && String(roomInfo.roomId) === storedRoomId) {
      setHostTransferredMessage(storedMessage)
      setIsHostTransferredDialogOpen(true)

      // 한 번만 표시되도록 제거
      sessionStorage.removeItem("hostTransferredRoomId")
      sessionStorage.removeItem("hostTransferredMessage")
    }
  }, [roomInfo?.roomId])

  // 방장 권한 위임 WebSocket 알림 처리
  useEffect(() => {
    if (!hostTransferredEvent || !currentUser) return

    // participants 목록에서 HOST 역할 업데이트
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.userId === hostTransferredEvent.previousHostId) {
          return { ...p, role: RoomMemberRole.MEMBER }
        }
        if (p.userId === hostTransferredEvent.newHostId) {
          return { ...p, role: RoomMemberRole.HOST }
        }
        return p
      })
    )

    // 현재 사용자가 새 방장이 된 경우는 멤버 페이지에서 처리하므로 여기서는 패스
    if (currentUser.id === hostTransferredEvent.newHostId) {
      return
    }

    // 그 외 사용자(이전 방장 포함)는 알림만 표시
    if (currentUser.id === hostTransferredEvent.previousHostId) {
      setHostTransferredMessage(`${hostTransferredEvent.newHostNickname}님에게 방장 권한이 위임되었습니다.`)
    } else {
      setHostTransferredMessage(
        `${hostTransferredEvent.previousHostNickname}님에서 ${hostTransferredEvent.newHostNickname}님으로 방장이 변경되었어요.`
      )
    }

    setIsHostTransferredDialogOpen(true)
  }, [hostTransferredEvent, currentUser])

  // 현재 사용자 정보 로드
  useEffect(() => {
    ;(async () => {
      try {
        const me = await getCurrentUser()
        setCurrentUser({ id: me.id, nickname: me.nickname })
      } catch (error) {
        console.error("현재 사용자 정보 로드 실패:", error)
      }
    })()
  }, [])

  // 방 입장 시 이전 메시지 조회
  useEffect(() => {
    const loadInitialMessages = async () => {
      if (!roomInfo?.roomId || !currentUser) return

      setIsLoadingMessages(true)
      try {
        const response = await getMessages(roomInfo.roomId)
        // 백엔드 응답이 최신 메시지부터 오므로 뒤집어서 오래된 메시지부터 저장
        const initialMessages = [...response.content].reverse().map((msg) => ({
          id: msg.messageId,
          text: msg.content,
          sender: "user" as const,
          timestamp: parseMessageTimestamp(msg),
          userName: msg.senderNickname || msg.senderName || "사용자",
          userProfileUrl: msg.senderProfileUrl || null,
        }))

        // 오래된 메시지부터 저장 (시간순 정렬)
        setLiquidChatMessages(initialMessages)
        setHasMoreMessages(!response.last)
        setIsInitialLoadComplete(true)
      } catch (error) {
        console.error("이전 메시지 조회 실패:", error)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    loadInitialMessages()
  }, [roomInfo?.roomId, currentUser])

  // WebSocket으로 받은 채팅 메시지를 LiquidChat 형식으로 변환하고 기존 메시지와 병합
  useEffect(() => {
    if (!currentUser) return

    setLiquidChatMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id))
      const newMessages = chatMessages
        .filter((msg) => !existingIds.has(msg.messageId))
        .map((msg) => ({
          id: msg.messageId,
          text: msg.content,
          sender: "user" as const,
          timestamp: parseMessageTimestamp(msg),
          userName: msg.senderNickname || msg.senderName || "사용자",
          userProfileUrl: msg.senderProfileUrl || null,
        }))

      // 기존 메시지와 새 메시지를 시간순으로 정렬 (오래된 것부터)
      const allMessages = [...prev, ...newMessages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

      // 패널이 닫혀 있을 때 새 메시지가 도착하면 채팅 아이콘에 마커 표시
      if (newMessages.length > 0 && !isChatOpen) {
        setHasNewChat(true)
      }

      return allMessages
    })
  }, [chatMessages, currentUser, isChatOpen])

  // 이전 메시지 로드 (무한 스크롤)
  const handleLoadMore = async (lastMessageId: number) => {
    if (!roomInfo?.roomId || isLoadingMessages || !hasMoreMessages) return

    setIsLoadingMessages(true)
    try {
      const response = await getMessages(roomInfo.roomId, lastMessageId)
      // 백엔드 응답이 최신 메시지부터 오므로 뒤집어서 오래된 메시지부터 저장
      const olderMessages = [...response.content].reverse().map((msg) => ({
        id: msg.messageId,
        text: msg.content,
        sender: "user" as const,
        timestamp: parseMessageTimestamp(msg),
        userName: msg.senderNickname || msg.senderName || "사용자",
        userProfileUrl: msg.senderProfileUrl || null,
      }))

      setLiquidChatMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        const newMessages = olderMessages.filter((msg) => !existingIds.has(msg.id))
        // 오래된 메시지를 앞에 추가 (이미 시간순으로 정렬되어 있으므로 sort 불필요)
        // newMessages는 이미 오래된 것부터, prev도 오래된 것부터이므로 그대로 합치면 됨
        return [...newMessages, ...prev]
      })

      setHasMoreMessages(!response.last)
    } catch (error) {
      console.error("이전 메시지 로드 실패:", error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // 페이지 로드 시 스크롤을 맨 위로 이동 및 방 정보 로드
  useEffect(() => {
    window.scrollTo(0, 0)
    
    const loadRoomInfo = async () => {
      // 직전에 새로고침을 통해 나가기를 선택한 경우 세션 요약 페이지로 이동
      const navigateRoomId = sessionStorage.getItem("navigateToSessionSummaryRoomId")
      if (navigateRoomId) {
        sessionStorage.removeItem("navigateToSessionSummaryRoomId")
        isNavigatingToSummary.current = true
        const parsedRoomId = parseInt(navigateRoomId, 10)
        if (!isNaN(parsedRoomId)) {
          // 세션 요약 페이지 접근 허용용 랜덤 토큰 생성 및 저장
          const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
          sessionStorage.setItem("sessionSummaryToken", token)
          router.replace(`/session-summary?roomId=${parsedRoomId}&token=${encodeURIComponent(token)}`)
          return
        }
      }

      // URL 쿼리 파라미터에서 roomId 가져오기
      const roomIdParam = searchParams.get("roomId")
      if (roomIdParam) {
        try {
          const roomId = parseInt(roomIdParam, 10)
          if (isNaN(roomId)) {
            console.error("유효하지 않은 roomId:", roomIdParam)
            router.replace("/")
            return
          }
          
          // API로 방 정보 조회
          try {
            const roomInfo = await getStudyRoom(roomId)
            if (!roomInfo) {
              // 방 정보가 없으면 홈으로 이동
              router.replace("/")
              return
            }
            setRoomInfo(roomInfo)
          } catch (error) {
            console.error("방 정보 조회 실패:", error)
            // 방 정보를 가져오지 못하면 홈으로 이동
            router.replace("/")
          }
        } catch (error) {
          console.error("roomId 파싱 실패:", error)
          router.replace("/")
        }
      } else {
        console.warn("URL에 roomId 파라미터가 없습니다")
        router.replace("/")
      }
    }

    loadRoomInfo()

    // 방 생성 후 처음 들어왔는지 확인 (showRoomWelcome 플래그 확인)
    const showWelcome = localStorage.getItem("showRoomWelcome")
    if (showWelcome === "true") {
      setIsWelcomeDialogOpen(true)
      // 플래그 제거 (한 번만 표시)
      localStorage.removeItem("showRoomWelcome")
    }
  }, [searchParams])

  // 참여자 목록 로드
  useEffect(() => {
    const loadParticipants = async () => {
      if (!roomInfo?.roomId) return

      setIsLoadingParticipants(true)
      try {
        const response = await getStudyRoomMembers(roomInfo.roomId)
        setParticipants(response)
      } catch (error) {
        console.error("참여자 목록 로드 실패:", error)
        setParticipants([])
      } finally {
        setIsLoadingParticipants(false)
      }
    }

    loadParticipants()
  }, [roomInfo?.roomId])

  // 회고 목록 로드
  useEffect(() => {
    const loadReflections = async () => {
      if (!roomInfo?.roomId) return

      try {
        const reflections = await getRoomReflections(roomInfo.roomId)
        // ReflectionResponse를 Reflection 컴포넌트 형식으로 변환
        const convertedReflections = reflections.map((reflection: ReflectionResponse) => ({
          id: reflection.reflectionId,
          authorName: reflection.nickname,
          authorAvatar: reflection.userProfileUrl || undefined,
          content: reflection.content,
          images: reflection.imageUrl ? [reflection.imageUrl] : [],
          timestamp: new Date(reflection.createdAt),
          focusScore: reflection.focusScore,
          sessionId: reflection.sessionId,
        }))
        // 최신 순으로 정렬
        convertedReflections.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        setInitialReflections(convertedReflections)
        
        // 이미 로드된 회고 ID들을 processedReflectionIds에 추가 (웹소켓 중복 방지)
        setProcessedReflectionIds((prev) => {
          const next = new Set(prev)
          convertedReflections.forEach((reflection) => {
            next.add(reflection.id)
          })
          return next
        })
      } catch (error) {
        console.error("회고 목록 로드 실패:", error)
        setInitialReflections([])
      }
    }

    loadReflections()
  }, [roomInfo?.roomId])

  // WebSocket으로 받은 방 상태 업데이트
  useEffect(() => {
    if (!roomStatus) return

    // 함수형 업데이트를 사용하여 최신 roomInfo 상태를 참조하고 무한 루프 방지
    setRoomInfo(prev => {
      if (!prev) return null
      // 상태가 실제로 변경되었을 때만 업데이트
      if (prev.status !== roomStatus) {
        return { ...prev, status: roomStatus }
      }
      // 변경사항이 없으면 기존 객체 반환 (불필요한 리렌더링 방지)
      return prev
    })
  }, [roomStatus]) // roomInfo는 의존성 배열에서 제외 (무한 루프 방지)

  // WebSocket으로 받은 집중 시간 변경 업데이트
  useEffect(() => {
    if (focusTime === null || focusTime === undefined) return

    // 함수형 업데이트를 사용하여 최신 roomInfo 상태를 참조하고 무한 루프 방지
    setRoomInfo(prev => {
      if (!prev) return null
      // 집중 시간이 실제로 변경되었을 때만 업데이트
      if (prev.focusMinutes !== focusTime) {
        return { ...prev, focusMinutes: focusTime }
      }
      // 변경사항이 없으면 기존 객체 반환 (불필요한 리렌더링 방지)
      return prev
    })
  }, [focusTime]) // roomInfo는 의존성 배열에서 제외 (무한 루프 방지)

  // WebSocket으로 받은 방 상태 응답 업데이트 (status와 focusMinutes를 함께 받음)
  useEffect(() => {
    if (!roomState) return

    // 함수형 업데이트를 사용하여 최신 roomInfo 상태를 참조하고 무한 루프 방지
    setRoomInfo(prev => {
      if (!prev) return null
      // 집중 시간이 실제로 변경되었을 때만 업데이트
      // 상태(status)는 /status 토픽과 finishSession 이벤트에서만 관리하여
      // 타이머 상태 변경과의 충돌을 방지
      if (prev.focusMinutes !== roomState.focusMinutes) {
        return { ...prev, focusMinutes: roomState.focusMinutes }
      }
      // 변경사항이 없으면 기존 객체 반환 (불필요한 리렌더링 방지)
      return prev
    })
  }, [roomState]) // roomInfo는 의존성 배열에서 제외 (무한 루프 방지)

  // WebSocket으로 받은 세션 종료 업데이트
  useEffect(() => {
    if (!finishSession) return

    // 함수형 업데이트를 사용하여 최신 roomInfo 상태를 참조하고 무한 루프 방지
    setRoomInfo(prev => {
      if (!prev) return null
      // 상태가 실제로 변경되었을 때만 업데이트
      if (prev.status !== finishSession) {
        return { ...prev, status: finishSession }
      }
      // 변경사항이 없으면 기존 객체 반환 (불필요한 리렌더링 방지)
      return prev
    })
  }, [finishSession]) // roomInfo는 의존성 배열에서 제외 (무한 루프 방지)

  // 방 상태가 FINISHED로 변경되면 세션 종료 다이얼로그 표시
  useEffect(() => {
    if (roomInfo?.status === 'FINISHED' && !hasShownFinishedDialog.current) {
      setIsSessionFinishedDialogOpen(true)
      hasShownFinishedDialog.current = true
    }
  }, [roomInfo?.status])

  // WebSocket으로 받은 새 참여자 정보를 참여자 목록에 추가
  useEffect(() => {
    if (!newMember) return

    // 함수형 업데이트를 사용하여 최신 participants 상태를 참조
    setParticipants(prev => {
      // 이미 참여자 목록에 있는지 확인
      const existingMember = prev.find(p => p.userId === newMember.userId)
      if (existingMember) {
        // 이미 있으면 업데이트 (변경사항이 있을 때만)
        if (
          existingMember.nickname !== newMember.nickname ||
          existingMember.profileUrl !== newMember.profileUrl
        ) {
          return prev.map(p =>
            p.userId === newMember.userId
              ? { ...p, nickname: newMember.nickname, profileUrl: newMember.profileUrl }
              : p
          )
        }
        // 변경사항이 없으면 기존 배열 반환
        return prev
      } else {
        // 없으면 추가 (role은 MEMBER로 설정, 나중에 API로 다시 조회하면 정확한 role을 받을 수 있음)
        const next = [
          ...prev,
          {
            userId: newMember.userId,
            nickname: newMember.nickname,
            profileUrl: newMember.profileUrl,
            role: RoomMemberRole.MEMBER,
          }
        ]

        // 패널이 닫혀 있을 때 새 참여자가 들어오면 참여자 아이콘에 마커 표시
        if (!isParticipantsOpen) {
          setHasNewParticipantsEvent(true)
        }

        return next
      }
    })
  }, [newMember, isParticipantsOpen])

  // WebSocket으로 받은 참여자 퇴장 메시지를 처리하여 참여자 목록에서 제거
  useEffect(() => {
    if (!exitedMemberId) return

    // 함수형 업데이트를 사용하여 최신 participants 상태를 참조
    setParticipants(prev => {
      // 해당 userId를 가진 참여자를 제거
      const next = prev.filter(p => p.userId !== exitedMemberId)

      // 퇴장 이벤트도 마커로 알려줌 (패널이 닫혀 있을 때만)
      if (!isParticipantsOpen) {
        setHasNewParticipantsEvent(true)
      }

      return next
    })

    // 처리 후 상태 초기화 (다음 퇴장 메시지를 위해)
    clearExitedMemberId()
  }, [exitedMemberId, isParticipantsOpen, clearExitedMemberId])

  // 브라우저 뒤로가기 시 나가기 다이얼로그 표시 (페이지 이동 방지)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isNavigatingToSummary.current) {
        return
      }
      e.preventDefault()
      setIsExitDialogOpen(true)
      // 다시 현재 페이지 상태를 push 해서 실제 뒤로가기를 막음
      window.history.pushState(null, '', window.location.href)
    }

    // 현재 페이지 상태를 한 번 push 해서 뒤로가기가 popstate를 트리거하도록 함
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  // 회고 생성 이벤트 수신 시 회고 다이얼로그 열기
  useEffect(() => {
    if (!reflectionEvent) return
    setCurrentReflectionSessionId(reflectionEvent.sessionId)
    setIsReflectionDialogOpen(true)
  }, [reflectionEvent])

  // reflectionData 배열을 순차적으로 처리
  useEffect(() => {
    if (reflectionData.length === 0) {
      setCurrentLiveReflection(null)
      return
    }

    // 처리되지 않은 첫 번째 항목 찾기
    const unprocessedData = reflectionData.find(
      (data) => !processedReflectionIds.has(data.reflectionId)
    )

    if (unprocessedData) {
      setCurrentLiveReflection({
        reflectionId: unprocessedData.reflectionId,
        sessionId: unprocessedData.sessionId,
        userName: unprocessedData.nickname,
        userProfileUrl: unprocessedData.userProfileUrl,
        content: unprocessedData.content,
        focusScore: unprocessedData.focusScore,
        imageUrl: unprocessedData.imageUrl,
        createdAt: new Date(unprocessedData.createdAt),
      })
    } else {
      setCurrentLiveReflection(null)
    }
  }, [reflectionData, processedReflectionIds])

  const handleReflectionSubmit = (content: string, images: string[], rating: number | null) => {
    if (!roomInfo || !currentUser) return

    // reflectionEvent에서 받은 sessionId를 우선 사용, 없으면 roomInfo.currentSession 사용
    const sessionId = currentReflectionSessionId ?? roomInfo.currentSession

    const mainImageUrl = images[0] || null

    sendReflection({
      userId: currentUser.id,
      sessionId,
      content,
      focusScore: rating,
      imageUrl: mainImageUrl,
    })

    // 제출 후 sessionId 초기화
    setCurrentReflectionSessionId(null)
  }


  return (
    <div
      className="min-h-screen flex items-stretch justify-center p-6 md:p-10"
      style={{
        backgroundColor: "#fff8ea",
      }}
    >
      <div className="relative z-10 flex w-full max-w-2xl flex-col">
        {/* 방 정보 영역 - 제목과 방 정보 통합 */}
        <section className="mb-4 md:mb-6 rounded-3xl bg-gradient-to-br from-white/70 via-white/45 to-white/25 backdrop-blur-2xl border-2 border-[#2c5f2d] shadow-[0_16px_40px_rgba(0,0,0,0.12)] px-6 py-4 md:px-8 md:py-5 flex flex-col gap-4 relative">
          {/* 방 제목 영역 */}
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1 flex-1">
              <h1 className="text-base md:text-lg font-semibold text-black">
                {roomInfo?.title || ""}
              </h1>
            </div>
          </div>

          {/* 방 상태 및 세션 정보 영역 */}
          {roomInfo && (
            <>
              {/* 구분선 */}
              <div className="h-px bg-black/10" />
              
              <div className="flex items-center gap-3 flex-wrap">
                {/* 방 상태 */}
                <span
                  className="px-2.5 py-1 rounded-md text-[10px] md:text-xs font-medium text-white"
                  style={{
                    backgroundColor: getStatusColor(roomInfo.status),
                  }}
                >
                  {getStatusText(roomInfo.status)}
                </span>
                
                {/* 집중/휴식 시간 */}
                {roomInfo.status !== "WAITING" && (
                  <span className="px-2.5 py-1 rounded-md text-[10px] md:text-xs font-medium bg-black/5 text-black/70">
                    {roomInfo.focusMinutes}분 집중 → {roomInfo.breakMinutes}분 휴식
                  </span>
                )}

                {/* 우측: 소리 on/off 토글만 유지 */}
                <div className="flex items-center gap-2 ml-auto px-3 py-1.5 rounded-lg bg-white/60 border border-black/10">
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-black/70" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-black/50" />
                  )}
                  <Switch
                    id="sound-toggle"
                    checked={soundEnabled}
                    onCheckedChange={(checked) => {
                      setSoundEnabledState(checked)
                      setSoundEnabled(checked)
                    }}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}
        </section>
        
        {/* 플로팅 패널: 채팅 / 참여자 목록 (하단 탭 너비 기준 오른쪽 하단) */}
        {roomInfo && (
          <>
            {/* 배경 오버레이 - 외부 클릭 시 패널 닫기 */}
            {(isChatOpen || isParticipantsOpen) && (
              <div
                className="fixed inset-0 z-30 bg-black/0"
                onClick={() => {
                  setIsChatOpen(false)
                  setIsParticipantsOpen(false)
                }}
              />
            )}
            <div className="pointer-events-none fixed inset-x-0 bottom-20 md:bottom-24 z-40 flex justify-center">
              <div className="w-full max-w-2xl px-4 flex flex-col items-end gap-3">
              {/* 채팅 패널 */}
              <div
                className={`transition-all duration-300 overflow-hidden w-full flex justify-end ${
                  isChatOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div
                  className="pointer-events-auto rounded-3xl bg-[#fff8ea] backdrop-blur-3xl border-2 border-[#2c5f2d] overflow-hidden min-h-[420px] max-h-[calc(100vh-140px)] flex flex-col w-full max-w-xs md:max-w-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                <div className="flex-1 min-h-0 overflow-hidden">
                  <LiquidChat
                    messages={liquidChatMessages}
                    currentUserName={currentUser?.nickname || participants[0]?.nickname || "사용자"}
                    onSend={(message: string) => {
                      if (currentUser?.id) {
                        sendChatMessage(message, currentUser.id)
                      }
                    }}
                    onLoadMore={handleLoadMore}
                    hasMore={hasMoreMessages}
                    isLoadingMore={isLoadingMessages}
                    isInitialLoadComplete={isInitialLoadComplete}
                  />
                </div>
              </div>
            </div>

            {/* 참여자 패널 */}
            <div
              className={`transition-all duration-300 overflow-hidden w-full flex justify-end ${
                isParticipantsOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div 
                className="pointer-events-auto rounded-3xl bg-[#fff8ea] backdrop-blur-3xl border-2 border-[#2c5f2d] overflow-hidden h-[340px] w-full max-w-xs md:max-w-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <ParticipantsList 
                  participants={participants} 
                  isLoading={isLoadingParticipants}
                  isHost={true}
                  onTransferHost={(userId) => {
                    const targetParticipant = participants.find(p => p.userId === userId)
                    if (targetParticipant) {
                      setTransferTargetUserId(userId)
                      setTransferTargetNickname(targetParticipant.nickname)
                      setIsTransferHostDialogOpen(true)
                    }
                  }}
                />
              </div>
            </div>
            </div>
          </div>
          </>
        )}

        {/* 메인 콘텐츠 */}
        <main className="relative flex flex-col gap-4 md:gap-6 pb-16">
          {/* 타이머 + 목표 탭 */}
          {activeTab === "timer" && (
            <>
              {/* 타이머 카드 */}
              <div className="rounded-3xl bg-gradient-to-br from-white/70 via-white/45 to-white/25 backdrop-blur-3xl border-2 border-[#2c5f2d] shadow-[0_24px_80px_rgba(0,0,0,0.16)] px-6 py-6 md:px-8 md:py-6 flex flex-col items-center justify-center gap-4 overflow-hidden w-full min-h-[500px] md:min-h-[540px]">
                {/* 타이머 영역 - 포모도로/플립 공통 높이 */}
                <div className="w-full h-[480px] flex items-center justify-center">
                  {roomInfo?.timerType === TimerType.FLIP ? (
                    <div className="w-full max-w-full h-full flex items-center justify-center">
                      <FlipTimer
                        disabled={false}
                        defaultMinutes={roomInfo?.focusMinutes || 25}
                        currentSession={1}
                        totalSessions={roomInfo?.totalSessions || 4}
                        externalTimerState={timerState}
                        roomStatus={roomInfo?.status}
                        isPermanent={roomInfo?.isPermanent || false}
                        onDragStart={() => sendDialDrag("DIAL_DRAG_START", 0)}
                        onDragMove={(minutes) => sendDialDrag("DIAL_DRAG_MOVE", minutes)}
                        onDragEnd={(minutes) => sendDialDrag("DIAL_DRAG_END", minutes)}
                        onStart={(minutes) => {
                          if (roomInfo) {
                            sendTimerStart({
                              focusMinutes: minutes,
                              breakMinutes: roomInfo.breakMinutes,
                              totalSessions: roomInfo.totalSessions,
                            })
                          }
                        }}
                        onPause={() => {
                          sendTimerPause()
                        }}
                        onResume={() => {
                          sendTimerResume()
                        }}
                        onNextFocusMinutesSet={(minutes) => {
                          sendNextFocusMinutes(minutes)
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full max-w-full h-full flex items-center justify-center">
                      <PomodoroTimer
                        disabled={false}
                        defaultMinutes={roomInfo?.focusMinutes || 25}
                        currentSession={1}
                        totalSessions={roomInfo?.totalSessions || 4}
                        externalTimerState={timerState}
                        roomStatus={roomInfo?.status}
                        isPermanent={roomInfo?.isPermanent || false}
                        onDragStart={() => sendDialDrag("DIAL_DRAG_START", 0)}
                        onDragMove={(minutes) => sendDialDrag("DIAL_DRAG_MOVE", minutes)}
                        onDragEnd={(minutes) => sendDialDrag("DIAL_DRAG_END", minutes)}
                        onStart={(minutes) => {
                          if (roomInfo) {
                            sendTimerStart({
                              focusMinutes: minutes,
                              breakMinutes: roomInfo.breakMinutes,
                              totalSessions: roomInfo.totalSessions,
                            })
                          }
                        }}
                        onPause={() => {
                          sendTimerPause()
                        }}
                        onResume={() => {
                          sendTimerResume()
                        }}
                        onNextFocusMinutesSet={(minutes) => {
                          sendNextFocusMinutes(minutes)
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 목표 카드 - 타이머 종류와 관계없이 동일 위치/높이 */}
              {roomInfo && (
                <div className="w-full h-[320px] md:h-[360px]">
                  <GoalsList roomId={roomInfo.roomId} roomStatus={roomInfo.status} />
                </div>
              )}
            </>
          )}

          {/* 회고 탭 */}
          {activeTab === "reflection" && (
            <div className="w-full h-[calc(100vh-280px)] min-h-[500px]">
              <Reflection
                initialReflections={initialReflections}
                liveReflection={currentLiveReflection}
                onReflectionProcessed={() => {
                  if (currentLiveReflection) {
                    // 처리 완료된 ID 기록
                    setProcessedReflectionIds((prev) => {
                      const next = new Set(prev)
                      next.add(currentLiveReflection.reflectionId)
                      return next
                    })
                    // 처리된 데이터 제거
                    removeReflectionData(currentLiveReflection.reflectionId)
                  }
                }}
              />
            </div>
          )}

        </main>
      </div>

      {/* 하단 탭 바 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center">
        <div className="relative w-full max-w-2xl">
          <div className="rounded-3xl bg-gradient-to-br from-white/70 via-white/45 to-white/25 backdrop-blur-3xl border border-white/60 shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-around px-2 py-2">
              {/* 타이머 탭 */}
              <button
                type="button"
                onClick={() => setActiveTab("timer")}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === "timer"
                    ? "text-primary bg-primary/10"
                    : "text-black/60 hover:text-black/80"
                }`}
              >
                <Clock className="h-5 w-5" />
                <span className="text-[10px] font-medium">타이머</span>
              </button>

              {/* 나가기 - 중앙 플로팅 버튼 */}
              <button
                type="button"
                onClick={() => setIsExitDialogOpen(true)}
                className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-primary/40 border border-white/70 hover:bg-primary/90 transition-colors -mt-6 cursor-pointer"
                aria-label="방 나가기"
              >
                <DoorClosed className="h-6 w-6" />
              </button>

              {/* 회고 탭 */}
              <button
                type="button"
                onClick={() => setActiveTab("reflection")}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === "reflection"
                    ? "text-primary bg-primary/10"
                    : "text-black/60 hover:text-black/80"
                }`}
              >
                <BookOpen className="h-5 w-5" />
                <span className="text-[10px] font-medium">회고</span>
              </button>
            </div>
          </div>
          
          {/* 플로팅 메뉴 버튼 - 오른쪽 하단 (하단 탭 바 위) */}
          <div className="absolute -top-16 right-4">
            {/* 플로팅 메뉴 토글 버튼 - 항상 고정 위치 */}
            <button
              type="button"
              onClick={() => setIsFloatingMenuOpen((prev) => !prev)}
              className={`relative flex items-center justify-center w-12 h-12 rounded-full bg-[#f59e0b] text-white shadow-lg shadow-[#f59e0b]/40 border-2 border-white/70 hover:bg-[#f59e0b]/90 transition-all z-10 cursor-pointer ${
                isFloatingMenuOpen ? 'rotate-90' : ''
              }`}
              aria-label="메뉴"
            >
              {isFloatingMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <MoreVertical className="h-5 w-5" />
              )}
              {/* 채팅이나 참여자 목록에 새 데이터가 있을 때 알림 표시 */}
              {(hasNewChat || hasNewParticipantsEvent) && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 shadow-sm border-2 border-white" />
              )}
            </button>
            
            {/* 채팅/참여자 버튼들 - 플로팅 메뉴가 열려있을 때만 표시 (플로팅 버튼 위에 배치) */}
            {isFloatingMenuOpen && (
              <div className="absolute bottom-0 right-0 flex flex-col items-end gap-2 mb-14">
                <button
                  type="button"
                  onClick={() => {
                    setIsChatOpen((prev) => !prev)
                    setIsParticipantsOpen(false)
                    if (!isChatOpen) {
                      setHasNewChat(false)
                    }
                    setIsFloatingMenuOpen(false)
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/90 backdrop-blur-sm border-2 border-[#2c5f2d] shadow-lg hover:bg-white transition-all whitespace-nowrap cursor-pointer"
                >
                  <div className="relative flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-[#2c5f2d] flex-shrink-0" />
                    <span className="text-xs font-medium text-[#2c5f2d] whitespace-nowrap">채팅</span>
                    {hasNewChat && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 shadow-sm" />
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsParticipantsOpen((prev) => !prev)
                    setIsChatOpen(false)
                    if (!isParticipantsOpen) {
                      setHasNewParticipantsEvent(false)
                    }
                    setIsFloatingMenuOpen(false)
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/90 backdrop-blur-sm border-2 border-[#2c5f2d] shadow-lg hover:bg-white transition-all whitespace-nowrap cursor-pointer"
                >
                  <div className="relative flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#2c5f2d] flex-shrink-0" />
                    <span className="text-xs font-medium text-[#2c5f2d] whitespace-nowrap">참여자</span>
                    {hasNewParticipantsEvent && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 shadow-sm" />
                    )}
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 방 생성 후 환영 다이얼로그 */}
      <Dialog open={isWelcomeDialogOpen} onOpenChange={setIsWelcomeDialogOpen}>
        <DialogContent className="max-w-sm p-6" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4">
            <img
              src="/images/home_icon.png"
              alt="환영 아이콘"
              className="w-20 h-20 object-contain"
            />
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-base font-semibold">
                방이 생성되었습니다!
              </DialogTitle>
              <DialogDescription className="text-xs text-black/70 mt-1 text-center">
                {roomInfo?.timerType === TimerType.FLIP
                  ? "플립 타이머 시간을 조절하여 집중 시간을 설정해보세요!"
                  : "포모도로 타이머 시간을 조절하여 집중 시간을 설정해보세요!"}
                <br />
                이후 시작 버튼을 통해 세션을 시작할 수 있습니다 :)
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="w-full flex justify-center mt-2">
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => {
                  setIsWelcomeDialogOpen(false)
                }}
              >
                네 알겠어요!
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 나가기 확인 다이얼로그 */}
      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent className="max-w-sm p-6" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4">
            <img
              src="/images/home_icon.png"
              alt="나가기 확인 아이콘"
              className="w-20 h-20 object-contain"
            />
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-base font-semibold">
                정말 나가시겠어요?
              </DialogTitle>
              <DialogDescription className="text-xs text-black/70 mt-1 text-center">
                {roomInfo?.status === "FOCUS"
                  ? "집중 시간 중간에 나가면 이번 세션의 공부 시간은 저장되지 않을 수 있어요."
                  : "방을 나가면 세션 요약 페이지로\n이동하게 됩니다."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="w-full flex justify-center gap-2 mt-2">
              <Button
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800"
                onClick={() => {
                  setIsExitDialogOpen(false)
                  if (window.location.pathname !== pathname) {
                    window.history.pushState(null, '', pathname)
                    router.replace(pathname)
                  }
                }}
              >
                취소
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={async () => {
                  setIsExitDialogOpen(false)
                  
                  // 현재 사용자 정보 가져오기
                  if (currentUser && roomInfo?.roomId) {
                    // 웹소켓으로 방 떠나기 요청 전송
                    sendMemberExit(currentUser.id)
                    // 요청 전송 후 약간의 지연을 두고 페이지 이동
                    await new Promise(resolve => setTimeout(resolve, 100))
                  }
                  
                  isNavigatingToSummary.current = true
                  // 세션 요약 페이지로 이동 시 roomId를 쿼리로 전달하여 목표/회고 API가 방 기준으로 호출되도록 함
                  if (roomInfo?.roomId) {
                    // 세션 요약 페이지 접근 허용용 랜덤 토큰 생성 및 저장
                    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
                    sessionStorage.setItem("sessionSummaryToken", token)
                    router.push(`/session-summary?roomId=${roomInfo.roomId}&token=${encodeURIComponent(token)}`)
                  } else {
                    router.push("/session-summary")
                  }

                }}
              >
                나가기
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 회고 작성 다이얼로그 */}
      <ReflectionDialog
        open={isReflectionDialogOpen}
        onOpenChange={setIsReflectionDialogOpen}
        onSubmit={handleReflectionSubmit}
        sessionNumber={roomInfo?.isPermanent ? undefined : (currentReflectionSessionId ?? roomInfo?.currentSession)}
      />

      {/* 방장 변경 알림 다이얼로그 */}
      <Dialog open={isHostTransferredDialogOpen} onOpenChange={setIsHostTransferredDialogOpen}>
        <DialogContent className="max-w-sm p-6" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4">
            <img
              src="/images/home_icon.png"
              alt="방장 변경 알림 아이콘"
              className="w-20 h-20 object-contain"
            />
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-base font-semibold">
                방장이 변경되었어요
              </DialogTitle>
              <DialogDescription className="text-xs text-black/70 mt-1 text-center">
                {hostTransferredMessage}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="w-full flex justify-center mt-2">
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => setIsHostTransferredDialogOpen(false)}
              >
                확인
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 방장 권한 위임 다이얼로그 */}
      <Dialog open={isTransferHostDialogOpen} onOpenChange={setIsTransferHostDialogOpen}>
        <DialogContent className="max-w-sm p-6" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4">
            <img
              src="/images/home_icon.png"
              alt="방장 권한 위임 아이콘"
              className="w-20 h-20 object-contain"
            />
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-base font-semibold">
                방장 권한을 위임하시겠어요?
              </DialogTitle>
              <DialogDescription className="text-xs text-black/70 mt-1 text-center">
                {transferTargetNickname}님에게 방장 권한을 위임하면
                <br />
                더 이상 방을 관리할 수 없어요.
                <br />
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="w-full flex justify-center gap-2 mt-2">
              <Button
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800"
                onClick={() => {
                  setIsTransferHostDialogOpen(false)
                  setTransferTargetUserId(null)
                  setTransferTargetNickname("")
                }}
              >
                취소
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={async () => {
                  if (!roomInfo?.roomId || !transferTargetUserId) {
                    setIsTransferHostDialogOpen(false)
                    setTransferTargetUserId(null)
                    setTransferTargetNickname("")
                    return
                  }

                  try {
                    await transferHost(roomInfo.roomId, transferTargetUserId)

                    // 성공 시 다이얼로그 닫기 및 상태 초기화
                    setIsTransferHostDialogOpen(false)
                    setTransferTargetUserId(null)
                    setTransferTargetNickname("")
                    // 이전 방장은 멤버 화면으로 전환 (방을 완전히 나가는 것이 아님)
                    // beforeunload/pagehide 핸들러에서 exit 전송을 막기 위해 플래그 설정
                    isNavigatingToSummary.current = true
                    router.replace(`/room/member?roomId=${roomInfo.roomId}`)
                  } catch (error) {
                    console.error("방장 권한 위임 실패:", error)
                  }
                }}
              >
                위임하기
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 세션 종료 다이얼로그 */}
      <Dialog open={isSessionFinishedDialogOpen} onOpenChange={setIsSessionFinishedDialogOpen}>
        <DialogContent className="max-w-sm p-6" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4">
            <img
              src="/images/home_icon.png"
              alt="세션 종료 아이콘"
              className="w-20 h-20 object-contain"
            />
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-base font-semibold">
                모든 세션이 종료되었습니다!
              </DialogTitle>
              <DialogDescription className="text-xs text-black/70 mt-1 text-center">
                나가기 버튼을 눌러서 퇴장해야
                <br />
                공부 기록이 저장됩니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="w-full flex justify-center mt-2">
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => {
                  setIsSessionFinishedDialogOpen(false)
                }}
              >
                네 알겠어요!
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function HostRoomPage() {
  return (
    <Suspense fallback={null}>
      <HostRoomPageInner />
    </Suspense>
  )
}