"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { CheckCircle2, Circle, Clock, Home } from "lucide-react"
import { Reflection } from "@/components/ui/reflection"
import {
  getRoomReflections,
  getMyRoomReflections,
  getTodayRoomFocusTime,
  ReflectionResponse,
  getPlansByDate,
  PlanResponse,
  EventColor,
} from "@/lib/api"

// 초를 시간:분 형식으로 변환하는 함수
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}시간 ${minutes}분`
  }
  return `${minutes}분`
}

// 초를 00:00 형식으로 변환하는 함수
const formatTimeHHMM = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

interface Goal {
  id: number
  title: string
  timeRange: string
  completed: boolean
  colorClass: string
}

const colors = {
  // 시스템 primary 그린 팔레트
  main: "#2c5f2d",
  text: "rgba(45, 74, 62, 0.95)",
  textLight: "rgba(45, 74, 62, 0.7)",
  shadow: "rgba(45, 74, 62, 0.35)",
}

function SessionSummaryPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoaded, setIsLoaded] = useState(false)
  const [displayedTime, setDisplayedTime] = useState(0)
  const [showSection1, setShowSection1] = useState(false)
  const [showSection2, setShowSection2] = useState(false)
  const [showSection3, setShowSection3] = useState(false)
  const [showSection4, setShowSection4] = useState(false)
  const [goals, setGoals] = useState<Goal[]>([])
  const [reflections, setReflections] = useState<Array<{
    id: number
    authorName: string
    authorAvatar?: string
    content: string
    images?: string[]
    timestamp: Date
    focusScore?: number | null
    sessionId?: number
  }>>([])
  const [myReflections, setMyReflections] = useState<Array<{
    id: number
    authorName: string
    authorAvatar?: string
    content: string
    images?: string[]
    timestamp: Date
    focusScore?: number | null
    sessionId?: number
  }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [todayStudyTime, setTodayStudyTime] = useState<number | null>(null) // 초 단위

  // roomId 및 토큰 가져오기
  const roomIdParam = searchParams?.get("roomId")
  const tokenParam = searchParams?.get("token")
  const roomId = roomIdParam || null // UUID는 문자열로 처리

  // 세션 요약 페이지 접근 제어 (프론트 전용)
  useEffect(() => {
    // 세션 요약 페이지는 방에서 나갈 때만 접근 가능해야 하므로
    // 방 페이지에서 sessionStorage에 저장한 토큰과 쿼리 파라미터의 토큰을 함께 검증
    const storedToken = sessionStorage.getItem("sessionSummaryToken")

    const isInvalid =
      !roomIdParam ||
      !roomId ||
      !tokenParam ||
      !storedToken ||
      tokenParam !== storedToken

    if (isInvalid) {
      // 직접 URL을 입력했거나 허용되지 않은 접근 -> 홈으로 리다이렉트
      router.replace("/")
    }
  }, [roomId, roomIdParam, tokenParam, router])

  // API에서 목표와 회고 데이터 가져오기
  useEffect(() => {
    const fetchData = async () => {
      if (!roomId) {
        setIsLoading(false)
        return
      }

      try {
        // 오늘 학습 시간 조회 (분 단위 → 초 단위로 변환)
        try {
          const focusMinutes = await getTodayRoomFocusTime(roomId)
          if (typeof focusMinutes === "number" && !Number.isNaN(focusMinutes)) {
            setTodayStudyTime(focusMinutes * 60)
          } else {
            setTodayStudyTime(0)
          }
        } catch (error) {
          console.error("오늘 학습 시간 조회 실패:", error)
          setTodayStudyTime(0)
        }

        // 오늘 날짜 기준 일정(계획) 조회
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, "0")
        const day = String(today.getDate()).padStart(2, "0")
        const todayStr = `${year}-${month}-${day}`

        const plansData = await getPlansByDate(todayStr)

        const mapEventColorToColorClass = (eventColor: EventColor): string => {
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

        const formattedGoals: Goal[] = plansData.map((plan: PlanResponse) => ({
          id: plan.id,
          title: plan.title,
          // 시간은 HH:mm 형식만 사용 (초 제거)
          timeRange: `${plan.startTime.slice(0, 5)} ~ ${plan.endTime.slice(0, 5)}`,
          completed: plan.completed,
          colorClass: mapEventColorToColorClass(plan.color),
        }))
        setGoals(formattedGoals)

        // 회고 조회 (방 전체 + 내가 작성한 회고)
        const [reflectionsData, myReflectionsData] = await Promise.all([
          getRoomReflections(roomId),
          getMyRoomReflections(roomId),
        ])
        const formattedReflections = reflectionsData.map((reflection: ReflectionResponse) => ({
          id: reflection.reflectionId,
          authorName: reflection.nickname,
          authorAvatar: reflection.userProfileUrl || undefined,
          content: reflection.content,
          images: reflection.imageUrl ? [reflection.imageUrl] : [],
          timestamp: new Date(reflection.createdAt),
          focusScore: reflection.focusScore,
          sessionId: reflection.sessionId,
        }))
        formattedReflections.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        setReflections(formattedReflections)

        const formattedMyReflections = myReflectionsData.map((reflection: ReflectionResponse) => ({
          id: reflection.reflectionId,
          authorName: reflection.nickname,
          authorAvatar: reflection.userProfileUrl || undefined,
          content: reflection.content,
          images: reflection.imageUrl ? [reflection.imageUrl] : [],
          timestamp: new Date(reflection.createdAt),
          focusScore: reflection.focusScore,
          sessionId: reflection.sessionId,
        }))
        formattedMyReflections.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        setMyReflections(formattedMyReflections)
      } catch (error) {
        console.error('데이터 로딩 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [roomId])

  const completedGoals = goals.filter((g) => g.completed)
  const uncompletedGoals = goals.filter((g) => !g.completed)
  const completionRate = goals.length > 0 ? Math.round((completedGoals.length / goals.length) * 100) : 0

  // 브라우저 뒤로가기 방지
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault()
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

  // 페이지 전체 페이드인
  useEffect(() => {
    setIsLoaded(true)
  }, [])

  // 상단 학습 시간 숫자 카운트업 애니메이션
  useEffect(() => {
    if (todayStudyTime === null) return

    const totalSeconds = todayStudyTime
    if (totalSeconds <= 0) {
      setDisplayedTime(0)
      setShowSection1(true)
      setTimeout(() => setShowSection2(true), 300)
      setTimeout(() => setShowSection3(true), 600)
      setTimeout(() => setShowSection4(true), 900)
      return
    }

    const step = Math.max(1, Math.ceil(totalSeconds / 30)) // 약 30번 정도에 걸쳐 증가

    const timer = setInterval(() => {
      setDisplayedTime((prev) => {
        if (prev >= totalSeconds) {
          clearInterval(timer)
          setShowSection1(true)
          setTimeout(() => setShowSection2(true), 300)
          setTimeout(() => setShowSection3(true), 600)
          setTimeout(() => setShowSection4(true), 900)
          return totalSeconds
        }
        return prev + step
      })
    }, 30)

    return () => clearInterval(timer)
  }, [todayStudyTime])

  return (
    <div
      className="min-h-screen flex items-stretch justify-center p-6 md:p-10"
      style={{
        backgroundColor: "#fff8ea",
        transition: "opacity 0.5s ease-in",
        opacity: isLoaded ? 1 : 0,
      }}
    >
      <div className="relative z-10 flex w-full max-w-2xl flex-col">
        {/* 오늘 공부한 시간 - 가장 위 */}
        <section
          className="mb-6 rounded-3xl bg-gradient-to-br from-white/80 via-white/65 to-white/45 backdrop-blur-3xl border border-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.14)] px-8 py-10 transition-all duration-700 ease-out"
          style={{
            opacity: showSection1 ? 1 : 0,
            transform: showSection1 ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Clock className="w-6 h-6" style={{ color: colors.main }} />
            <h2 className="text-lg font-semibold font-sans" style={{ color: colors.text }}>
              오늘의 학습 시간
            </h2>
          </div>
          
          {/* 학습 시간만 중앙에 표시 */}
          <div className="flex items-center justify-center mb-2 py-4">
            <div className="text-5xl font-bold font-sans tabular-nums transition-all duration-300" style={{ color: colors.main }}>
              {formatTime(displayedTime)}
            </div>
          </div>
        
        </section>

        {/* 목표 달성 현황 */}
        <section
          className="mb-4 transition-all duration-700 ease-out"
          style={{
            opacity: showSection2 ? 1 : 0,
            transform: showSection2 ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold font-sans" style={{ color: colors.text }}>
              오늘의 일정
            </h2>
            <p className="text-xs font-sans mt-1" style={{ color: colors.textLight }}>
              오늘 완료한 일정과 완료하지 못한 일정을 확인해보세요
            </p>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-white/80 via-white/65 to-white/45 backdrop-blur-3xl border border-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.14)] px-6 py-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  background: colors.main,
                  boxShadow: `0 0 10px ${colors.shadow}`,
                }}
              />
              <h3 className="text-base font-semibold font-sans" style={{ color: colors.text }}>
                일정
              </h3>
              <span className="text-xs font-sans ml-auto" style={{ color: colors.textLight }}>
                완료율 {completionRate}%
              </span>
            </div>

            <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="text-xs font-sans" style={{ color: colors.textLight }}>
                  로딩 중...
                </div>
              </div>
            ) : goals.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <div className="text-xs font-sans" style={{ color: colors.textLight }}>
                  등록된 일정이 없습니다
                </div>
              </div>
            ) : (
              <>
                {/* 완료한 일정 */}
                {completedGoals.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4" style={{ color: colors.main }} />
                      <span className="text-xs font-medium font-sans" style={{ color: colors.text }}>
                        완료한 일정 ({completedGoals.length}개)
                      </span>
                    </div>
                    <div className="space-y-2 pl-6">
                      {completedGoals.map((goal, index) => (
                        <div
                          key={goal.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-white/60 transition-all duration-500 ease-out ${goal.colorClass} bg-opacity-10`}
                          style={{
                            backdropFilter: "blur(10px)",
                            opacity: showSection2 ? 1 : 0,
                            transform: showSection2 ? "translateX(0)" : "translateX(-20px)",
                            transitionDelay: `${index * 100}ms`,
                          }}
                        >
                          <div className="flex flex-col">
                            <span
                              className="text-[11px] font-sans"
                              style={{ color: "rgba(255,255,255,0.85)" }}
                            >
                              {goal.timeRange}
                            </span>
                            <span
                              className="text-xs font-sans font-semibold line-through"
                              style={{ color: "rgba(255,255,255,0.9)" }} // 완료된 일정은 흰색 + 취소선
                            >
                              {goal.title}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 완료하지 못한 일정 */}
                {uncompletedGoals.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Circle className="w-4 h-4" style={{ color: colors.textLight }} />
                      <span className="text-xs font-medium font-sans" style={{ color: colors.textLight }}>
                        완료하지 못한 일정 ({uncompletedGoals.length}개)
                      </span>
                    </div>
                    <div className="space-y-2 pl-6">
                      {uncompletedGoals.map((goal, index) => (
                        <div
                          key={goal.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-white/40 transition-all duration-500 ease-out ${goal.colorClass} bg-opacity-10`}
                          style={{
                            backdropFilter: "blur(10px)",
                            opacity: showSection2 ? 0.9 : 0,
                            transform: showSection2 ? "translateX(0)" : "translateX(-20px)",
                            transitionDelay: `${(completedGoals.length + index) * 100}ms`,
                          }}
                        >
                          <div className="flex flex-col">
                            <span
                              className="text-[11px] font-sans"
                              style={{ color: "rgba(255,255,255,0.85)" }}
                            >
                              {goal.timeRange}
                            </span>
                            <span
                              className="text-xs font-sans font-semibold"
                              style={{ color: "rgba(255,255,255,0.95)" }} // 미완료 일정 제목은 진한 흰색
                            >
                              {goal.title}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        </section>

        {/* 참여자들의 회고 */}
        <section
          className="mb-4 transition-all duration-700 ease-out"
          style={{
            opacity: showSection3 ? 1 : 0,
            transform: showSection3 ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold font-sans" style={{ color: colors.text }}>
              함께 공부한 친구들의 회고
            </h2>
            <p className="text-xs font-sans mt-1" style={{ color: colors.textLight }}>
              같은 세션 동안 공부한 사람들의 회고를 확인해보세요
            </p>
          </div>
          <div className="h-[28rem]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-xs font-sans" style={{ color: colors.textLight }}>
                  로딩 중...
                </div>
              </div>
            ) : (
              <Reflection initialReflections={reflections} showBorder={false} showHeader={false} />
            )}
          </div>
        </section>

        {/* 내 회고 */}
        <section
          className="mb-4 transition-all duration-700 ease-out"
          style={{
            opacity: showSection3 ? 1 : 0,
            transform: showSection3 ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold font-sans" style={{ color: colors.text }}>
              내가 이 방에서 작성한 회고
            </h2>
            <p className="text-xs font-sans mt-1" style={{ color: colors.textLight }}>
              이 방에서 작성한 내 회고를 확인해보세요
            </p>
          </div>
          <div className="h-[28rem]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-xs font-sans" style={{ color: colors.textLight }}>
                  로딩 중...
                </div>
              </div>
            ) : (
              <Reflection initialReflections={myReflections} showBorder={false} showHeader={false} />
            )}
          </div>
        </section>

        {/* 수고했다는 메시지 */}
        <section
          className="rounded-3xl bg-gradient-to-br from-white/70 via-white/45 to-white/25 backdrop-blur-3xl border border-white/60 shadow-[0_24px_80px_rgba(0,0,0,0.16)] px-8 py-10 flex flex-col items-center text-center transition-all duration-700 ease-out"
          style={{
            opacity: showSection4 ? 1 : 0,
            transform: showSection4 ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
          }}
        >
          <div
            className="text-2xl font-bold font-sans mb-2 transition-all duration-500"
            style={{
              color: colors.main,
              transform: showSection4 ? "scale(1)" : "scale(0.8)",
            }}
          >
            🎉 수고하셨습니다! 🎉
          </div>
          <p className="text-sm font-sans mb-6" style={{ color: "#111827" }}>
            오늘도 정말 열심히 공부하셨군요, 정말 대단해요!
            <br />
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-8 py-3 rounded-full font-sans font-medium text-sm transition-all duration-300 hover:scale-105 cursor-pointer flex items-center gap-2"
            style={{
              background: colors.main,
              color: "white",
              boxShadow: `0 8px 32px ${colors.shadow}`,
            }}
          >
            <Home className="w-4 h-4" />
            홈으로 돌아가기
          </button>
        </section>
      </div>
    </div>
  )
}

export default function SessionSummaryPage() {
  return (
    <Suspense fallback={null}>
      <SessionSummaryPageInner />
    </Suspense>
  )
}
