"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Calendar,
  Home,
  Plus,
  CheckCircle2,
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

interface Event {
  title: string
  startTime: string
  endTime: string
  location: string
  day: number // 주간 뷰 인덱스 (호환성 유지)
  date: Date // 실제 날짜
  attendees: string[]
  organizer: string
  description: string
  color: string
  completed: boolean // 완료 여부
  completedAt: Date | null // 완료 시간
}

export default function CalendarPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [isLoaded, setIsLoaded] = useState(false)
  const [showHeader, setShowHeader] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [displayMonth, setDisplayMonth] = useState(new Date()) // 미니 캘린더에 표시할 월
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isAddEventDialogOpen, setIsAddEventDialogOpen] = useState(false)
  const [events, setEvents] = useState<Event[]>([]) // 이벤트 목록 state
  const [newEventTitle, setNewEventTitle] = useState("")
  const [newEventStartTime, setNewEventStartTime] = useState("09:00")
  const [newEventEndTime, setNewEventEndTime] = useState("10:00")
  const [newEventColor, setNewEventColor] = useState("bg-red-500")
  const [newEventDate, setNewEventDate] = useState(new Date())
  const [dialogDisplayMonth, setDialogDisplayMonth] = useState(new Date()) // 다이얼로그 내부 미니 캘린더용 월
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  
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
  
  const startTime = parseTime(newEventStartTime)
  const endTime = parseTime(newEventEndTime)
  
  const handleStartTimeChange = (hour: number, minute: number) => {
    setNewEventStartTime(formatTime(hour, minute))
  }
  
  const handleEndTimeChange = (hour: number, minute: number) => {
    setNewEventEndTime(formatTime(hour, minute))
  }

  useEffect(() => {
    setIsLoaded(true)
    setTimeout(() => setShowHeader(true), 100)
  }, [])

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event)
  }

  const handleAddEvent = () => {
    if (!newEventTitle.trim()) {
      return
    }

    // 선택된 날짜가 주간 뷰에 표시되는 날짜 중 어느 날인지 찾기
    const dayIndex = visibleDays.findIndex(day => 
      format(day, "yyyy-MM-dd") === format(newEventDate, "yyyy-MM-dd")
    )

    const newEvent: Event = {
      title: newEventTitle,
      startTime: newEventStartTime,
      endTime: newEventEndTime,
      location: "",
      day: dayIndex >= 0 ? dayIndex + 1 : 1, // 주간 뷰 인덱스 (호환성 유지)
      date: new Date(newEventDate), // 실제 날짜 저장
      attendees: [],
      organizer: "",
      description: "",
      color: newEventColor,
      completed: false, // 기본값: 미완료
      completedAt: null, // 기본값: 완료 시간 없음
    }
    
    // 이벤트를 state에 추가
    setEvents(prev => [...prev, newEvent])
    console.log("새 이벤트 추가:", newEvent)
    
    // 폼 초기화 및 다이얼로그 닫기
    setNewEventTitle("")
    setNewEventStartTime("09:00")
    setNewEventEndTime("10:00")
    setNewEventColor("bg-red-500")
    setNewEventDate(selectedDate)
    setDialogDisplayMonth(selectedDate)
    setIsAddEventDialogOpen(false)
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
      className="relative min-h-screen w-full overflow-hidden flex justify-center"
      style={{
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
      } as React.CSSProperties}
    >
      {/* Header + Main content wrapper */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col gap-4 p-4">
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
        <main className={`relative w-full flex gap-4 ${isMobile ? "flex-col" : ""}`} style={{ height: isMobile ? "auto" : "calc(100vh - 200px)" }}>
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
          className={`${isMobile ? "w-full" : "flex-1"} flex flex-col opacity-0 bg-black/5 rounded-xl border border-black/10 shadow-sm ${isLoaded ? "animate-fade-in" : ""}`}
          style={{ animationDelay: "0.6s", ...(isMobile ? { height: "60vh", minHeight: "60vh" } : {}) }}
        >
          <CustomScrollbar className={`flex-1 overflow-y-auto ${isMobile ? "min-h-0" : "min-h-0"}`}>
            {/* Week Header */}
            <div 
              className="grid border-b border-black/10"
              style={{
                gridTemplateColumns: isMobile 
                  ? "60px 1fr" 
                  : "60px 1fr 1fr 1fr"
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
                        : undefined
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
              <div className="text-foreground/50">
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
                          <div className="opacity-80 text-[10px] mt-1">{`${event.startTime} - ${event.endTime}`}</div>
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
            <div className={`${selectedEvent.color} p-6 rounded-lg shadow-xl max-w-md w-full mx-4`}>
              <h3 className="text-2xl font-bold mb-4 text-white">{selectedEvent.title}</h3>
              <div className="space-y-3 text-white">
                <p className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  {`${selectedEvent.startTime} - ${selectedEvent.endTime}`}
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
                  className="bg-white text-foreground px-4 py-2 rounded cursor-pointer hover:!bg-white hover:!opacity-100 transition-transform hover:scale-105 active:scale-95"
                  onClick={() => setSelectedEvent(null)}
                >
                  닫기
                </Button>
                <Button
                  variant="secondary"
                  className="bg-white text-foreground px-4 py-2 rounded cursor-pointer hover:!bg-white hover:!opacity-100 transition-transform hover:scale-105 active:scale-95"
                  onClick={() => {
                    // TODO: 수정하기 기능 구현
                    console.log("수정하기 클릭:", selectedEvent)
                    setSelectedEvent(null)
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
            <div className="flex flex-col items-center justify-center gap-1 px-3 py-2">
              <div className="h-5 w-5"></div>
              <div className="h-[10px] w-0"></div>
            </div>
            
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
            
            {/* 빈 공간 - 높이 맞추기용 */}
            <div className="flex flex-col items-center justify-center gap-1 px-3 py-2">
              <div className="h-5 w-5"></div>
              <div className="h-[10px] w-0"></div>
            </div>
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
                        {/* 분 선택 */}
                        <CustomScrollbar className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
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
                        {/* 분 선택 */}
                        <CustomScrollbar className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
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
              disabled={!newEventTitle.trim()}
              style={{
                backgroundColor: "hsl(121, 37%, 27%)",
                color: "white",
              }}
            >
              추가하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
