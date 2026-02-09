"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef, Suspense, useMemo } from "react"
import { DoorClosed } from "lucide-react"
import PomodoroTimer from "@/components/pomodoro-timer"
import FlipTimer from "@/components/flip-timer"
import { TimerType, getPlansByDateRange, getPlansByDate, PlanResponse, EventColor } from "@/lib/api"
import LiquidChat from "@/components/liquid-chat"
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
import { getStudyRoomMembers, StudyRoomMemberResponse, getStudyRoom, getMessages, RoomMemberRole, getRoomReflections, ReflectionResponse, getCurrentUser } from "@/lib/api"
import { getStatusText, getStatusColor } from "@/lib/utils"
import { ParticipantsList } from "@/components/ui/participants-list"
import { parseMessageTimestamp } from "@/lib/utils"
import { useStudyRoomWebSocket } from "@/hooks/use-study-room-websocket"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound-notification"
import { Volume2, VolumeX, MessageSquare, Clock, BookOpen, Users, X, Plus, ChevronLeft, ChevronRight, Trash2, CheckCircle2 } from "lucide-react"
import { format, addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns"
import { CustomScrollbar } from "@/components/ui/custom-scrollbar"
import { useIsMobile } from "@/hooks/use-mobile"
import { Input } from "@/components/ui/input"
import { createPlan, updatePlan, deletePlan } from "@/lib/api"
import { showSuccessNotification } from "@/lib/system-notification"

// 초를 00:00 형식으로 변환하는 함수
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

function MemberRoomPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isReflectionDialogOpen, setIsReflectionDialogOpen] = useState(false)
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [isSessionFinishedDialogOpen, setIsSessionFinishedDialogOpen] = useState(false)
  const [currentReflectionSessionId, setCurrentReflectionSessionId] = useState<number | null>(null)
  const isNavigatingToSummary = useRef(false)
  const hasShownFinishedDialog = useRef(false)
  const [roomInfo, setRoomInfo] = useState<{
    roomId: string
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
  const { statusMessage, timerState, dialMinutes, sendChatMessage, chatMessages, newMember, exitedMemberId, clearExitedMemberId, sendEnterRoom, sendMemberExit, sendReflection, roomStatus, focusTime, roomState, finishSession, reflectionEvent, reflectionData, removeReflectionData, hostTransferredEvent } = useStudyRoomWebSocket(roomInfo?.roomId || null)
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
  const [isHostTransferredDialogOpen, setIsHostTransferredDialogOpen] = useState(false)
  const [hostTransferredMessage, setHostTransferredMessage] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"timer" | "reflection">("timer")
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false)
  const [hasNewChat, setHasNewChat] = useState(false)
  const [hasNewParticipantsEvent, setHasNewParticipantsEvent] = useState(false)
  const isMobile = useIsMobile()
  
  // 주간 뷰 관련 state
  interface Event {
    id?: number
    title: string
    startTime: string
    endTime: string
    day: number
    date: Date
    color: string
    completed: boolean
    completedAt: Date | null
  }
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  
  // 일정 추가 관련 state
  const [isAddEventDialogOpen, setIsAddEventDialogOpen] = useState(false)
  const [isEditEventDialogOpen, setIsEditEventDialogOpen] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState("")
  const [newEventStartTime, setNewEventStartTime] = useState("09:00")
  const [newEventEndTime, setNewEventEndTime] = useState("10:00")
  const [newEventColor, setNewEventColor] = useState("bg-red-500")
  const [newEventDate, setNewEventDate] = useState(new Date())
  const [dialogDisplayMonth, setDialogDisplayMonth] = useState(new Date())
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [isCreatingPlan, setIsCreatingPlan] = useState(false)
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false)
  const [startTimePickerOpen, setStartTimePickerOpen] = useState(false)
  const [endTimePickerOpen, setEndTimePickerOpen] = useState(false)
  const startTimePickerRef = useRef<HTMLDivElement>(null)
  const endTimePickerRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const weekViewScrollRef = useRef<HTMLDivElement>(null)
  
  // 수정용 state
  const [editEventTitle, setEditEventTitle] = useState("")
  const [editEventStartTime, setEditEventStartTime] = useState("09:00")
  const [editEventEndTime, setEditEventEndTime] = useState("10:00")
  const [editEventColor, setEditEventColor] = useState("bg-red-500")
  const [editEventDate, setEditEventDate] = useState(new Date())
  const [editEventId, setEditEventId] = useState<number | undefined>(undefined)

  // 소리 설정 로드
  useEffect(() => {
    setSoundEnabledState(isSoundEnabled())
  }, [])

  // 항상 오늘 날짜 기준으로 표시할 날짜들 계산
  const visibleDays = useMemo(() => {
    const today = new Date()
    const days: Date[] = []
    
    if (isMobile) {
      // 모바일: 오늘만
      days.push(today)
    } else {
      // 데스크톱: 어제, 오늘, 내일
      days.push(subDays(today, 1)) // 어제
      days.push(today) // 오늘
      days.push(addDays(today, 1)) // 내일
    }
    return days
  }, [isMobile])

  // 백엔드 EventColor를 프론트엔드 색상 클래스명으로 변환
  const mapEventColorToColor = (eventColor: EventColor): string => {
    const colorMap: Record<EventColor, string> = {
      [EventColor.RED]: "bg-red-500",
      [EventColor.ORANGE]: "bg-orange-500",
      [EventColor.YELLOW]: "bg-yellow-500",
      [EventColor.GREEN]: "bg-green-500",
      [EventColor.BLUE]: "bg-blue-500",
      [EventColor.INDIGO]: "bg-indigo-500",
      [EventColor.PURPLE]: "bg-purple-500",
      [EventColor.PINK]: "bg-pink-500",
    }
    return colorMap[eventColor] || "bg-red-500"
  }

  // PlanResponse를 Event 형식으로 변환
  const convertPlanToEvent = (plan: PlanResponse, visibleDays: Date[]): Event => {
    const planDate = new Date(plan.planDate)
    const dayIndex = visibleDays.findIndex(day => 
      format(day, "yyyy-MM-dd") === format(planDate, "yyyy-MM-dd")
    )

    return {
      id: plan.id,
      title: plan.title,
      startTime: plan.startTime,
      endTime: plan.endTime,
      day: dayIndex >= 0 ? dayIndex + 1 : 1,
      date: planDate,
      color: mapEventColorToColor(plan.color),
      completed: plan.completed,
      completedAt: plan.completed ? new Date(plan.updatedAt) : null,
    }
  }

  // visibleDays가 변경될 때마다 계획 조회
  useEffect(() => {
    const fetchPlans = async () => {
      if (visibleDays.length === 0) return

      try {
        let plans: PlanResponse[]

        if (isMobile) {
          // 모바일: 특정 날짜의 계획만 조회
          const date = format(visibleDays[0], "yyyy-MM-dd")
          plans = await getPlansByDate(date)
        } else {
          // 데스크톱: 기간별 계획 조회
          const startDate = format(visibleDays[0], "yyyy-MM-dd")
          const endDate = format(visibleDays[visibleDays.length - 1], "yyyy-MM-dd")
          plans = await getPlansByDateRange(startDate, endDate)
        }

        // PlanResponse를 Event 형식으로 변환
        const convertedEvents = plans.map(plan => convertPlanToEvent(plan, visibleDays))

        // 이벤트 목록 업데이트
        setEvents(convertedEvents)
      } catch (error) {
        console.error("계획 조회 실패:", error)
      }
    }

    fetchPlans()
  }, [visibleDays, isMobile])

  const weekDays = useMemo(() => {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    return visibleDays.map(day => dayNames[day.getDay()])
  }, [visibleDays])

  const weekDates = useMemo(() => {
    return visibleDays.map(day => day.getDate())
  }, [visibleDays])

  const timeSlots = Array.from({ length: 24 }, (_, i) => i) // 0시부터 23시까지
  const visibleDaysCount = isMobile ? 1 : 3

  const calculateEventStyle = (startTime: string, endTime: string) => {
    const start = Number.parseInt(startTime.split(":")[0]) + Number.parseInt(startTime.split(":")[1]) / 60
    const end = Number.parseInt(endTime.split(":")[0]) + Number.parseInt(endTime.split(":")[1]) / 60
    const top = start * 80
    const height = (end - start) * 80
    return { top: `${top}px`, height: `${height}px` }
  }

  // 시간 문자열에서 초 단위 제거 (HH:mm:ss -> HH:mm)
  const formatTimeWithoutSeconds = (timeStr: string): string => {
    if (!timeStr) return timeStr
    if (timeStr.includes(":") && timeStr.split(":").length === 3) {
      return timeStr.substring(0, 5)
    }
    return timeStr
  }

  // 시간 파싱 및 설정 함수
  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number)
    return { hour: hours, minute: minutes }
  }
  
  const formatTime = (hour: number, minute: number) => {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  }
  
  const startTime = parseTime(newEventStartTime)
  const endTime = parseTime(newEventEndTime)
  
  const handleStartTimeChange = (hour: number, minute: number) => {
    setNewEventStartTime(formatTime(hour, minute))
  }
  
  const handleEndTimeChange = (hour: number, minute: number) => {
    setNewEventEndTime(formatTime(hour, minute))
  }

  // 수정용 시간 변경 핸들러
  const handleEditStartTimeChange = (hour: number, minute: number) => {
    setEditEventStartTime(formatTime(hour, minute))
  }

  const handleEditEndTimeChange = (hour: number, minute: number) => {
    setEditEventEndTime(formatTime(hour, minute))
  }

  // 수정용 시간 파싱
  const editStartTime = parseTime(editEventStartTime)
  const editEndTime = parseTime(editEventEndTime)

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event)
  }

  // 프론트엔드 색상 클래스명을 백엔드 EventColor로 변환
  const mapColorToEventColor = (colorClass: string): EventColor => {
    const colorMap: Record<string, EventColor> = {
      "bg-red-500": EventColor.RED,
      "bg-orange-500": EventColor.ORANGE,
      "bg-yellow-500": EventColor.YELLOW,
      "bg-green-500": EventColor.GREEN,
      "bg-blue-500": EventColor.BLUE,
      "bg-indigo-500": EventColor.INDIGO,
      "bg-purple-500": EventColor.PURPLE,
      "bg-pink-500": EventColor.PINK,
    }
    return colorMap[colorClass] || EventColor.RED
  }

  const handleAddEvent = async () => {
    if (!newEventTitle.trim()) {
      return
    }

    setIsCreatingPlan(true)

    try {
      const planDate = format(newEventDate, "yyyy-MM-dd")
      const requestData = {
        title: newEventTitle.trim(),
        planDate: planDate,
        startTime: newEventStartTime,
        endTime: newEventEndTime,
        color: mapColorToEventColor(newEventColor),
      }

      await createPlan(requestData)
      showSuccessNotification("학습 계획이 생성되었습니다.")
      
      // 계획 목록 다시 조회
      const startDate = format(visibleDays[0], "yyyy-MM-dd")
      const endDate = format(visibleDays[visibleDays.length - 1], "yyyy-MM-dd")
      const plans = await getPlansByDateRange(startDate, endDate)
      const convertedEvents = plans.map(plan => convertPlanToEvent(plan, visibleDays))
      setEvents(convertedEvents)
      
      // 폼 초기화 및 다이얼로그 닫기
      setNewEventTitle("")
      setNewEventStartTime("09:00")
      setNewEventEndTime("10:00")
      setNewEventColor("bg-red-500")
      const today = new Date()
      setNewEventDate(today)
      setDialogDisplayMonth(today)
      setIsAddEventDialogOpen(false)
    } catch (error) {
      console.error("계획 생성 실패:", error)
    } finally {
      setIsCreatingPlan(false)
    }
  }

  const handleEditEvent = async () => {
    if (!editEventTitle.trim() || !editEventId) {
      return
    }

    setIsUpdatingPlan(true)

    try {
      const planDate = format(editEventDate, "yyyy-MM-dd")
      const requestData = {
        title: editEventTitle.trim(),
        planDate: planDate,
        startTime: editEventStartTime,
        endTime: editEventEndTime,
        color: mapColorToEventColor(editEventColor),
      }

      await updatePlan(editEventId, requestData)
      showSuccessNotification("학습 계획이 수정되었습니다.")

      // 계획 목록 다시 조회
      const startDate = format(visibleDays[0], "yyyy-MM-dd")
      const endDate = format(visibleDays[visibleDays.length - 1], "yyyy-MM-dd")
      const plans = await getPlansByDateRange(startDate, endDate)
      const convertedEvents = plans.map(plan => convertPlanToEvent(plan, visibleDays))
      setEvents(convertedEvents)

      // 폼 초기화 및 다이얼로그 닫기
      setIsEditEventDialogOpen(false)
    } catch (error) {
      console.error("계획 수정 실패:", error)
    } finally {
      setIsUpdatingPlan(false)
    }
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !selectedEvent.id) {
      return
    }

    try {
      await deletePlan(selectedEvent.id)
      showSuccessNotification("학습 계획이 삭제되었습니다.")

      // 계획 목록 다시 조회
      const startDate = format(visibleDays[0], "yyyy-MM-dd")
      const endDate = format(visibleDays[visibleDays.length - 1], "yyyy-MM-dd")
      const plans = await getPlansByDateRange(startDate, endDate)
      const convertedEvents = plans.map(plan => convertPlanToEvent(plan, visibleDays))
      setEvents(convertedEvents)

      // 다이얼로그 닫기
      setSelectedEvent(null)
    } catch (error) {
      console.error("계획 삭제 실패:", error)
    }
  }

  // 외부 클릭 시 시간 선택기 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (startTimePickerRef.current && !startTimePickerRef.current.contains(event.target as Node)) {
        setStartTimePickerOpen(false)
      }
      if (endTimePickerRef.current && !endTimePickerRef.current.contains(event.target as Node)) {
        setEndTimePickerOpen(false)
      }
    }
    
    if (startTimePickerOpen || endTimePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [startTimePickerOpen, endTimePickerOpen])

  // 다이얼로그 내부 미니 캘린더용 날짜 계산
  const dialogMiniCalendarData = useMemo(() => {
    const monthStart = startOfMonth(dialogDisplayMonth)
    const monthEnd = endOfMonth(dialogDisplayMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    
    const today = new Date()
    const todayStr = format(today, "yyyy-MM-dd")
    const newEventDateStr = format(newEventDate, "yyyy-MM-dd")
    
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd")
      return {
        date: day,
        dayOfMonth: day.getDate(),
        isCurrentMonth: day.getMonth() === dialogDisplayMonth.getMonth(),
        isToday: dayStr === todayStr,
        isSelected: dayStr === newEventDateStr,
      }
    })
  }, [dialogDisplayMonth, newEventDate])

  const dialogCurrentMonth = useMemo(() => {
    const month = dialogDisplayMonth.getMonth() + 1
    const year = dialogDisplayMonth.getFullYear()
    return `${month}월 ${year}`
  }, [dialogDisplayMonth])

  const colorOptions = [
    { value: "bg-red-500", label: "빨간색", color: "#ef4444" },
    { value: "bg-orange-500", label: "주황색", color: "#f97316" },
    { value: "bg-yellow-500", label: "노란색", color: "#eab308" },
    { value: "bg-green-500", label: "초록색", color: "#22c55e" },
    { value: "bg-blue-500", label: "파란색", color: "#3b82f6" },
    { value: "bg-indigo-500", label: "남색", color: "#6366f1" },
    { value: "bg-purple-500", label: "보라색", color: "#a855f7" },
    { value: "bg-pink-500", label: "분홍색", color: "#ec4899" },
  ]

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

    // 현재 사용자가 새 방장이 된 경우와 아닌 경우 메시지 분기
    if (currentUser.id === hostTransferredEvent.newHostId) {
      // 새 방장은 방장 화면으로 전환하면서, 알림 메시지는 세션 저장소에 저장
      if (roomInfo?.roomId) {
        const msg = "이제 당신이 새로운 방장입니다. 세션을 관리해 주세요!"
        sessionStorage.setItem("hostTransferredRoomId", String(roomInfo.roomId))
        sessionStorage.setItem("hostTransferredMessage", msg)
        router.replace(`/room/host?roomId=${roomInfo.roomId}`)
      }
      return
    } else if (currentUser.id === hostTransferredEvent.previousHostId) {
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

      // 기존 메시지와 새 메시지를 시간순으로 정렬
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
        // UUID는 문자열로 처리
        if (navigateRoomId) {
          // 세션 요약 페이지 접근 허용용 랜덤 토큰 생성 및 저장
          const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
          sessionStorage.setItem("sessionSummaryToken", token)
          router.replace(`/session-summary?roomId=${navigateRoomId}&token=${encodeURIComponent(token)}`)
          return
        }
      }

      // URL 쿼리 파라미터에서 roomId 가져오기
      const roomIdParam = searchParams.get("roomId")
      if (roomIdParam) {
        try {
          const roomId = roomIdParam // UUID는 문자열로 처리
          
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

    // 함수형 업데이트를 사용하여 최신 roomInfo 상태를 참조
    setRoomInfo(prev => {
      if (!prev) return null
      // 상태가 실제로 변경되었을 때만 업데이트
      if (prev.status !== roomStatus) {
        return { ...prev, status: roomStatus }
      }
      // 변경사항이 없으면 기존 객체 반환
      return prev
    })
  }, [roomStatus])

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
            <div className="pointer-events-none absolute bottom-20 right-4 z-40 flex flex-col items-end gap-3">
              {/* 채팅 패널 */}
              <div
                className={`transition-all duration-300 overflow-hidden flex justify-end ${
                  isChatOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div
                  className="pointer-events-auto rounded-3xl bg-[#fff8ea] backdrop-blur-3xl border-2 border-[#2c5f2d] overflow-hidden min-h-[420px] max-h-[calc(100vh-140px)] flex flex-col w-[448px] md:w-[512px] relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* X 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(false)}
                    className="absolute top-3 right-3 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm border border-[#2c5f2d]/30 hover:bg-white transition-all cursor-pointer"
                    aria-label="채팅 닫기"
                  >
                    <X className="w-4 h-4 text-[#2c5f2d]" />
                  </button>
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
                className={`transition-all duration-300 overflow-hidden flex justify-end ${
                  isParticipantsOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div 
                  className="pointer-events-auto rounded-3xl bg-[#fff8ea] backdrop-blur-3xl border-2 border-[#2c5f2d] overflow-hidden min-h-[420px] max-h-[calc(100vh-140px)] flex flex-col w-[448px] md:w-[512px] relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* X 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsParticipantsOpen(false)}
                    className="absolute top-3 right-3 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm border border-[#2c5f2d]/30 hover:bg-white transition-all cursor-pointer"
                    aria-label="참여자 목록 닫기"
                  >
                    <X className="w-4 h-4 text-[#2c5f2d]" />
                  </button>
                  <ParticipantsList participants={participants} isLoading={isLoadingParticipants} />
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
              <div className="rounded-3xl bg-gradient-to-br from-white/70 via-white/45 to-white/25 backdrop-blur-3xl border-2 border-[#2c5f2d] shadow-[0_24px_80px_rgba(0,0,0,0.16)] px-6 py-6 md:px-8 md:py-6 flex flex-col items-center justify-center gap-4 overflow-hidden w-full min-h-[500px] md:min-h-[540px] relative">
                {/* 채팅/참여자 버튼 - 타이머 오른쪽 상단 */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChatOpen((prev) => !prev)
                      setIsParticipantsOpen(false)
                      if (!isChatOpen) {
                        setHasNewChat(false)
                      }
                    }}
                    className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm border-2 border-[#2c5f2d] shadow-lg hover:bg-white transition-all cursor-pointer"
                    aria-label="채팅"
                  >
                    <MessageSquare className="w-5 h-5 text-[#2c5f2d]" />
                    {hasNewChat && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 shadow-sm border-2 border-white" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsParticipantsOpen((prev) => !prev)
                      setIsChatOpen(false)
                      if (!isParticipantsOpen) {
                        setHasNewParticipantsEvent(false)
                      }
                    }}
                    className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm border-2 border-[#2c5f2d] shadow-lg hover:bg-white transition-all cursor-pointer"
                    aria-label="참여자"
                  >
                    <Users className="w-5 h-5 text-[#2c5f2d]" />
                    {hasNewParticipantsEvent && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 shadow-sm border-2 border-white" />
                    )}
                  </button>
                </div>
                {/* 타이머 영역 - 포모도로/플립 공통 높이 */}
                <div className="w-full h-[480px] flex items-center justify-center">
                  {roomInfo?.timerType === TimerType.FLIP ? (
                    <div className="w-full max-w-full h-full flex items-center justify-center">
                      <FlipTimer
                        disabled={true}
                        externalTimerState={timerState}
                        externalMinutes={dialMinutes}
                        roomStatus={roomInfo?.status}
                        isPermanent={roomInfo?.isPermanent || false}
                      />
                    </div>
                  ) : (
                    <div className="w-full max-w-full h-full flex items-center justify-center">
                      <PomodoroTimer
                        disabled={true}
                        externalTimerState={timerState}
                        externalMinutes={dialMinutes}
                        roomStatus={roomInfo?.status}
                        isPermanent={roomInfo?.isPermanent || false}
                      />
                    </div>
                  )}
                </div>

                {/* 상태 메시지 표시 */}
                {statusMessage && (
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">
                      {statusMessage}
                    </p>
                  </div>
                )}
              </div>

              {/* 주간 뷰 카드 - 타이머 종류와 관계없이 동일 위치/높이 */}
              {roomInfo && (
                <div className="w-full h-[480px] md:h-[520px] rounded-3xl bg-gradient-to-br from-white/70 via-white/45 to-white/25 backdrop-blur-3xl border-2 border-[#2c5f2d] shadow-[0_24px_80px_rgba(0,0,0,0.16)] overflow-hidden relative">
                  {/* 현재 시간으로 이동 버튼 - + 버튼 위 */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!weekViewScrollRef.current) return
                      
                      const now = new Date()
                      const hours = now.getHours()
                      const minutes = now.getMinutes()
                      const currentTime = hours + minutes / 60
                      
                      const scrollPosition = currentTime * 80 - 100
                      const scrollContainer = weekViewScrollRef.current
                      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight
                      const finalScrollPosition = Math.min(Math.max(0, scrollPosition), maxScroll)
                      
                      scrollContainer.scrollTop = finalScrollPosition
                    }}
                    className="absolute bottom-16 right-4 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-gray-500 text-white shadow-lg hover:bg-gray-600 transition-all cursor-pointer"
                    aria-label="현재 시간으로 이동"
                  >
                    <Clock className="h-5 w-5" />
                  </button>
                  
                  {/* + 버튼 - 오른쪽 하단 */}
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date()
                      setNewEventDate(today)
                      setDialogDisplayMonth(today)
                      setIsAddEventDialogOpen(true)
                    }}
                    className="absolute bottom-4 right-4 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-all cursor-pointer"
                    style={{
                      backgroundColor: "hsl(121, 37%, 27%)",
                    }}
                    aria-label="일정 추가"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  <div 
                    ref={weekViewScrollRef}
                    className="h-full overflow-y-auto custom-scrollbar"
                  >
                    {/* Week Header */}
                    <div 
                      className="grid border-b border-black/10 sticky top-0 z-10"
                      style={{
                        gridTemplateColumns: isMobile 
                          ? "60px 1fr" 
                          : "60px 1fr 1fr 1fr",
                        backgroundColor: "rgba(0, 0, 0, 0.05)",
                      }}
                    >
                      <div className="p-2 text-center text-foreground/40 text-xs"></div>
                      {weekDays.map((day, i) => {
                        const today = new Date()
                        const todayStr = format(today, "yyyy-MM-dd")
                        const dayStr = format(visibleDays[i], "yyyy-MM-dd")
                        const isToday = dayStr === todayStr
                        
                        return (
                          <div 
                            key={i} 
                            className={`p-2 text-center border-l border-black/10 relative ${
                              isToday ? "bg-[#c5d4c0]/30" : ""
                            }`}
                            style={
                              isToday
                                ? {
                                    backgroundColor: "rgba(197, 212, 192, 0.3)",
                                  }
                                : {
                                    backgroundColor: "rgba(0, 0, 0, 0.05)",
                                  }
                            }
                          >
                            <div className="flex items-center justify-center gap-2">
                              <div
                                className={`text-lg font-medium ${
                                  isToday
                                    ? "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center" 
                                    : "text-foreground"
                                }`}
                                style={
                                  isToday
                                    ? {
                                        backgroundColor: "hsl(121, 37%, 27%)",
                                        color: "white",
                                      }
                                    : undefined
                                }
                              >
                                {weekDates[i]}
                              </div>
                              <div className="text-xs text-foreground/60 font-medium">{day}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Time Grid */}
                    <div 
                      className="grid"
                      style={{
                        gridTemplateColumns: isMobile 
                          ? "60px 1fr" 
                          : "60px 1fr 1fr 1fr"
                      }}
                    >
                      {/* Time Labels */}
                      <div className="text-foreground/50 sticky left-0 z-10" style={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}>
                        {timeSlots.map((time, i) => (
                          <div key={i} className="h-20 pr-2 text-right text-xs">
                            {time === 0 ? "12 AM" : time === 12 ? "12 PM" : time > 12 ? `${time - 12} PM` : `${time} AM`}
                          </div>
                        ))}
                      </div>

                      {/* Days Columns */}
                      {Array.from({ length: visibleDaysCount }).map((_, dayIndex) => {
                        const today = new Date()
                        const todayStr = format(today, "yyyy-MM-dd")
                        const dayStr = format(visibleDays[dayIndex], "yyyy-MM-dd")
                        const isToday = dayStr === todayStr
                        
                        // 현재 시간 계산 (오늘인 경우에만)
                        let currentTime: number | null = null
                        let currentTimeLabel: string = ""
                        if (isToday) {
                          const now = new Date()
                          const hours = now.getHours()
                          const minutes = now.getMinutes()
                          currentTime = hours + minutes / 60
                          currentTimeLabel = format(now, "HH:mm")
                        }
                        
                        return (
                        <div 
                          key={dayIndex} 
                          className={`border-l border-black/10 relative`}
                          style={
                            isToday
                              ? {
                                  backgroundColor: "rgba(197, 212, 192, 0.2)",
                                }
                              : undefined
                          }
                        >
                          {timeSlots.map((_, timeIndex) => (
                            <div key={timeIndex} className="h-20 border-b border-black/5"></div>
                          ))}

                          {/* Current Time Indicator - 오늘인 경우에만 표시 */}
                          {isToday && currentTime !== null && (
                            <>
                              {/* 시간 라벨 */}
                              <div
                                className="absolute left-0 z-20 flex items-center"
                                style={{
                                  top: `${currentTime * 80}px`,
                                  transform: "translateY(-100%)",
                                  marginTop: "-2px",
                                }}
                              >
                                <div
                                  className="text-xs font-medium px-1"
                                  style={{
                                    color: "white",
                                    backgroundColor: "#ef4444",
                                    borderRadius: "4px",
                                  }}
                                >
                                  {currentTimeLabel}
                                </div>
                              </div>
                              {/* 빨간 수평선 */}
                              <div
                                className="absolute left-0 right-0 z-20"
                                style={{
                                  top: `${currentTime * 80}px`,
                                  transform: "translateY(-50%)",
                                  height: "2px",
                                  backgroundColor: "#ef4444",
                                  pointerEvents: "none",
                                }}
                              />
                            </>
                          )}

                          {/* Events */}
                          {events
                            .filter((event) => {
                              const eventDateStr = format(event.date, "yyyy-MM-dd")
                              const dayDateStr = format(visibleDays[dayIndex], "yyyy-MM-dd")
                              return eventDateStr === dayDateStr
                            })
                            .map((event, i) => {
                              const eventStyle = calculateEventStyle(event.startTime, event.endTime)
                              return (
                                <div
                                  key={i}
                                  className={`absolute ${event.color} rounded-md p-2 text-white text-xs shadow-md cursor-pointer transition-all duration-200 ease-in-out hover:translate-y-[-2px] hover:shadow-lg`}
                                  style={{
                                    ...eventStyle,
                                    left: "4px",
                                    right: "4px",
                                  }}
                                  onClick={() => handleEventClick(event)}
                                >
                                  <div className="font-medium">{event.title}</div>
                                  <div className="opacity-80 text-[10px] mt-1">{`${formatTimeWithoutSeconds(event.startTime)} - ${formatTimeWithoutSeconds(event.endTime)}`}</div>
                                </div>
                              )
                            })}
                        </div>
                        )
                      })}
                    </div>
                  </div>
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
          
        </div>
      </div>


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

      {/* 일정 추가하기 다이얼로그 */}
      <Dialog 
        open={isAddEventDialogOpen} 
        onOpenChange={(open) => {
          setIsAddEventDialogOpen(open)
          if (!open) {
            setNewEventTitle("")
            setNewEventStartTime("09:00")
            setNewEventEndTime("10:00")
            setNewEventColor("bg-red-500")
            const today = new Date()
            setNewEventDate(today)
            setDialogDisplayMonth(today)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>일정 추가하기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">제목</Label>
              <Input
                id="event-title"
                placeholder="일정 제목을 입력하세요"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>날짜</Label>
              <div className="relative" ref={datePickerRef}>
                <button
                  type="button"
                  onClick={() => {
                    setDatePickerOpen(!datePickerOpen)
                    setStartTimePickerOpen(false)
                    setEndTimePickerOpen(false)
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white text-left flex items-center justify-between hover:border-primary transition-colors"
                >
                  <span className="text-sm">
                    {format(newEventDate, "yyyy년 MM월 dd일")}
                  </span>
                  <Clock className="w-4 h-4 text-gray-400" />
                </button>
                {datePickerOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-white rounded-lg border border-gray-200 shadow-lg p-4">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-foreground font-medium">{dialogCurrentMonth}</h3>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="p-1 rounded-full hover:bg-black/10 h-auto w-auto cursor-pointer"
                            onClick={() => {
                              const newDate = new Date(dialogDisplayMonth)
                              newDate.setMonth(newDate.getMonth() - 1)
                              setDialogDisplayMonth(newDate)
                            }}
                          >
                            <ChevronLeft className="h-4 w-4 text-foreground" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="p-1 rounded-full hover:bg-black/10 h-auto w-auto cursor-pointer"
                            onClick={() => {
                              const newDate = new Date(dialogDisplayMonth)
                              newDate.setMonth(newDate.getMonth() + 1)
                              setDialogDisplayMonth(newDate)
                            }}
                          >
                            <ChevronRight className="h-4 w-4 text-foreground" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center">
                        {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                          <div key={i} className="text-xs text-foreground/60 font-medium py-1">
                            {day}
                          </div>
                        ))}

                        {dialogMiniCalendarData.map((dayData, i) => {
                          if (!dayData.isCurrentMonth) {
                            return <div key={i} className="w-7 h-7"></div>
                          }
                          
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setNewEventDate(dayData.date)
                                if (dayData.date.getMonth() !== dialogDisplayMonth.getMonth()) {
                                  setDialogDisplayMonth(dayData.date)
                                }
                                setDatePickerOpen(false)
                              }}
                              className={`text-xs rounded-full w-7 h-7 flex items-center justify-center transition-colors relative cursor-pointer ${
                                dayData.isToday && !dayData.isSelected
                                  ? "text-foreground"
                                  : "text-foreground hover:bg-black/10"
                              }`}
                              style={{
                                ...(dayData.isSelected ? {
                                  backgroundColor: "#c5d4c0",
                                  color: "#2c5f2d",
                                } : {}),
                                ...(dayData.isToday && !dayData.isSelected ? {
                                  backgroundColor: "#c5d4c0",
                                  border: "2px solid hsl(121, 37%, 27%)",
                                } : {}),
                              }}
                            >
                              {dayData.dayOfMonth}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>시작 시간</Label>
                <div className="relative" ref={startTimePickerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setStartTimePickerOpen(!startTimePickerOpen)
                      setEndTimePickerOpen(false)
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white text-left flex items-center justify-between hover:border-primary transition-colors"
                  >
                    <span className="text-sm">
                      {String(startTime.hour).padStart(2, "0")}:{String(startTime.minute).padStart(2, "0")}
                    </span>
                    <Clock className="w-4 h-4 text-gray-400" />
                  </button>
                  {startTimePickerOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-white rounded-lg border border-gray-200 shadow-lg p-4">
                      <div className="grid grid-cols-2 gap-2">
                        <CustomScrollbar className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => handleStartTimeChange(hour, startTime.minute)}
                              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                                startTime.hour === hour
                                  ? "bg-primary text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {String(hour).padStart(2, "0")}
                            </button>
                          ))}
                        </CustomScrollbar>
                        <CustomScrollbar className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {[0, 10, 20, 30, 40, 50].map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => handleStartTimeChange(startTime.hour, minute)}
                              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                                startTime.minute === minute
                                  ? "bg-primary text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {String(minute).padStart(2, "0")}
                            </button>
                          ))}
                        </CustomScrollbar>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>끝나는 시간</Label>
                <div className="relative" ref={endTimePickerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setEndTimePickerOpen(!endTimePickerOpen)
                      setStartTimePickerOpen(false)
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white text-left flex items-center justify-between hover:border-primary transition-colors"
                  >
                    <span className="text-sm">
                      {String(endTime.hour).padStart(2, "0")}:{String(endTime.minute).padStart(2, "0")}
                    </span>
                    <Clock className="w-4 h-4 text-gray-400" />
                  </button>
                  {endTimePickerOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-white rounded-lg border border-gray-200 shadow-lg p-4">
                      <div className="grid grid-cols-2 gap-2">
                        <CustomScrollbar className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => handleEndTimeChange(hour, endTime.minute)}
                              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                                endTime.hour === hour
                                  ? "bg-primary text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {String(hour).padStart(2, "0")}
                            </button>
                          ))}
                        </CustomScrollbar>
                        <CustomScrollbar className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {[0, 10, 20, 30, 40, 50].map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => handleEndTimeChange(endTime.hour, minute)}
                              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                                endTime.minute === minute
                                  ? "bg-primary text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {String(minute).padStart(2, "0")}
                            </button>
                          ))}
                        </CustomScrollbar>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>색상</Label>
              <div className="flex flex-wrap gap-3">
                {colorOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNewEventColor(option.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      newEventColor === option.value
                        ? "border-primary ring-2 ring-primary ring-offset-2 scale-110"
                        : "border-gray-200 hover:border-gray-300 hover:scale-105"
                    }`}
                    style={{
                      backgroundColor: option.color,
                    }}
                    aria-label={option.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddEventDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              onClick={handleAddEvent}
              disabled={!newEventTitle.trim() || isCreatingPlan}
              style={{
                backgroundColor: "hsl(121, 37%, 27%)",
                color: "white",
              }}
            >
              {isCreatingPlan ? "생성 중..." : "추가하기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 일정 상세 보기 다이얼로그 */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${selectedEvent.color} p-6 rounded-lg shadow-xl max-w-md w-full mx-4 relative`}>
            {/* X 버튼 - 오른쪽 상단 */}
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors cursor-pointer"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h3 className="text-2xl font-bold mb-4 text-white pr-8">{selectedEvent.title}</h3>
            <div className="space-y-3 text-white">
              <p className="flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                {`${formatTimeWithoutSeconds(selectedEvent.startTime)} - ${formatTimeWithoutSeconds(selectedEvent.endTime)}`}
              </p>
              <p className="flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                {format(selectedEvent.date, "yyyy년 MM월 dd일")}
              </p>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-5 w-5 ${selectedEvent.completed ? "text-green-200" : "text-white/50"}`} />
                <span className={selectedEvent.completed ? "text-green-200" : "text-white/70"}>
                  {selectedEvent.completed ? "완료" : "미완료"}
                </span>
                {selectedEvent.completed && selectedEvent.completedAt && (
                  <span className="text-white/70 text-sm ml-2">
                    ({format(selectedEvent.completedAt, "yyyy년 MM월 dd일 HH:mm")})
                  </span>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                className="bg-red-500 text-white px-3 py-2 rounded cursor-pointer hover:!bg-red-600 hover:!opacity-100 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                onClick={handleDeleteEvent}
                aria-label="삭제하기"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="bg-white text-foreground px-4 py-2 rounded cursor-pointer hover:!bg-white hover:!opacity-100 transition-transform hover:scale-105 active:scale-95"
                onClick={() => {
                  const event = selectedEvent
                  if (event) {
                    setEditEventId(event.id)
                    setEditEventTitle(event.title)
                    setEditEventStartTime(event.startTime)
                    setEditEventEndTime(event.endTime)
                    setEditEventColor(event.color)
                    setEditEventDate(event.date)
                    setDialogDisplayMonth(event.date)
                    setSelectedEvent(null)
                    setIsEditEventDialogOpen(true)
                  }
                }}
              >
                수정하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 일정 수정하기 다이얼로그 */}
      <Dialog 
        open={isEditEventDialogOpen} 
        onOpenChange={(open) => {
          setIsEditEventDialogOpen(open)
          if (!open) {
            setEditEventTitle("")
            setEditEventStartTime("09:00")
            setEditEventEndTime("10:00")
            setEditEventColor("bg-red-500")
            const today = new Date()
            setEditEventDate(today)
            setDialogDisplayMonth(today)
            setEditEventId(undefined)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>일정 수정하기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-event-title">제목</Label>
              <Input
                id="edit-event-title"
                placeholder="일정 제목을 입력하세요"
                value={editEventTitle}
                onChange={(e) => setEditEventTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>날짜</Label>
              <div className="relative" ref={datePickerRef}>
                <button
                  type="button"
                  onClick={() => {
                    setDatePickerOpen(!datePickerOpen)
                    setStartTimePickerOpen(false)
                    setEndTimePickerOpen(false)
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white text-left flex items-center justify-between hover:border-primary transition-colors"
                >
                  <span className="text-sm">
                    {format(editEventDate, "yyyy년 MM월 dd일")}
                  </span>
                  <Clock className="w-4 h-4 text-gray-400" />
                </button>
                {datePickerOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-white rounded-lg border border-gray-200 shadow-lg p-4">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-foreground font-medium">{dialogCurrentMonth}</h3>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="p-1 rounded-full hover:bg-black/10 h-auto w-auto cursor-pointer"
                            onClick={() => {
                              const newDate = new Date(dialogDisplayMonth)
                              newDate.setMonth(newDate.getMonth() - 1)
                              setDialogDisplayMonth(newDate)
                            }}
                          >
                            <ChevronLeft className="h-4 w-4 text-foreground" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="p-1 rounded-full hover:bg-black/10 h-auto w-auto cursor-pointer"
                            onClick={() => {
                              const newDate = new Date(dialogDisplayMonth)
                              newDate.setMonth(newDate.getMonth() + 1)
                              setDialogDisplayMonth(newDate)
                            }}
                          >
                            <ChevronRight className="h-4 w-4 text-foreground" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center">
                        {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                          <div key={i} className="text-xs text-foreground/60 font-medium py-1">
                            {day}
                          </div>
                        ))}

                        {dialogMiniCalendarData.map((dayData, i) => {
                          if (!dayData.isCurrentMonth) {
                            return <div key={i} className="w-7 h-7"></div>
                          }
                          
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setEditEventDate(dayData.date)
                                if (dayData.date.getMonth() !== dialogDisplayMonth.getMonth()) {
                                  setDialogDisplayMonth(dayData.date)
                                }
                                setDatePickerOpen(false)
                              }}
                              className={`text-xs rounded-full w-7 h-7 flex items-center justify-center transition-colors relative cursor-pointer ${
                                dayData.isToday && !dayData.isSelected
                                  ? "text-foreground"
                                  : "text-foreground hover:bg-black/10"
                              }`}
                              style={{
                                ...(dayData.isSelected ? {
                                  backgroundColor: "#c5d4c0",
                                  color: "#2c5f2d",
                                } : {}),
                                ...(dayData.isToday && !dayData.isSelected ? {
                                  backgroundColor: "#c5d4c0",
                                  border: "2px solid hsl(121, 37%, 27%)",
                                } : {}),
                              }}
                            >
                              {dayData.dayOfMonth}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>시작 시간</Label>
                <div className="relative" ref={startTimePickerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setStartTimePickerOpen(!startTimePickerOpen)
                      setEndTimePickerOpen(false)
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white text-left flex items-center justify-between hover:border-primary transition-colors"
                  >
                    <span className="text-sm">
                      {String(editStartTime.hour).padStart(2, "0")}:{String(editStartTime.minute).padStart(2, "0")}
                    </span>
                    <Clock className="w-4 h-4 text-gray-400" />
                  </button>
                  {startTimePickerOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-white rounded-lg border border-gray-200 shadow-lg p-4">
                      <div className="grid grid-cols-2 gap-2">
                        <CustomScrollbar className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => handleEditStartTimeChange(hour, editStartTime.minute)}
                              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                                editStartTime.hour === hour
                                  ? "bg-primary text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {String(hour).padStart(2, "0")}
                            </button>
                          ))}
                        </CustomScrollbar>
                        <CustomScrollbar className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {[0, 10, 20, 30, 40, 50].map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => handleEditStartTimeChange(editStartTime.hour, minute)}
                              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                                editStartTime.minute === minute
                                  ? "bg-primary text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {String(minute).padStart(2, "0")}
                            </button>
                          ))}
                        </CustomScrollbar>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>끝나는 시간</Label>
                <div className="relative" ref={endTimePickerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setEndTimePickerOpen(!endTimePickerOpen)
                      setStartTimePickerOpen(false)
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white text-left flex items-center justify-between hover:border-primary transition-colors"
                  >
                    <span className="text-sm">
                      {String(editEndTime.hour).padStart(2, "0")}:{String(editEndTime.minute).padStart(2, "0")}
                    </span>
                    <Clock className="w-4 h-4 text-gray-400" />
                  </button>
                  {endTimePickerOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-white rounded-lg border border-gray-200 shadow-lg p-4">
                      <div className="grid grid-cols-2 gap-2">
                        <CustomScrollbar className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => handleEditEndTimeChange(hour, editEndTime.minute)}
                              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                                editEndTime.hour === hour
                                  ? "bg-primary text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {String(hour).padStart(2, "0")}
                            </button>
                          ))}
                        </CustomScrollbar>
                        <CustomScrollbar className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {[0, 10, 20, 30, 40, 50].map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => handleEditEndTimeChange(editEndTime.hour, minute)}
                              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                                editEndTime.minute === minute
                                  ? "bg-primary text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {String(minute).padStart(2, "0")}
                            </button>
                          ))}
                        </CustomScrollbar>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>색상</Label>
              <div className="flex flex-wrap gap-3">
                {colorOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEditEventColor(option.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      editEventColor === option.value
                        ? "border-primary ring-2 ring-primary ring-offset-2 scale-110"
                        : "border-gray-200 hover:border-gray-300 hover:scale-105"
                    }`}
                    style={{
                      backgroundColor: option.color,
                    }}
                    aria-label={option.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditEventDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              onClick={handleEditEvent}
              disabled={!editEventTitle.trim() || isUpdatingPlan}
              style={{
                backgroundColor: "hsl(121, 37%, 27%)",
                color: "white",
              }}
            >
              {isUpdatingPlan ? "수정 중..." : "수정하기"}
            </Button>
          </DialogFooter>
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

export default function MemberRoomPage() {
  return (
    <Suspense fallback={null}>
      <MemberRoomPageInner />
    </Suspense>
  )
}

