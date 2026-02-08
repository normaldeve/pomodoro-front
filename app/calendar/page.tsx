"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Home,
  Plus,
  CheckCircle2,
  BookOpen,
  X,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomScrollbar } from "@/components/ui/custom-scrollbar"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createPlan, updatePlan, deletePlan, getPlansByDateRange, getPlansByDate, EventColor, PlanResponse, ApiError } from "@/lib/api"
import { showSuccessNotification, showErrorNotification } from "@/lib/system-notification"

interface Event {
  id?: number // 계획 ID (수정/삭제 시 필요)
  title: string
  startTime: string
  endTime: string
  day: number // 주간 뷰 인덱스 (호환성 유지)
  date: Date // 실제 날짜
  color: string
  completed: boolean // 완료 여부
  completedAt: Date | null // 완료 시간
}

export default function CalendarPage() {
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [isLoaded, setIsLoaded] = useState(false)
  const [showHeader, setShowHeader] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [displayMonth, setDisplayMonth] = useState(new Date()) // 미니 캘린더에 표시할 월
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isAddEventDialogOpen, setIsAddEventDialogOpen] = useState(false)
  const [isEditEventDialogOpen, setIsEditEventDialogOpen] = useState(false) // 수정 다이얼로그 열림 상태
  const [events, setEvents] = useState<Event[]>([]) // 이벤트 목록 state
  const [newEventTitle, setNewEventTitle] = useState("")
  const [newEventStartTime, setNewEventStartTime] = useState("09:00")
  const [newEventEndTime, setNewEventEndTime] = useState("10:00")
  const [newEventColor, setNewEventColor] = useState("bg-red-500")
  const [newEventDate, setNewEventDate] = useState(new Date())
  const [dialogDisplayMonth, setDialogDisplayMonth] = useState(new Date()) // 다이얼로그 내부 미니 캘린더용 월
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [isCreatingPlan, setIsCreatingPlan] = useState(false) // 계획 생성 중 상태
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false) // 계획 수정 중 상태
  
  // 수정용 state
  const [editEventTitle, setEditEventTitle] = useState("")
  const [editEventStartTime, setEditEventStartTime] = useState("09:00")
  const [editEventEndTime, setEditEventEndTime] = useState("10:00")
  const [editEventColor, setEditEventColor] = useState("bg-red-500")
  const [editEventDate, setEditEventDate] = useState(new Date())
  const [editEventId, setEditEventId] = useState<number | undefined>(undefined)
  
  // 시간 선택 상태
  const [startTimePickerOpen, setStartTimePickerOpen] = useState(false)
  const [endTimePickerOpen, setEndTimePickerOpen] = useState(false)
  const startTimePickerRef = useRef<HTMLDivElement>(null)
  const endTimePickerRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  
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
  
  // 시간 파싱 및 설정 함수
  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number)
    return { hour: hours, minute: minutes }
  }
  
  const formatTime = (hour: number, minute: number) => {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  }

  // 시간 문자열에서 초 단위 제거 (HH:mm:ss -> HH:mm)
  const formatTimeWithoutSeconds = (timeStr: string): string => {
    if (!timeStr) return timeStr
    // HH:mm:ss 형식이면 HH:mm만 반환
    if (timeStr.includes(":") && timeStr.split(":").length === 3) {
      return timeStr.substring(0, 5) // "HH:mm"만 추출
    }
    return timeStr // 이미 HH:mm 형식이면 그대로 반환
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

  useEffect(() => {
    setIsLoaded(true)
    setTimeout(() => setShowHeader(true), 100)
  }, [])

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

  const handleAddEvent = async () => {
    if (!newEventTitle.trim()) {
      return
    }

    setIsCreatingPlan(true)

    try {
      // API 요청 데이터 준비
      const planDate = format(newEventDate, "yyyy-MM-dd")
      const requestData = {
        title: newEventTitle.trim(),
        planDate: planDate,
        startTime: newEventStartTime,
        endTime: newEventEndTime,
        color: mapColorToEventColor(newEventColor),
      }

      // 백엔드 API 호출
      const response = await createPlan(requestData)

      // 선택된 날짜가 주간 뷰에 표시되는 날짜 중 어느 날인지 찾기
      const dayIndex = visibleDays.findIndex(day => 
        format(day, "yyyy-MM-dd") === format(newEventDate, "yyyy-MM-dd")
      )

      // 성공 알림
      showSuccessNotification("학습 계획이 생성되었습니다.")
      
      // 계획 목록 다시 조회 (최신 데이터 반영)
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
      const convertedEvents = plans.map(plan => convertPlanToEvent(plan, visibleDays))
      setEvents(convertedEvents)
      
      // 폼 초기화 및 다이얼로그 닫기
      setNewEventTitle("")
      setNewEventStartTime("09:00")
      setNewEventEndTime("10:00")
      setNewEventColor("bg-red-500")
      setNewEventDate(selectedDate)
      setDialogDisplayMonth(selectedDate)
      setIsAddEventDialogOpen(false)
    } catch (error) {
      // 에러는 apiRequest에서 이미 시스템 알림으로 표시됨
      console.error("계획 생성 실패:", error)
      if (error instanceof ApiError && error.requiresLogin) {
        // 로그인 필요 에러는 별도 처리 (이미 시스템 알림 표시됨)
      }
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
      // API 요청 데이터 준비
      const planDate = format(editEventDate, "yyyy-MM-dd")
      const requestData = {
        title: editEventTitle.trim(),
        planDate: planDate,
        startTime: editEventStartTime,
        endTime: editEventEndTime,
        color: mapColorToEventColor(editEventColor),
      }

      // 백엔드 API 호출
      await updatePlan(editEventId, requestData)

      // 성공 알림
      showSuccessNotification("학습 계획이 수정되었습니다.")

      // 계획 목록 다시 조회 (최신 데이터 반영)
      let plans: PlanResponse[]
      if (isMobile) {
        const date = format(visibleDays[0], "yyyy-MM-dd")
        plans = await getPlansByDate(date)
      } else {
        const startDate = format(visibleDays[0], "yyyy-MM-dd")
        const endDate = format(visibleDays[visibleDays.length - 1], "yyyy-MM-dd")
        plans = await getPlansByDateRange(startDate, endDate)
      }
      const convertedEvents = plans.map(plan => convertPlanToEvent(plan, visibleDays))
      setEvents(convertedEvents)

      // 폼 초기화 및 다이얼로그 닫기
      setIsEditEventDialogOpen(false)
    } catch (error) {
      // 에러는 apiRequest에서 이미 시스템 알림으로 표시됨
      console.error("계획 수정 실패:", error)
      if (error instanceof ApiError && error.requiresLogin) {
        // 로그인 필요 에러는 별도 처리 (이미 시스템 알림 표시됨)
      }
    } finally {
      setIsUpdatingPlan(false)
    }
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !selectedEvent.id) {
      return
    }

    try {
      // 백엔드 API 호출
      await deletePlan(selectedEvent.id)

      // 성공 알림
      showSuccessNotification("학습 계획이 삭제되었습니다.")

      // 계획 목록 다시 조회 (최신 데이터 반영)
      let plans: PlanResponse[]
      if (isMobile) {
        const date = format(visibleDays[0], "yyyy-MM-dd")
        plans = await getPlansByDate(date)
      } else {
        const startDate = format(visibleDays[0], "yyyy-MM-dd")
        const endDate = format(visibleDays[visibleDays.length - 1], "yyyy-MM-dd")
        plans = await getPlansByDateRange(startDate, endDate)
      }
      const convertedEvents = plans.map(plan => convertPlanToEvent(plan, visibleDays))
      setEvents(convertedEvents)

      // 다이얼로그 닫기
      setSelectedEvent(null)
    } catch (error) {
      console.error("계획 삭제 실패:", error)
      if (error instanceof ApiError && error.requiresLogin) {
        // 로그인 필요 에러는 별도 처리 (이미 시스템 알림 표시됨)
      }
    }
  }
  
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

  // 선택한 날짜 기준으로 표시할 날짜들 계산
  const visibleDays = useMemo(() => {
    const days: Date[] = []
    
    if (isMobile) {
      // 모바일: 선택한 날짜만
      days.push(selectedDate)
    } else {
      // 데스크톱: 선택한 날짜 기준 어제, 선택한 날짜, 내일
      days.push(subDays(selectedDate, 1)) // 어제
      days.push(selectedDate) // 선택한 날짜
      days.push(addDays(selectedDate, 1)) // 내일
    }
    return days
  }, [isMobile, selectedDate])

  // PlanResponse를 Event 형식으로 변환
  const convertPlanToEvent = (plan: PlanResponse, visibleDays: Date[]): Event => {
    const planDate = new Date(plan.planDate)
    const dayIndex = visibleDays.findIndex(day => 
      format(day, "yyyy-MM-dd") === format(planDate, "yyyy-MM-dd")
    )

    return {
      id: plan.id, // 계획 ID 추가
      title: plan.title,
      startTime: plan.startTime,
      endTime: plan.endTime,
      day: dayIndex >= 0 ? dayIndex + 1 : 1, // 주간 뷰 인덱스 (호환성 유지)
      date: planDate, // 실제 날짜 저장
      color: mapEventColorToColor(plan.color), // 백엔드 색상을 프론트엔드 색상으로 변환
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
        // 에러는 apiRequest에서 이미 시스템 알림으로 표시됨
        // 조회 실패 시 기존 이벤트 목록은 유지
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

  const currentMonth = useMemo(() => {
    const month = displayMonth.getMonth() + 1
    const year = displayMonth.getFullYear()
    return `${month}월 ${year}`
  }, [displayMonth])

  const timeSlots = Array.from({ length: 24 }, (_, i) => i) // 0시부터 23시까지
  const visibleDaysCount = isMobile ? 1 : 3

  const calculateEventStyle = (startTime: string, endTime: string) => {
    const start = Number.parseInt(startTime.split(":")[0]) + Number.parseInt(startTime.split(":")[1]) / 60
    const end = Number.parseInt(endTime.split(":")[0]) + Number.parseInt(endTime.split(":")[1]) / 60
    const top = start * 80
    const height = (end - start) * 80
    return { top: `${top}px`, height: `${height}px` }
  }

  // 미니 캘린더용 날짜 계산
  const miniCalendarData = useMemo(() => {
    const monthStart = startOfMonth(displayMonth)
    const monthEnd = endOfMonth(displayMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }) // 일요일 시작
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    
    // 오늘 날짜를 한 번만 계산
    const today = new Date()
    const todayStr = format(today, "yyyy-MM-dd")
    
    // 주간 뷰에 표시되는 날짜들의 문자열 배열 생성
    const visibleDaysStr = visibleDays.map(day => format(day, "yyyy-MM-dd"))
    
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd")
      return {
        date: day,
        dayOfMonth: day.getDate(),
        isCurrentMonth: day.getMonth() === displayMonth.getMonth(),
        isToday: dayStr === todayStr,
        isSelected: dayStr === format(selectedDate, "yyyy-MM-dd"),
        isVisibleInWeekView: visibleDaysStr.includes(dayStr),
      }
    })
  }, [displayMonth, selectedDate, visibleDays])

  // 다이얼로그 내부 미니 캘린더용 날짜 계산
  const dialogMiniCalendarData = useMemo(() => {
    const monthStart = startOfMonth(dialogDisplayMonth)
    const monthEnd = endOfMonth(dialogDisplayMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }) // 일요일 시작
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    
    // 오늘 날짜를 한 번만 계산
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

  return (
    <div 
      className="relative w-full flex justify-center"
      style={{
        ...(isMobile ? { minHeight: '100vh' } : { height: '100vh', overflow: 'hidden' }),
        '--background': '40 100% 95.9%',
        '--foreground': '0 0% 0%',
        '--primary': '121 37% 27%',
        '--primary-foreground': '0 0% 100%',
        '--secondary': '210 40% 96.1%',
        '--secondary-foreground': '222.2 47.4% 11.2%',
        '--muted': '210 40% 96.1%',
        '--muted-foreground': '215.4 16.3% 46.9%',
        '--accent': '210 40% 96.1%',
        '--accent-foreground': '222.2 47.4% 11.2%',
        '--border': '214.3 31.8% 91.4%',
        '--input': '214.3 31.8% 91.4%',
        '--ring': '121 37% 27%',
        backgroundColor: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
      } as React.CSSProperties & { [key: string]: any }}
    >
      {/* Header + Main content wrapper */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col gap-4 p-4" style={isMobile ? { paddingBottom: '100px' } : { height: 'calc(100vh - 80px)', paddingBottom: '20px' }}>
        {/* Header */}
        <header
          className="relative flex items-center justify-between gap-4 py-3 text-xs md:text-sm text-black transition-all duration-700 ease-out"
          style={{
            opacity: showHeader ? 1 : 0,
            transform: showHeader ? "translateY(0)" : "translateY(-20px)",
          }}
        >
          {/* Left: 사이트 로고 */}
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 md:gap-3 cursor-pointer flex-shrink-0"
          >
            <span
              className="text-lg md:text-2xl font-black font-service-name"
              style={{
                letterSpacing: "0.05em",
                color: "#2c5f2d",
                fontWeight: 900,
              }}
            >
              POGATHER
            </span>
          </button>
        </header>

        {/* 안내 텍스트 */}
        <div className="w-full">
          <h2 className="text-lg font-semibold text-foreground mb-1">학습 계획을 세워보세요</h2>
          <p className="text-sm text-foreground/70">해당 계획은 스터디룸에서 확인하실 수 있습니다</p>
        </div>

        {/* Main Content */}
        <main className={`relative w-full flex gap-4 ${isMobile ? "flex-col" : "flex-1 min-h-0"}`}>
        {/* Sidebar */}
        <div
          className={`${isMobile ? "w-full" : "w-64 shrink-0"} bg-black/5 p-4 shadow-xl border border-black/10 rounded-xl opacity-0 ${isLoaded ? "animate-fade-in" : ""} flex flex-col justify-between`}
          style={{ animationDelay: "0.4s" }}
        >
          <CustomScrollbar className="flex-1 overflow-y-auto min-h-0">
            <div>

              {/* Mini Calendar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-foreground font-medium">{currentMonth}</h3>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="p-1 rounded-full hover:bg-black/10 h-auto w-auto cursor-pointer"
                      onClick={() => {
                        const newDate = new Date(displayMonth)
                        newDate.setMonth(newDate.getMonth() - 1)
                        setDisplayMonth(newDate)
                      }}
                    >
                      <ChevronLeft className="h-4 w-4 text-foreground" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="p-1 rounded-full hover:bg-black/10 h-auto w-auto cursor-pointer"
                      onClick={() => {
                        const newDate = new Date(displayMonth)
                        newDate.setMonth(newDate.getMonth() + 1)
                        setDisplayMonth(newDate)
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

                  {miniCalendarData.map((dayData, i) => {
                    // 현재 월이 아닌 날짜는 빈 칸으로 표시
                    if (!dayData.isCurrentMonth) {
                      return <div key={i} className="w-7 h-7"></div>
                    }
                    
                    // 주간 뷰에 표시되는 날짜인지 확인
                    const isInWeekView = dayData.isVisibleInWeekView
                    
                    // 이전/다음 날짜가 주간 뷰에 포함되는지 확인 (연속된 그룹 판단용)
                    const prevDay = i > 0 ? miniCalendarData[i - 1] : null
                    const nextDay = i < miniCalendarData.length - 1 ? miniCalendarData[i + 1] : null
                    const isGroupStart = isInWeekView && (!prevDay || !prevDay.isVisibleInWeekView || !prevDay.isCurrentMonth)
                    const isGroupEnd = isInWeekView && (!nextDay || !nextDay.isVisibleInWeekView || !nextDay.isCurrentMonth)
                    
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedDate(dayData.date)
                          // 선택한 날짜가 다른 월이면 displayMonth도 업데이트
                          if (dayData.date.getMonth() !== displayMonth.getMonth()) {
                            setDisplayMonth(dayData.date)
                          }
                        }}
                        className={`text-xs rounded-full w-7 h-7 flex items-center justify-center transition-colors relative cursor-pointer ${
                          dayData.isToday && !dayData.isSelected
                            ? "text-foreground"
                            : "text-foreground hover:bg-black/10"
                        }`}
                        style={{
                          // 선택한 날짜: 연한 녹색 배경
                          ...(dayData.isSelected ? {
                            backgroundColor: "#c5d4c0",
                            color: "#2c5f2d",
                          } : {}),
                          // 오늘 날짜 (선택되지 않은 경우): 연한 녹색 배경 + 테두리
                          ...(dayData.isToday && !dayData.isSelected ? {
                            backgroundColor: "#c5d4c0",
                            border: "2px solid hsl(121, 37%, 27%)",
                          } : {}),
                          // 주간 뷰 날짜들 (선택되지 않은 경우): 회색 배경
                          ...(isInWeekView && !dayData.isSelected && !dayData.isToday ? {
                            backgroundColor: "#e5e7eb",
                          } : {}),
                        }}
                      >
                        {dayData.dayOfMonth}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 할일 추가하기 버튼 */}
              <div className="mt-4">
                <Button
                  className="w-full text-white hover:opacity-90 cursor-pointer"
                  style={{
                    backgroundColor: "hsl(121, 37%, 27%)",
                  }}
                  onClick={() => {
                    setNewEventDate(selectedDate)
                    setDialogDisplayMonth(selectedDate)
                    setIsAddEventDialogOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  할일 추가하기
                </Button>
              </div>
            </div>
          </CustomScrollbar>

        </div>

        {/* Calendar View */}
        <div
          className={`${isMobile ? "w-full" : "flex-1"} flex flex-col opacity-0 bg-black/5 border border-black/10 shadow-sm ${isLoaded ? "animate-fade-in" : ""}`}
          style={{ animationDelay: "0.6s", ...(isMobile ? { height: "60vh", minHeight: "60vh" } : {}) }}
        >
          <CustomScrollbar className={`flex-1 overflow-y-auto ${isMobile ? "min-h-0" : "min-h-0"}`}>
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
                const selectedDateStr = format(selectedDate, "yyyy-MM-dd")
                const isSelectedToday = selectedDateStr === todayStr && isToday
                
                // 현재 시간 계산 (선택된 날짜가 오늘인 경우에만)
                let currentTime: number | null = null
                let currentTimeLabel: string = ""
                if (isSelectedToday) {
                  const now = new Date()
                  const hours = now.getHours()
                  const minutes = now.getMinutes()
                  currentTime = hours + minutes / 60
                  currentTimeLabel = format(now, "HH:mm")
                }
                
                return (
                <div 
                  key={dayIndex} 
                  className={`border-l border-black/10 relative ${
                    isToday ? "" : ""
                  }`}
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

                  {/* Current Time Indicator - 선택된 날짜가 오늘인 경우에만 표시 */}
                  {isSelectedToday && currentTime !== null && (
                    <>
                      {/* 시간 라벨 (왼쪽, 빨간 줄 위에 배치) */}
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
                      // 날짜 기반으로 필터링
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
          </CustomScrollbar>
        </div>

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
                  <Calendar className="mr-2 h-5 w-5" />
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
                    if (selectedEvent) {
                      // 수정 폼에 선택된 이벤트 정보 채우기
                      setEditEventId(selectedEvent.id)
                      setEditEventTitle(selectedEvent.title)
                      setEditEventStartTime(selectedEvent.startTime)
                      setEditEventEndTime(selectedEvent.endTime)
                      setEditEventColor(selectedEvent.color)
                      setEditEventDate(selectedEvent.date)
                      setDialogDisplayMonth(selectedEvent.date)
                      // 상세 정보 모달 닫고 수정 다이얼로그 열기
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
        </main>
      </div>

      {/* 하단 탭 바 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center">
        <div className="w-full max-w-2xl rounded-3xl bg-gradient-to-br from-white/70 via-white/45 to-white/25 backdrop-blur-3xl border border-white/60 shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
          <div className="grid grid-cols-5 items-center px-2 py-2">
            {/* 빈 공간 - 높이 맞추기용 */}
            <div className="flex flex-col items-center justify-center gap-1 px-3 py-2">
              <div className="h-5 w-5"></div>
              <div className="h-[10px] w-0"></div>
            </div>
            
            {/* 캘린더 탭 */}
            <button
              type="button"
              onClick={() => router.push("/calendar")}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                pathname === "/calendar"
                  ? "text-primary bg-primary/10"
                  : "text-black/60 hover:text-black/80"
              }`}
              style={
                pathname === "/calendar"
                  ? {
                      color: 'hsl(121, 37%, 27%)',
                      backgroundColor: 'rgba(44, 95, 45, 0.1)',
                    }
                  : undefined
              }
            >
              <Calendar className="h-5 w-5" />
              <span className="text-[10px] font-medium">캘린더</span>
            </button>
            
            {/* 홈 버튼 - 녹색 원 안에 (정중앙) */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex items-center justify-center w-12 h-12 rounded-full text-white shadow-lg shadow-primary/40 border border-white/70 hover:bg-primary/90 transition-colors -mt-6 cursor-pointer"
                style={{
                  backgroundColor: 'hsl(121, 37%, 27%)',
                }}
                aria-label="홈으로 가기"
              >
                <Home className="h-6 w-6" />
              </button>
            </div>
            
            {/* 회고 탭 */}
            <button
              type="button"
              onClick={() => router.push("/reflection")}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                pathname === "/reflection"
                  ? "text-primary bg-primary/10"
                  : "text-black/60 hover:text-black/80"
              }`}
              style={
                pathname === "/reflection"
                  ? {
                      color: 'hsl(121, 37%, 27%)',
                      backgroundColor: 'rgba(44, 95, 45, 0.1)',
                    }
                  : undefined
              }
            >
              <BookOpen className="h-5 w-5" />
              <span className="text-[10px] font-medium">회고</span>
            </button>
            
            {/* 빈 공간 - 높이 맞추기용 */}
            <div className="flex flex-col items-center justify-center gap-1 px-3 py-2">
              <div className="h-5 w-5"></div>
              <div className="h-[10px] w-0"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 할일 추가하기 다이얼로그 */}
      <Dialog 
        open={isAddEventDialogOpen} 
        onOpenChange={(open) => {
          setIsAddEventDialogOpen(open)
          if (!open) {
            // 다이얼로그 닫을 때 폼 초기화
            setNewEventTitle("")
            setNewEventStartTime("09:00")
            setNewEventEndTime("10:00")
            setNewEventColor("bg-red-500")
            setNewEventDate(selectedDate)
            setDialogDisplayMonth(selectedDate)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>할일 추가하기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">제목</Label>
              <Input
                id="event-title"
                placeholder="할일 제목을 입력하세요"
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
                  <Calendar className="w-4 h-4 text-gray-400" />
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
                          // 현재 월이 아닌 날짜는 빈 칸으로 표시
                          if (!dayData.isCurrentMonth) {
                            return <div key={i} className="w-7 h-7"></div>
                          }
                          
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setNewEventDate(dayData.date)
                                // 선택한 날짜가 다른 월이면 dialogDisplayMonth도 업데이트
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
                                // 선택한 날짜: 연한 녹색 배경
                                ...(dayData.isSelected ? {
                                  backgroundColor: "#c5d4c0",
                                  color: "#2c5f2d",
                                } : {}),
                                // 오늘 날짜 (선택되지 않은 경우): 연한 녹색 배경 + 테두리
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
                        {/* 시간 선택 */}
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
                        {/* 분 선택 (10분 단위) */}
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
                        {/* 시간 선택 */}
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
                        {/* 분 선택 (10분 단위) */}
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

      {/* 할일 수정하기 다이얼로그 */}
      <Dialog 
        open={isEditEventDialogOpen} 
        onOpenChange={(open) => {
          setIsEditEventDialogOpen(open)
          if (!open) {
            // 다이얼로그 닫을 때 폼 초기화
            setEditEventTitle("")
            setEditEventStartTime("09:00")
            setEditEventEndTime("10:00")
            setEditEventColor("bg-red-500")
            setEditEventDate(selectedDate)
            setDialogDisplayMonth(selectedDate)
            setEditEventId(undefined)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>할일 수정하기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-event-title">제목</Label>
              <Input
                id="edit-event-title"
                placeholder="할일 제목을 입력하세요"
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
                  <Calendar className="w-4 h-4 text-gray-400" />
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

    </div>
  )
}
