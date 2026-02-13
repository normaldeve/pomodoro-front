"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from "date-fns"
import { Home, Calendar, BookOpen, ChevronLeft, ChevronRight, Star } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { CustomScrollbar } from "@/components/ui/custom-scrollbar"
import { Button } from "@/components/ui/button"
import { getMyReflections, ReflectionQueryResponse, getCurrentUser } from "@/lib/api"

interface Reflection {
  id: number
  date: Date
  authorName: string
  authorAvatar?: string
  content: string
  focusScore?: number | null
  sessionId?: number
  imageUrl?: string | null
  roomName?: string
  roomId?: string
}

export default function ReflectionPage() {
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [isLoaded, setIsLoaded] = useState(false)
  const [showHeader, setShowHeader] = useState(false)
  const [displayMonth, setDisplayMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showThisMonthOnly, setShowThisMonthOnly] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [reflections, setReflections] = useState<Reflection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userCreatedAt, setUserCreatedAt] = useState<Date | null>(null) // 사용자 생성일

  // API 응답을 Reflection 인터페이스로 변환
  const convertToReflection = (response: ReflectionQueryResponse): Reflection => {
    return {
      id: response.reflectionId,
      date: parseISO(response.createdAt),
      authorName: response.user.nickname,
      authorAvatar: response.user.profileUrl || undefined,
      content: response.content,
      focusScore: response.focusScore,
      sessionId: response.sessionId,
      imageUrl: response.imageUrl || undefined,
      roomName: response.room.roomName,
      roomId: response.room.roomId,
    }
  }

  // 회고 데이터 로드 (초기 로드 및 필터 변경 시)
  useEffect(() => {
    const loadReflections = async () => {
      try {
        setIsLoading(true)
        let date: string | undefined
        let year: number | undefined
        let month: number | undefined

        if (selectedDate) {
          // 특정 날짜 조회
          date = format(selectedDate, "yyyy-MM-dd")
        } else if (showThisMonthOnly) {
          // 이번 달 조회
          const today = new Date()
          year = today.getFullYear()
          month = today.getMonth() + 1
        } else if (showAll) {
          // 전체 조회: 파라미터 없이 호출
          // year, month를 undefined로 유지
        } else {
          // 초기 로드 시: displayMonth 기준으로 해당 월 조회
          year = displayMonth.getFullYear()
          month = displayMonth.getMonth() + 1
        }

        const data = await getMyReflections(date, year, month)
        const converted = data.map(convertToReflection)
        setReflections(converted)
      } catch (error) {
        console.error("회고 데이터 로드 실패:", error)
        setReflections([])
      } finally {
        setIsLoading(false)
      }
    }

    loadReflections()
  }, [selectedDate, showThisMonthOnly, showAll, displayMonth])

  useEffect(() => {
    setIsLoaded(true)
    setTimeout(() => setShowHeader(true), 100)
    
    // 사용자 생성일 가져오기
    const fetchUserCreatedAt = async () => {
      try {
        const user = await getCurrentUser()
        if (user.createdAt) {
          setUserCreatedAt(new Date(user.createdAt))
        }
      } catch (error) {
        console.error("사용자 정보 조회 실패:", error)
      }
    }
    fetchUserCreatedAt()
  }, [])

  // 캘린더 데이터 계산
  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(displayMonth)
    const monthEnd = endOfMonth(displayMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }) // 일요일 시작
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    
    const today = new Date()
    const todayStr = format(today, "yyyy-MM-dd")
    
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd")
      const dayReflection = reflections.find(r => isSameDay(r.date, day))
      
      return {
        date: day,
        dayOfMonth: day.getDate(),
        isCurrentMonth: day.getMonth() === displayMonth.getMonth(),
        isToday: dayStr === todayStr,
        isSelected: selectedDate ? isSameDay(day, selectedDate) : false,
        hasReflection: !!dayReflection,
        reflection: dayReflection,
      }
    })
  }, [displayMonth, reflections, selectedDate])

  const currentMonthText = useMemo(() => {
    return format(displayMonth, "yyyy년 M월")
  }, [displayMonth])

  const currentMonth = useMemo(() => {
    const month = displayMonth.getMonth() + 1
    const year = displayMonth.getFullYear()
    return `${month}월 ${year}`
  }, [displayMonth])

  // 통계 계산
  const stats = useMemo(() => {
    const monthReflections = reflections.filter(r => 
      r.date.getMonth() === displayMonth.getMonth() && 
      r.date.getFullYear() === displayMonth.getFullYear()
    )
    
    return {
      completed: monthReflections.length, // 완료된 회고 수
    }
  }, [reflections, displayMonth])

  // 표시할 회고 목록 계산
  const displayedReflections = useMemo(() => {
    let filteredReflections = reflections

    // 이번 달 필터 적용
    if (showThisMonthOnly) {
      const today = new Date()
      const currentYear = today.getFullYear()
      const currentMonth = today.getMonth()
      filteredReflections = filteredReflections.filter(r => 
        r.date.getFullYear() === currentYear && r.date.getMonth() === currentMonth
      )
    }

    if (!selectedDate) {
      // 날짜가 선택되지 않았으면 필터링된 회고 목록을 시간순으로 정렬 (최신순)
      return filteredReflections.sort((a, b) => b.date.getTime() - a.date.getTime())
    }
    
    // 선택된 날짜의 회고만 필터링
    const dayReflections = filteredReflections.filter(r => isSameDay(r.date, selectedDate))
    return dayReflections.length > 0 
      ? dayReflections.sort((a, b) => b.date.getTime() - a.date.getTime())
      : [] // 회고가 없는 날을 클릭한 경우 빈 배열
  }, [selectedDate, reflections, showThisMonthOnly])

  const handleDateClick = async (date: Date) => {
    // 날짜 클릭 시 해당 날짜로 필터링
    setSelectedDate(date)
    setShowThisMonthOnly(false)
    setShowAll(false)
  }

  const handleThisMonthClick = () => {
    setSelectedDate(null)
    setShowThisMonthOnly(true)
    setShowAll(false)
    const today = new Date()
    setDisplayMonth(today)
  }

  const handleAllClick = () => {
    setSelectedDate(null)
    setShowThisMonthOnly(false)
    setShowAll(true)
  }

  const handleTodayClick = () => {
    const today = new Date()
    setSelectedDate(today)
    setDisplayMonth(today)
    setShowThisMonthOnly(false)
    setShowAll(false)
  }

  const handlePrevMonth = () => {
    if (!userCreatedAt) return
    const newDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1)
    // 사용자 생성일의 년도와 월을 기준으로 이전 달로 넘어가지 못하도록 제한
    const userCreatedYear = userCreatedAt.getFullYear()
    const userCreatedMonth = userCreatedAt.getMonth()
    const newYear = newDate.getFullYear()
    const newMonth = newDate.getMonth()
    
    // 생성일 이전 달이면 이동하지 않음
    if (newYear < userCreatedYear || (newYear === userCreatedYear && newMonth < userCreatedMonth)) {
      return
    }
    setDisplayMonth(newDate)
    setSelectedDate(null)
    setShowThisMonthOnly(false)
    setShowAll(false)
  }

  const handleNextMonth = () => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))
    setSelectedDate(null)
    setShowThisMonthOnly(false)
    setShowAll(false)
  }

  const formatDateWithDay = (date: Date) => {
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
    const dayName = dayNames[date.getDay()]
    return `${format(date, "yyyy.MM.dd.")} ${dayName}`
  }

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
          <h2 className="text-lg font-semibold text-foreground mb-1">내가 기록한 회고</h2>
          <p className="text-sm text-foreground/70">스터디하면서 작성한 회고를 볼 수 있어요</p>
        </div>

        {/* Main Content */}
        <main className={`relative w-full flex gap-4 ${isMobile ? "flex-col" : "flex-1 min-h-0"}`}>
          {/* 미니 캘린더 사이드바 */}
          <div
            className={`${isMobile ? "w-full order-1" : "w-64 shrink-0"} bg-black/5 p-4 shadow-xl border border-black/10 rounded-xl opacity-0 ${isLoaded ? "animate-fade-in" : ""} flex flex-col`}
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
                        className="p-1 rounded-full hover:bg-black/10 h-auto w-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handlePrevMonth}
                        disabled={!userCreatedAt || (displayMonth.getFullYear() === userCreatedAt.getFullYear() && displayMonth.getMonth() === userCreatedAt.getMonth())}
                      >
                        <ChevronLeft className="h-4 w-4 text-foreground" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="p-1 rounded-full hover:bg-black/10 h-auto w-auto cursor-pointer"
                        onClick={handleNextMonth}
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

                    {calendarData.map((dayData, i) => {
                      // 현재 월이 아닌 날짜는 빈 칸으로 표시
                      if (!dayData.isCurrentMonth) {
                        return <div key={i} className="w-7 h-7"></div>
                      }
                      
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleDateClick(dayData.date)}
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
                          {/* 회고 마커 */}
                          {dayData.hasReflection && (
                            <div 
                              className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${
                                dayData.isSelected ? "bg-[#2c5f2d]" : "bg-[#2c5f2d]"
                              }`}
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 오늘 및 이번 달 버튼 */}
                <div className="mt-4 flex gap-2">
                  <Button
                    className="flex-1 text-foreground hover:opacity-90 cursor-pointer"
                    style={{
                      backgroundColor: "#e5e7eb",
                    }}
                    onClick={handleTodayClick}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    오늘
                  </Button>
                  <Button
                    className="flex-1 text-foreground hover:opacity-90 cursor-pointer"
                    style={{
                      backgroundColor: showThisMonthOnly ? "#d1d5db" : "#e5e7eb",
                    }}
                    onClick={handleThisMonthClick}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    이번 달
                  </Button>
                </div>

                {/* 전체 버튼 */}
                <div className="mt-2">
                  <Button
                    className="w-full text-white hover:opacity-90 cursor-pointer"
                    style={{
                      backgroundColor: "hsl(121, 37%, 27%)",
                    }}
                    onClick={handleAllClick}
                  >
                    전체
                  </Button>
                </div>
              </div>
            </CustomScrollbar>
          </div>

          {/* 회고 카드 영역 */}
          <div className={`${isMobile ? "w-full order-2" : "flex-1"} flex flex-col opacity-0 ${isLoaded ? "animate-fade-in" : ""}`} style={{ animationDelay: "0.6s" }}>
            <CustomScrollbar className="flex-1 overflow-y-auto min-h-0">
              <div className="space-y-4">
                {/* 로딩 상태 */}
                {isLoading ? (
                  <div className="bg-gray-800 rounded-xl p-6 shadow-lg text-white text-center">
                    <p className="text-white/70">회고를 불러오는 중...</p>
                  </div>
                ) : displayedReflections.length > 0 ? (
                  displayedReflections.map((reflection) => (
                    <div key={reflection.id} className="bg-gray-800 rounded-xl p-6 shadow-lg text-white">
                      {/* 작성자 및 날짜 */}
                      <div className="flex items-center gap-2 mb-3">
                        {reflection.authorAvatar ? (
                          <img
                            src={reflection.authorAvatar}
                            alt={reflection.authorName}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="text-xs">{reflection.authorName.charAt(0)}</span>
                          </div>
                        )}
                        <span className="text-sm text-white/80">{reflection.authorName}</span>
                        <span className="text-sm text-white/60">{formatDateWithDay(reflection.date)}</span>
                        {/* 포커스 점수 표시 */}
                        {reflection.focusScore !== null && reflection.focusScore !== undefined && (
                          <div className="flex items-center gap-0.5 ml-auto">
                            {[1, 2, 3, 4, 5].map((value) => (
                              <Star
                                key={value}
                                className="w-4 h-4"
                                fill={value <= reflection.focusScore! ? "#facc15" : "transparent"}
                                stroke={value <= reflection.focusScore! ? "#facc15" : "#9ca3af"}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 스터디 이름 및 세션 정보 */}
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        {reflection.roomName && (
                          <span className="text-xs text-white/70 px-2 py-1 rounded-md bg-white/10">
                            {reflection.roomName}
                          </span>
                        )}
                        {reflection.sessionId !== undefined && reflection.sessionId !== null && (
                          <span className="text-xs text-white/70 px-2 py-1 rounded-md bg-white/10">
                            {reflection.sessionId}번째 세션
                          </span>
                        )}
                      </div>

                      {/* 회고 내용 */}
                      <p className="text-sm text-white/90 whitespace-pre-line leading-relaxed mb-3">
                        {reflection.content}
                      </p>

                      {/* 회고 이미지 */}
                      {reflection.imageUrl && (
                        <div className="mt-3 rounded-lg overflow-hidden border border-white/20 shadow-sm cursor-pointer hover:opacity-90 transition-opacity group">
                          <img
                            src={reflection.imageUrl}
                            alt="회고 이미지"
                            className="w-full h-auto object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = "none"
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))
                ) : selectedDate ? (
                  /* 회고가 없는 날을 클릭한 경우 */
                  <div className="bg-gray-800 rounded-xl p-6 shadow-lg text-white text-center">
                    <p className="text-white/70 text-sm">이 날짜에는 회고가 없습니다.</p>
                  </div>
                ) : (
                  /* 초기 화면에서 작성한 회고가 없는 경우 */
                  <div className="bg-gray-800 rounded-xl p-6 shadow-lg text-white text-center">
                    <p className="text-white/70 mb-2 text-sm">아직 작성한 회고가 없어요</p>
                    <p className="text-white/60 text-xs">스터디룸에서 학습 이후 회고를 작성해보세요</p>
                  </div>
                )}
              </div>
            </CustomScrollbar>
          </div>
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
            
            {/* 일정 탭 */}
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
              <span className="text-[10px] font-medium">일정</span>
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
    </div>
  )
}
