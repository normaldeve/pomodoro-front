"use client"

import { useRouter, usePathname } from "next/navigation"
import { Home, Settings, Clock, Calendar, Plus } from "lucide-react"

interface BottomTabBarProps {
  isLoggedIn: boolean
  onCreateRoomClick?: () => void
  onUserStudyClick?: () => void
  onUserInfoClick?: () => void
}

export function BottomTabBar({
  isLoggedIn,
  onCreateRoomClick,
  onUserStudyClick,
  onUserInfoClick,
}: BottomTabBarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleCalendarClick = () => {
    if (isLoggedIn) {
      router.push("/calendar")
    } else {
      router.push("/login")
    }
  }

  const handleCreateRoomClick = () => {
    if (isLoggedIn && onCreateRoomClick) {
      onCreateRoomClick()
    } else {
      router.push("/login")
    }
  }

  const handleStudyRecordsClick = () => {
    if (isLoggedIn && onUserStudyClick) {
      onUserStudyClick()
    } else {
      router.push("/login")
    }
  }

  const handleSettingsClick = () => {
    if (isLoggedIn && onUserInfoClick) {
      onUserInfoClick()
    } else {
      router.push("/login")
    }
  }

  return (
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

          {/* 캘린더 */}
          <button
            type="button"
            onClick={handleCalendarClick}
            className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all cursor-pointer ${
              pathname === "/calendar"
                ? "text-primary bg-primary/10"
                : "text-black/60 hover:text-black/80"
            }`}
          >
            <Calendar className="h-5 w-5" />
            <span className="text-[10px] font-medium">캘린더</span>
          </button>

          {/* 방 만들기 - 유튜브 스타일 + 버튼 (정중앙) */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleCreateRoomClick}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-primary/40 border border-white/70 hover:bg-primary/90 transition-colors -mt-6 cursor-pointer"
              aria-label="새 공부방 만들기"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          {/* 공부 기록 */}
          <button
            type="button"
            onClick={handleStudyRecordsClick}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all text-black/60 hover:text-black/80 cursor-pointer"
          >
            <Clock className="h-5 w-5" />
            <span className="text-[10px] font-medium">공부 기록</span>
          </button>

          {/* 설정 */}
          <button
            type="button"
            onClick={handleSettingsClick}
            className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all cursor-pointer ${
              pathname === "/login"
                ? "text-primary bg-primary/10"
                : "text-black/60 hover:text-black/80"
            }`}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[10px] font-medium">설정</span>
          </button>
        </div>
      </div>
    </div>
  )
}
