"use client"

import { useState, useEffect, Suspense, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
// 큰 컴포넌트들을 동적 import로 지연 로딩
const PomodoroDialStatic = dynamic(() => import("@/components/ui/pomodoro-dial-static").then((mod) => mod.PomodoroDialStatic), {
  ssr: false,
})
const FlipTimerStatic = dynamic(() => import("@/components/ui/flip-timer-static").then((mod) => mod.FlipTimerStatic), {
  ssr: false,
})
import { DoorOpen, Plus, Search, User, Lock, X, Trophy, HelpCircle, Clock, ChevronLeft, ChevronRight, RefreshCw, Home } from "lucide-react"
const CustomScrollbar = dynamic(() => import("@/components/ui/custom-scrollbar").then((mod) => mod.CustomScrollbar), { ssr: false })
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { logoutApi, createStudyRoom, ApiError, getStudyRooms, StudyRoomListResponse, StudyRoomStatus, TimerType, getCurrentUser, getParticipateRoomInfo } from "@/lib/api"
import { showSuccessNotification } from "@/lib/system-notification"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

// 큰 컴포넌트들을 동적 import로 지연 로딩하여 초기 번들 크기 감소
const LoginModal = dynamic(() => import("@/components/login-modal").then((mod) => mod.LoginModal), {
  ssr: false,
})

const UserInfoDialog = dynamic(() => import("@/components/ui/user-info-dialog").then((mod) => mod.UserInfoDialog), {
  ssr: false,
})

const UserStudyRecordsDialog = dynamic(
  () => import("@/components/ui/user-study-records-dialog").then((mod) => mod.UserStudyRecordsDialog),
  { ssr: false }
)

// 프론트엔드에서 사용하는 RoomStatus 타입 (백엔드 StudyRoomStatus와 매핑)
type RoomStatus = "before_start" | "focus" | "break" | "session_end"

interface StudyRoom {
  id: number
  name: string
  status: RoomStatus
  participants: number
  totalParticipants: number
  isPrivate?: boolean
  hashtags?: string[]
  totalSessions: number
  currentSession: number
  focusMinutes: number
  breakMinutes: number
}

// 백엔드 StudyRoomStatus를 프론트엔드 RoomStatus로 변환
function mapStatus(backendStatus: StudyRoomStatus): RoomStatus {
  switch (backendStatus) {
    case StudyRoomStatus.WAITING:
      return "before_start"
    case StudyRoomStatus.FOCUS:
      return "focus"
    case StudyRoomStatus.BREAK:
      return "break"
    case StudyRoomStatus.FINISHED:
      return "session_end"
    default:
      return "before_start"
  }
}

// 백엔드 응답을 프론트엔드 StudyRoom으로 변환
function mapToStudyRoom(response: StudyRoomListResponse): StudyRoom {
  return {
    id: response.roomId,
    name: response.title,
    status: mapStatus(response.status),
    participants: response.currentParticipants,
    totalParticipants: response.maxParticipants,
    isPrivate: response.secret,
    hashtags: response.hashtags,
    totalSessions: response.totalSessions,
    currentSession: response.currentSession,
    focusMinutes: response.focusMinutes,
    breakMinutes: response.breakMinutes,
  }
}

function HomePageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoggedIn, setIsLoggedIn] = useState(false) // 로그인 상태 관리
  const [user, setUser] = useState<{ id: number; username: string; nickname: string; profileUrl: string | null; role: string } | null>(null) // 사용자 정보
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false) // 로그인 모달 상태
  const [isUserInfoDialogOpen, setIsUserInfoDialogOpen] = useState(false) // 내 정보 다이얼로그 상태
  const [isLoaded, setIsLoaded] = useState(false)
  const [showHeader, setShowHeader] = useState(false)
  const [showRooms, setShowRooms] = useState(false)
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
  const [currentPage, setCurrentPage] = useState(0) // 현재 페이지 (0부터 시작)
  const [studyRooms, setStudyRooms] = useState<StudyRoom[]>([]) // 스터디룸 목록
  const [totalPages, setTotalPages] = useState(0) // 전체 페이지 수
  const [totalRooms, setTotalRooms] = useState(0) // 전체 방 개수
  const [isLoadingRooms, setIsLoadingRooms] = useState(false) // 로딩 상태
  const [isCreateRoomDialogOpen, setIsCreateRoomDialogOpen] = useState(false) // 방 생성 다이얼로그 상태
  const [selectedRoom, setSelectedRoom] = useState<StudyRoom | null>(null) // 선택된 스터디
  const [isEnterDialogOpen, setIsEnterDialogOpen] = useState(false) // 입장 다이얼로그 상태
  const [isLoginRequiredDialogOpen, setIsLoginRequiredDialogOpen] = useState(false) // 로그인 필요 다이얼로그 상태
  const [isUserStudyDialogOpen, setIsUserStudyDialogOpen] = useState(false) // 공부 기록 다이얼로그 상태
  
  // 방 생성 폼 상태
  const [roomName, setRoomName] = useState("")
  const [hashtagInput, setHashtagInput] = useState("")
  const [hashtags, setHashtags] = useState<string[]>([])
  const [totalSessions, setTotalSessions] = useState(4)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [maxParticipants, setMaxParticipants] = useState(10)
  const [isPrivate, setIsPrivate] = useState(false)
  const [roomPassword, setRoomPassword] = useState("")
  const [timerType, setTimerType] = useState<TimerType>(TimerType.POMODORO)
  
  // 에러 상태 관리
  const [errors, setErrors] = useState({
    roomName: false,
    totalSessions: false,
    breakMinutes: false,
    maxParticipants: false,
    roomPassword: false,
  })

  // 해시태그 추가 함수
  const handleAddHashtag = () => {
    let tag = hashtagInput.trim()
    
    // 빈 값이면 추가하지 않음
    if (!tag) {
      return
    }
    
    // #이 없으면 자동으로 추가
    if (!tag.startsWith("#")) {
      tag = "#" + tag
    }
    
    // 이미 존재하는 해시태그면 추가하지 않음
    if (hashtags.includes(tag)) {
      setHashtagInput("")
      return
    }
    
    // 해시태그 추가
    setHashtags([...hashtags, tag])
    setHashtagInput("")
  }

  // 해시태그 삭제 함수
  const handleRemoveHashtag = (tagToRemove: string) => {
    setHashtags(hashtags.filter(tag => tag !== tagToRemove))
  }

  // 해시태그 입력 엔터 처리
  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault()
      e.stopPropagation()
      handleAddHashtag()
    }
  }

  // 페이지 로드 시 로그인 상태 복원
  useEffect(() => {
    // localStorage에서 accessToken 확인 후 /api/auth/me 로 사용자 정보 조회
    const accessToken = localStorage.getItem("accessToken")
    
    if (accessToken) {
      ;(async () => {
        try {
          const me = await getCurrentUser()
          setIsLoggedIn(true)
          setUser(me)
        } catch (error) {
          console.error("Failed to restore user from token:", error)
          localStorage.removeItem("accessToken")
        }
      })()
    }
  }, [])

  // roomId 쿼리 파라미터 확인 및 로그인 필요 다이얼로그 표시
  useEffect(() => {
    const roomIdParam = searchParams.get("roomId")
    if (roomIdParam && !isLoggedIn) {
      // roomId가 있고 로그인하지 않았으면 로그인 필요 다이얼로그 표시
      setIsLoginRequiredDialogOpen(true)
    }
  }, [searchParams, isLoggedIn])

  // 마지막으로 참여한 방이 있다면 자동 복귀 (백엔드 API 기반)
  useEffect(() => {
    if (!isLoggedIn) return

    // 이미 특정 roomId로 진입하려는 경우에는 자동 복귀 스킵
    const roomIdParam = searchParams.get("roomId")
    if (roomIdParam) return

    ;(async () => {
      try {
        const info = await getParticipateRoomInfo()
        if (!info || !info.lastRoomId) return

        router.replace(`/room?roomId=${info.lastRoomId}`)
      } catch (error) {
        console.error("Failed to redirect to participate room:", error)
      }
    })()
  }, [isLoggedIn, searchParams, router])

  // 스터디룸 목록 조회
  const fetchStudyRooms = useCallback(async () => {
    setIsLoadingRooms(true)
    try {
      const response = await getStudyRooms(currentPage)
      const rooms = response.content.map(mapToStudyRoom)
      setStudyRooms(rooms)
      setTotalPages(response.totalPages)
      setTotalRooms(response.totalElements)
    } catch (error) {
      console.error("Failed to fetch study rooms:", error)
      setStudyRooms([])
      setTotalPages(0)
      setTotalRooms(0)
    } finally {
      setIsLoadingRooms(false)
    }
  }, [currentPage])

  useEffect(() => {
    fetchStudyRooms()
  }, [fetchStudyRooms])

  // 로딩 애니메이션 효과
  useEffect(() => {
    setIsLoaded(true)
    setTimeout(() => setShowHeader(true), 100)
    setTimeout(() => setShowRooms(true), 300)
  }, [])

  // 배너 자동 전환 (5초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev === 0 ? 1 : 0))
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="min-h-screen flex items-stretch justify-center px-6 pt-3 pb-20 md:px-10 md:pt-4 md:pb-24"
      style={{
        // 가장 뒷 배경을 베이지 색으로 설정
        backgroundColor: "#fff8ea",
        transition: "opacity 0.5s ease-in",
        opacity: isLoaded ? 1 : 0,
      }}
    >
      {/* Header + Main content wrapper */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col gap-4">
        {/* Header */}
        <header
          className="relative flex items-center justify-between gap-4 py-3 text-xs md:text-sm text-black transition-all duration-700 ease-out h-[50px]"
          style={{
            opacity: showHeader ? 1 : 0,
            transform: showHeader ? "translateY(0)" : "translateY(-20px)",
          }}
        >
          {/* Left: 사이트 로고 */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 md:gap-3 cursor-pointer flex-shrink-0"
          >
            <Image
              src="/images/home_icon.png"
              alt="홈으로 이동"
              width={64}
              height={64}
              className="w-10 h-10 md:w-16 md:h-16 object-contain"
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))",
              }}
              priority
            />
            <span
              className="text-lg md:text-2xl font-bold font-service-name"
              style={{
                letterSpacing: "0.05em",
                color: "#2c5f2d",
              }}
            >
              뽀개더
            </span>
          </button>

          {/* Right: 로그인 버튼 (로그인하지 않은 경우만 표시) */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {!isLoggedIn && (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-4 py-2 rounded-full border border-black/10 bg-white text-xs md:text-sm font-semibold text-black shadow-sm hover:bg-black/5 transition-colors"
              >
                로그인
              </button>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex w-full">
          {/* Hero + room list */}
          <section className="flex-1 flex flex-col gap-6">
            {/* 배너 캐러셀 */}
            <div className="relative w-full overflow-hidden rounded-3xl h-[120px] md:h-[150px]">
              <div
                className="flex transition-transform duration-500 ease-in-out h-full"
                style={{
                  transform: `translateX(-${currentBannerIndex * 100}%)`,
                }}
              >
                {/* 첫 번째 배너 */}
                <div className="w-full h-full flex-shrink-0">
                  <Image
                    src="/banners/banner_main.png"
                    alt="배너 1"
                    width={1200}
                    height={300}
                    className="w-full h-full object-contain md:object-cover"
                    priority
                  />
                </div>
                {/* 두 번째 배너 */}
                <div className="w-full h-full flex-shrink-0">
                  <Image
                    src="/banners/banner_new_year.png"
                    alt="배너 2"
                    width={1200}
                    height={300}
                    className="w-full h-full object-contain md:object-cover"
                  />
                </div>
              </div>

              {/* 배너 인디케이터 */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <button
                  onClick={() => setCurrentBannerIndex(0)}
                  className={`h-2 rounded-full transition-all ${
                    currentBannerIndex === 0 ? "bg-black w-6" : "bg-black/30 w-2"
                  }`}
                  aria-label="첫 번째 배너"
                />
                <button
                  onClick={() => setCurrentBannerIndex(1)}
                  className={`h-2 rounded-full transition-all ${
                    currentBannerIndex === 1 ? "bg-black w-6" : "bg-black/30 w-2"
                  }`}
                  aria-label="두 번째 배너"
                />
              </div>
            </div>

            {/* Room list */}
            <section
              className="rounded-3xl bg-white/40 backdrop-blur-3xl border-2 border-[#2c5f2d] shadow-[0_18px_60px_rgba(0,0,0,0.15)] px-4 py-5 md:px-6 md:py-6 flex flex-col gap-4 transition-all duration-700 ease-out"
              style={{
                opacity: showRooms ? 1 : 0,
                transform: showRooms ? "translateY(0)" : "translateY(20px)",
                minHeight: "400px",
              }}
            >
              <header className="flex flex-col gap-3 px-2">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="flex-1 w-full md:w-auto">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-base md:text-lg font-semibold text-black">
                        진행 중인 스터디
                      </h2>
                    </div>
                    {/* 상태 색상 설명 */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: "#22c55e" }}
                        />
                        <span className="text-xs text-black/60">시작 전</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: "#d2001a" }}
                        />
                        <span className="text-xs text-black/60">집중 시간</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: "#f59e0b" }}
                        />
                        <span className="text-xs text-black/60">쉬는 시간</span>
                      </div>
                    </div>
                  </div>
                  {/* 오른쪽 상단: 총 방 개수와 검색창 */}
                  <div className="flex flex-col items-start md:items-end gap-2 md:gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                      <span className="text-xs md:text-sm text-black/60 whitespace-nowrap">
                        총 {totalRooms}개 방
                      </span>
                      <button
                        type="button"
                        onClick={fetchStudyRooms}
                        disabled={isLoadingRooms}
                        className="flex items-center justify-center h-8 w-8 rounded-full border border-primary/40 bg-primary text-xs text-white shadow-[0_8px_20px_rgba(44,95,45,0.45)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                        aria-label="스터디 목록 새로고침"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${isLoadingRooms ? "animate-spin" : ""}`}
                        />
                      </button>
                    </div>
                    {/* 검색창 */}
                    <div className="relative w-full md:w-[240px] lg:w-[280px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black/60" />
                      <input
                        type="text"
                        placeholder="스터디 이름이나 태그로 검색해보세요!"
                        className="w-full rounded-full bg-transparent border border-black/10 py-1.5 pl-8 pr-3 text-xs text-black placeholder:text-black/40 outline-none shadow-sm focus:bg-white focus:border-black/30 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {isLoadingRooms ? (
                  <div className="col-span-full text-center py-8 text-xs md:text-sm text-black/60">
                    로딩 중...
                  </div>
                ) : studyRooms.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-xs md:text-sm text-black/60">
                    등록된 스터디룸이 없습니다.
                  </div>
                ) : (
                  studyRooms.map((room, index) => {
                  // 상태별 스타일 및 텍스트 설정
                  const getStatusConfig = (status: RoomStatus) => {
                    switch (status) {
                      case "before_start":
                        return {
                          text: "시작 전",
                          bgColor: "#22c55e",
                          textColor: "white",
                          indicatorColor: "bg-white",
                          shadow: "none",
                          hasAnimation: false,
                        }
                      case "focus":
                        return {
                          text: "집중 시간",
                          bgColor: "#d2001a",
                          textColor: "white",
                          indicatorColor: "bg-white",
                          shadow: "none",
                          hasAnimation: false,
                        }
                      case "break":
                        return {
                          text: "쉬는 시간",
                          bgColor: "#f59e0b",
                          textColor: "white",
                          indicatorColor: "bg-white",
                          shadow: "none",
                          hasAnimation: false,
                        }
                      case "session_end":
                        return {
                          text: "세션 종료",
                          bgColor: "#9ca3af",
                          textColor: "white",
                          indicatorColor: "bg-white opacity-50",
                          shadow: "none",
                          hasAnimation: false,
                        }
                    }
                  }

                  const statusConfig = getStatusConfig(room.status)
                  
                  return (
                    <Card
                      key={room.id}
                      className="group border bg-gradient-to-br from-white/50 via-white/40 to-white/25 backdrop-blur-2xl hover:-translate-y-0.5 cursor-pointer h-full flex flex-col"
                      style={{ borderColor: "#d1d1d1" }}
                      style={{
                        opacity: showRooms ? 1 : 0,
                        transform: showRooms ? "translateY(0)" : "translateY(20px)",
                        transitionProperty: "transform, box-shadow, opacity",
                        transitionDuration: "0.3s",
                        transitionTimingFunction: "ease-out",
                        transitionDelay: `${700 + index * 100}ms`,
                        minHeight: "140px",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transition = "background-color 0.15s ease-out"
                        e.currentTarget.style.backgroundColor = "rgba(197, 212, 192, 0.3)"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transition = "background-color 0.15s ease-out"
                        e.currentTarget.style.backgroundColor = ""
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedRoom(room)
                        setIsEnterDialogOpen(true)
                      }}
                    >
                      <CardHeader className="relative px-5 pb-3" style={{ minHeight: "60px" }}>
                        {/* 제목 */}
                        <div className="pr-20 flex items-center gap-2">
                          {/* 상태 인디케이터 - 제목 앞 */}
                          <span
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              statusConfig.hasAnimation ? "onair-indicator" : ""
                            }`}
                            style={{
                              backgroundColor: statusConfig.bgColor,
                              boxShadow: statusConfig.shadow === "none" ? "none" : statusConfig.shadow,
                            }}
                          />
                          <CardTitle className="text-sm md:text-base font-bold text-black line-clamp-2">
                            {room.name}
                          </CardTitle>
                          {room.isPrivate && (
                            <Lock className="h-4 w-4 text-black/60 flex-shrink-0" />
                          )}
                        </div>
                        {/* 참여 인원 - 오른쪽 상단 절대 위치 */}
                        <div className="absolute top-0 right-5 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/60 border border-white/70">
                          <User className="h-3.5 w-3.5 text-black/70" />
                          <span className="text-xs font-medium text-black/80">
                            {room.participants} / {room.totalParticipants}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 pt-0 pb-1" style={{ height: "60px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                        <div className="flex flex-col gap-2">
                          {/* 해시태그 */}
                          {room.hashtags && room.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {room.hashtags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 rounded-md text-[10px] md:text-xs font-medium"
                                  style={{
                                    background: "rgba(0, 0, 0, 0.05)",
                                    color: "rgba(0, 0, 0, 0.7)",
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* 구분선 - 전체 너비 */}
                          <div 
                            className="w-full"
                            style={{
                              borderTop: "1px solid rgba(0, 0, 0, 0.1)",
                              paddingTop: "2px",
                              height: "28px",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <div className="flex justify-between items-center w-full">
                              {/* 왼쪽: 집중/휴식 정보 또는 설정 전 */}
                              <div style={{ height: "24px", display: "flex", alignItems: "center" }}>
                                {room.status !== "before_start" ? (
                                  <span
                                    className="px-2 rounded-md text-xs md:text-sm font-medium"
                                    style={{
                                      background: "rgba(0, 0, 0, 0.05)",
                                      color: "rgba(0, 0, 0, 0.7)",
                                      paddingTop: "2px",
                                      paddingBottom: "2px",
                                    }}
                                  >
                                    {room.focusMinutes}분 집중 → {room.breakMinutes}분 휴식
                                  </span>
                                ) : (
                                  <span
                                    className="px-2 rounded-md text-xs md:text-sm font-medium"
                                    style={{
                                      background: "rgba(0, 0, 0, 0.05)",
                                      color: "rgba(0, 0, 0, 0.7)",
                                      paddingTop: "2px",
                                      paddingBottom: "2px",
                                    }}
                                  >
                                    설정 전
                                  </span>
                                )}
                              </div>
                              {/* 오른쪽: 세션 정보 */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs md:text-sm text-black/60">
                                  세션
                                </span>
                                <span className="text-sm md:text-base font-semibold text-black/80 tabular-nums">
                                  {room.currentSession} / {room.totalSessions}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                  })
                )}
              </div>
            </section>

            {/* 페이지네이션 */}
            {totalPages > 0 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                {/* 이전 페이지 화살표 */}
                {currentPage > 0 && (
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 hover:scale-110 border border-black"
                    aria-label="이전 페이지"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {/* 페이지 버튼들 */}
                {(() => {
                  const maxVisiblePages = 10
                  let startPage = 1
                  let endPage = Math.min(totalPages, maxVisiblePages)

                  // 현재 페이지가 10페이지 이상이면 화살표로 이동
                  if (currentPage + 1 >= maxVisiblePages) {
                    // 현재 페이지를 중심으로 앞뒤 4페이지씩 표시
                    startPage = Math.max(1, currentPage - 3)
                    endPage = Math.min(totalPages, currentPage + 6)
                  }

                  const pages = []
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(i)
                  }

                  return pages.map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page - 1)} // UI는 1부터, API는 0부터
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 hover:scale-110"
                      style={{
                        color: currentPage + 1 === page ? "white" : "black", // currentPage는 0부터, page는 1부터
                        background: currentPage + 1 === page ? "black" : "transparent",
                        border: "1px solid black",
                      }}
                    >
                      {page}
                    </button>
                  ))
                })()}

                {/* 다음 페이지 화살표 */}
                {currentPage < totalPages - 1 && (
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 hover:scale-110 border border-black"
                    aria-label="다음 페이지"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* 스터디 입장 전 응원 다이얼로그 */}
      <Dialog open={isEnterDialogOpen} onOpenChange={setIsEnterDialogOpen}>
        <DialogContent className="max-w-sm p-6" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4">
            <Image
              src="/images/home_icon.png"
              alt="수고했어요 응원 아이콘"
              width={80}
              height={80}
              className="w-20 h-20 object-contain"
            />
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-base font-semibold">
                {selectedRoom ? selectedRoom.name : "스터디 입장하기"}
              </DialogTitle>
              <DialogDescription className="text-xs text-black/70 mt-1 text-center">
                {selectedRoom?.status === "before_start" ? (
                  <>
                    아직 시작 전이에요.
                    <br />
                    곧 시작될 준비를 해볼까요?
                  </>
                ) : selectedRoom?.status === "focus" ? (
                  <>
                    지금 집중 시간이 진행 중이에요!
                    <br />
                    지금 들어가면 이번 세션의 공부 시간은
                    <span className="inline-flex items-center justify-center align-middle ml-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/20 bg-white text-[10px] text-black/70 hover:bg-black/5"
                            aria-label="세션이란?"
                          >
                            ?
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <div className="text-xs text-left leading-relaxed">
                            <p>
                              세션은 포모도로 타이머로 진행되는 하나의 집중 구간을 의미해요.
                            </p>
                            <p className="mt-1">
                              지금 들어오면 현재 진행 중인 세션의 집중 시간은 기록되지 않고,
                              다음 세션부터 공부 시간이 저장돼요.
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <br />
                    기록에 포함되지 않을 수 있어요.
                  </>
                ) : selectedRoom?.status === "break" ? (
                  <>
                    지금은 쉬는 시간이에요.
                    <br />
                    함께 끝까지 달려볼까요?
                  </>
                ) : (
                  <>
                    세션이 종료되었어요.
                    <br />
                    다음 세션을 기다려볼까요?
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="w-full flex justify-center mt-2">
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={async () => {
                  setIsEnterDialogOpen(false)
                  if (selectedRoom) {
                    // role 확인을 위해 /room으로 먼저 이동 (자동으로 적절한 페이지로 리다이렉트됨)
                    router.push(`/room?roomId=${selectedRoom.id}`)
                  }
                }}
              >
                네 좋아요!
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 로그인 필요 다이얼로그 */}
      <Dialog open={isLoginRequiredDialogOpen} onOpenChange={setIsLoginRequiredDialogOpen}>
        <DialogContent className="max-w-sm p-6" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4">
            <Image
              src="/images/home_icon.png"
              alt="로그인 필요 아이콘"
              width={80}
              height={80}
              className="w-20 h-20 object-contain"
            />
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-base font-semibold">
                로그인이 필요합니다
              </DialogTitle>
              <DialogDescription className="text-xs text-black/70 mt-1 text-center">
                {searchParams.get("roomId") ? (
                  <>
                    방에 입장하려면
                    <br />
                    로그인이 필요해요.
                  </>
                ) : (
                  <>
                    이 기능을 사용하려면
                    <br />
                    로그인이 필요해요.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="w-full flex justify-center gap-2 mt-2">
              <Button
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800"
                onClick={() => {
                  setIsLoginRequiredDialogOpen(false)
                  // roomId 쿼리 파라미터 제거
                  router.push("/")
                }}
              >
                취소
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={() => {
                  setIsLoginRequiredDialogOpen(false)
                  setIsLoginModalOpen(true)
                }}
              >
                로그인하기
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 방 생성 다이얼로그 */}
      <Dialog open={isCreateRoomDialogOpen} onOpenChange={setIsCreateRoomDialogOpen}>
        <DialogContent
          className="max-w-md p-6 max-h-[90vh] flex flex-col rounded-3xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.45), rgba(255,255,255,0.25))",
            backdropFilter: "blur(30px) saturate(180%)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.6)",
          }}
        >
          <div className="flex flex-col items-center gap-4 flex-shrink-0">
            <Image
              src="/images/home_icon.png"
              alt="안녕하세요!"
              width={80}
              height={80}
              className="w-20 h-20 object-contain"
            />
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-lg font-semibold">새 공부방 만들기</DialogTitle>
              <DialogDescription className="text-xs text-black/70">
                공부방 정보를 입력해주세요
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <CustomScrollbar className="flex-1 overflow-y-auto min-h-0 mt-4">
            <div className="flex flex-col gap-4 pr-2">
            {/* 타이머 형태 선택 */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium">
                타이머 형태
              </Label>
              <p className="text-[10px] text-black/60">
                사용할 타이머를 선택해주세요.
              </p>
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 포모도로 타이머 카드 */}
                <button
                  type="button"
                  onClick={() => setTimerType(TimerType.POMODORO)}
                  className={`group relative rounded-2xl p-3 flex flex-col items-center gap-2 min-h-[110px] transition-all ${
                    timerType === TimerType.POMODORO
                      ? "ring-2 ring-[#2c5f2d] bg-[#c5d4c0]/30"
                      : "ring-1 ring-black/5 bg-white/70 hover:bg-white"
                  }`}
                  style={{
                    boxShadow:
                      timerType === TimerType.POMODORO
                        ? "0 10px 30px rgba(45,74,62,0.25)"
                        : "0 6px 18px rgba(0,0,0,0.08)",
                  }}
                >
                  {/* 도움말 아이콘 */}
                  <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          role="button"
                          tabIndex={0}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/20 bg-white text-[10px] text-black/70 hover:bg-black/5 cursor-pointer"
                          aria-label="뽀모도로 타이머란?"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                            }
                          }}
                        >
                          ?
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs text-left leading-relaxed">
                          <p>
                            뽀모도로 타이머는 최대 60분까지 설정 가능해요.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center justify-center w-full flex-1 pt-2">
                    <div className="scale-[0.4] origin-center pointer-events-none">
                      <PomodoroDialStatic minutes={25} />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#111827] pb-1">
                    뽀모도로 타이머
                  </span>
                </button>

                {/* 플립 타이머 카드 */}
                <button
                  type="button"
                  onClick={() => setTimerType(TimerType.FLIP)}
                  className={`group relative rounded-2xl p-3 flex flex-col items-center gap-2 min-h-[110px] transition-all ${
                    timerType === TimerType.FLIP
                      ? "ring-2 ring-[#2c5f2d] bg-[#c5d4c0]/30"
                      : "ring-1 ring-black/5 bg-white/70 hover:bg-white"
                  }`}
                  style={{
                    boxShadow:
                      timerType === TimerType.FLIP
                        ? "0 10px 30px rgba(45,74,62,0.25)"
                        : "0 6px 18px rgba(0,0,0,0.08)",
                  }}
                >
                  {/* 도움말 아이콘 */}
                  <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          role="button"
                          tabIndex={0}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/20 bg-white text-[10px] text-black/70 hover:bg-black/5 cursor-pointer"
                          aria-label="플립 타이머란?"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                            }
                          }}
                        >
                          ?
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs text-left leading-relaxed">
                          <p>
                            플립 타이머는 시간 단위로 설정이 가능해요.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center justify-center w-full flex-1 pt-2">
                    <div className="scale-[0.4] origin-center pointer-events-none">
                      <FlipTimerStatic seconds={25 * 60} preview />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#111827] pb-1">
                    플립 타이머
                  </span>
                </button>
              </div>
            </div>

            {/* 스터디 이름 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="room-name" className="text-xs font-medium">
                스터디 이름
              </Label>
              <Input
                id="room-name"
                type="text"
                value={roomName}
                onChange={(e) => {
                  setRoomName(e.target.value)
                  if (errors.roomName) {
                    setErrors((prev) => ({ ...prev, roomName: false }))
                  }
                }}
                className={`bg-white ${errors.roomName ? "border-red-500 border-2" : ""}`}
                required
              />
            </div>

            {/* 해시태그 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="hashtags" className="text-xs font-medium">
                해시태그
              </Label>
              <Input
                id="hashtags"
                type="text"
                placeholder="해시태그를 입력하고 Enter를 누르세요"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={handleHashtagKeyDown}
                className="bg-white"
              />
              {/* 등록된 해시태그 표시 */}
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {hashtags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] md:text-xs font-medium"
                      style={{
                        background: "rgba(0, 0, 0, 0.05)",
                        color: "rgba(0, 0, 0, 0.7)",
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveHashtag(tag)}
                        className="hover:bg-black/10 rounded-full p-0.5 transition-colors ml-0.5"
                        aria-label={`${tag} 삭제`}
                      >
                        <X size={12} className="text-black/50" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 세션 횟수 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="sessions" className="text-xs font-medium">
                세션 횟수
              </Label>
              <Input
                id="sessions"
                type="number"
                min="1"
                max="10"
                placeholder="4"
                value={totalSessions || ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/^0+/, "") || ""
                  if (value === "") {
                    setTotalSessions(0)
                  } else {
                    const num = parseInt(value, 10)
                    if (!isNaN(num) && num >= 1 && num <= 10) {
                      setTotalSessions(num)
                    }
                  }
                  if (errors.totalSessions) {
                    setErrors((prev) => ({ ...prev, totalSessions: false }))
                  }
                }}
                className={`bg-white ${errors.totalSessions ? "border-red-500 border-2" : ""}`}
                required
              />
            </div>

            {/* 쉬는 시간 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="break-time" className="text-xs font-medium">
                쉬는 시간 (분)
              </Label>
              <Input
                id="break-time"
                type="number"
                min="1"
                max="15"
                placeholder="5"
                value={breakMinutes || ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/^0+/, "") || ""
                  if (value === "") {
                    setBreakMinutes(0)
                  } else {
                    const num = parseInt(value, 10)
                    if (!isNaN(num) && num >= 1 && num <= 15) {
                      setBreakMinutes(num)
                    }
                  }
                  if (errors.breakMinutes) {
                    setErrors((prev) => ({ ...prev, breakMinutes: false }))
                  }
                }}
                className={`bg-white ${errors.breakMinutes ? "border-red-500 border-2" : ""}`}
                required
              />
            </div>

            {/* 제한 인원 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="max-participants" className="text-xs font-medium">
                제한 인원
              </Label>
              <Input
                id="max-participants"
                type="number"
                min="2"
                max="10"
                placeholder="10"
                value={maxParticipants || ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/^0+/, "") || ""
                  if (value === "") {
                    setMaxParticipants(0)
                  } else {
                    const num = parseInt(value, 10)
                    if (!isNaN(num) && num >= 2 && num <= 10) {
                      setMaxParticipants(num)
                    }
                  }
                  if (errors.maxParticipants) {
                    setErrors((prev) => ({ ...prev, maxParticipants: false }))
                  }
                }}
                className={`bg-white ${errors.maxParticipants ? "border-red-500 border-2" : ""}`}
                required
              />
            </div>

            {/* 비밀방 선택 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4 py-3 px-4 rounded-lg border border-black/10 bg-white/50">
                <Label htmlFor="is-private" className="text-xs font-medium cursor-pointer text-black">
                  비밀방
                </Label>
                <Switch
                  id="is-private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                  className="data-[state=checked]:bg-orange-500"
                />
              </div>
              {/* 비밀번호 입력 필드 - 비밀방이 체크되었을 때만 표시 */}
              {isPrivate && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="room-password" className="text-xs font-medium">
                    비밀번호
                  </Label>
                  <Input
                    id="room-password"
                    type="password"
                    placeholder="비밀번호를 입력하세요"
                    value={roomPassword}
                    onChange={(e) => {
                      setRoomPassword(e.target.value)
                      if (errors.roomPassword) {
                        setErrors((prev) => ({ ...prev, roomPassword: false }))
                      }
                    }}
                    className={`bg-white ${errors.roomPassword ? "border-red-500 border-2" : ""}`}
                    required
                  />
                </div>
              )}
            </div>
            </div>
          </CustomScrollbar>

          <DialogFooter className="mt-4 flex-shrink-0">
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={() => {
                // 필수 필드 유효성 검사 및 에러 상태 설정
                const newErrors = {
                  roomName: !roomName.trim(),
                  totalSessions: !totalSessions || totalSessions < 1,
                  breakMinutes: !breakMinutes || breakMinutes < 1,
                  maxParticipants: !maxParticipants || maxParticipants < 2,
                  roomPassword: isPrivate && !roomPassword.trim(),
                }
                
                setErrors(newErrors)
                
                // 하나라도 에러가 있으면 제출하지 않음
                if (Object.values(newErrors).some((error) => error)) {
                  return
                }

                // 스터디룸 생성 API 호출
                const createRoom = async () => {
                  try {
                    const response = await createStudyRoom({
                      title: roomName,
                      hashtags: hashtags.length > 0 ? hashtags : undefined,
                      breakMinutes: breakMinutes,
                      totalSessions: totalSessions,
                      maxParticipants: maxParticipants,
                      secret: isPrivate,
                      password: isPrivate ? roomPassword : undefined,
                      timerType,
                    })

                    // 성공 알림
                    showSuccessNotification("스터디룸이 생성되었습니다.")
                    
                    // 방 생성 후 환영 다이얼로그 표시 플래그 설정
                    localStorage.setItem("showRoomWelcome", "true")
                    
                    // 다이얼로그 닫기
                    setIsCreateRoomDialogOpen(false)
                    
                    // 폼 초기화
                    setRoomName("")
                    setHashtagInput("")
                    setHashtags([])
                    setTotalSessions(4)
                    setBreakMinutes(5)
                    setMaxParticipants(10)
                    setIsPrivate(false)
                    setRoomPassword("")
                    
                    // 에러 상태 초기화
                    setErrors({
                      roomName: false,
                      totalSessions: false,
                      breakMinutes: false,
                      maxParticipants: false,
                      roomPassword: false,
                    })

                    // 방 생성 성공 후 목록 새로고침
                    const refreshResponse = await getStudyRooms(currentPage)
                    const rooms = refreshResponse.content.map(mapToStudyRoom)
                    setStudyRooms(rooms)
                    setTotalPages(refreshResponse.totalPages)
                    
                    // /room 페이지로 이동 (roomId를 쿼리 파라미터로 전달)
                    router.push(`/room?roomId=${response.roomId}`)
                    console.log("방 생성 성공:", response)
                  } catch (error) {
                    console.error("방 생성 실패:", error)
                    // 로그인 필요 에러인 경우 다이얼로그 표시
                    if (error instanceof ApiError && error.requiresLogin) {
                      setIsLoginRequiredDialogOpen(true)
                    }
                    // 다른 에러는 apiRequest에서 이미 시스템 알림으로 표시됨
                  }
                }

                createRoom()
              }}
            >
              생성하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 하단 탭 바 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center">
        <div className="w-full max-w-2xl rounded-3xl bg-gradient-to-br from-white/70 via-white/45 to-white/25 backdrop-blur-3xl border border-white/60 shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
          <div className="grid grid-cols-5 items-center px-2 py-2">
            {/* 홈 */}
            <button
              type="button"
              onClick={() => router.push("/")}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                pathname === "/"
                  ? "text-primary bg-primary/10"
                  : "text-black/60 hover:text-black/80"
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="text-[10px] font-medium">홈</span>
            </button>

            {/* 랭킹 */}
            <button
              type="button"
              onClick={() => router.push("/ranking")}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                pathname === "/ranking"
                  ? "text-primary bg-primary/10"
                  : "text-black/60 hover:text-black/80"
              }`}
            >
              <Trophy className="h-5 w-5" />
              <span className="text-[10px] font-medium">랭킹</span>
            </button>

            {/* 방 만들기 - 유튜브 스타일 + 버튼 (정중앙) */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  if (isLoggedIn) {
                    setIsCreateRoomDialogOpen(true)
                  } else {
                    setIsLoginModalOpen(true)
                  }
                }}
                className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-primary/40 border border-white/70 hover:bg-primary/90 transition-colors -mt-6 cursor-pointer"
                aria-label="새 공부방 만들기"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>

            {/* 공부 기록 */}
            <button
              type="button"
              onClick={() => {
                if (isLoggedIn) {
                  setIsUserStudyDialogOpen(true)
                } else {
                  setIsLoginModalOpen(true)
                }
              }}
              className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all text-black/60 hover:text-black/80 cursor-pointer"
            >
              <Clock className="h-5 w-5" />
              <span className="text-[10px] font-medium">공부 기록</span>
            </button>

            {/* 나의 정보 */}
            <button
              type="button"
              onClick={() => {
                if (isLoggedIn) {
                  setIsUserInfoDialogOpen(true)
                } else {
                  setIsLoginModalOpen(true)
                }
              }}
              className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all text-black/60 hover:text-black/80 cursor-pointer"
            >
              <User className="h-5 w-5" />
              <span className="text-[10px] font-medium">나의 정보</span>
            </button>
          </div>
        </div>
      </div>

      {/* 로그인 모달 */}
      <LoginModal
        open={isLoginModalOpen}
        onOpenChange={setIsLoginModalOpen}
        onLoginSuccess={async () => {
          setIsLoggedIn(true)
          try {
            const me = await getCurrentUser()
            setUser(me)
          } catch (error) {
            console.error("Failed to load current user after login:", error)
          }
          // 로그인 성공 후 roomId가 있으면 해당 방으로 이동
          const roomIdParam = searchParams.get("roomId")
          if (roomIdParam) {
            router.push(`/room?roomId=${roomIdParam}`)
          }
        }}
      />

      {/* 내 정보 다이얼로그 */}
      <UserInfoDialog
        open={isUserInfoDialogOpen}
        onOpenChange={setIsUserInfoDialogOpen}
      />

      {/* 공부 기록 다이얼로그 */}
      <UserStudyRecordsDialog
        open={isUserStudyDialogOpen}
        onOpenChange={setIsUserStudyDialogOpen}
      />
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageInner />
    </Suspense>
  )
}
