"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Trophy, ArrowLeft, Medal } from "lucide-react"
import { getCurrentUser } from "@/lib/api"

interface RankingUser {
  rank: number
  userId: number
  nickname: string
  username: string
  profileUrl: string | null
  points: number // 랭킹 포인트
  studyDays: number // 참여 일수 (예: 오늘 기준 최근 N일 등)
}

// 모킹 데이터 (나중에 API로 대체)
const mockRankingData: RankingUser[] = [
  {
    rank: 1,
    userId: 1,
    nickname: "공부왕",
    username: "study_king",
    profileUrl: null,
    points: 3200,
    studyDays: 30,
  },
  {
    rank: 2,
    userId: 2,
    nickname: "집중러",
    username: "focus_master",
    profileUrl: null,
    points: 2800,
    studyDays: 28,
  },
  {
    rank: 3,
    userId: 3,
    nickname: "성실이",
    username: "diligent",
    profileUrl: null,
    points: 2500,
    studyDays: 25,
  },
  {
    rank: 4,
    userId: 4,
    nickname: "열공맨",
    username: "hard_worker",
    profileUrl: null,
    points: 2200,
    studyDays: 22,
  },
  {
    rank: 5,
    userId: 5,
    nickname: "포모도로러버",
    username: "pomodoro_lover",
    profileUrl: null,
    points: 1900,
    studyDays: 20,
  },
]

const colors = {
  // 시스템 primary 그린 팔레트
  main: "#2c5f2d",
  text: "rgba(45, 74, 62, 0.95)",
  textLight: "rgba(45, 74, 62, 0.7)",
  shadow: "rgba(45, 74, 62, 0.35)",
}

export default function RankingPage() {
  const router = useRouter()
  const [isLoaded, setIsLoaded] = useState(false)
  const [showHeader, setShowHeader] = useState(false)
  const [showList, setShowList] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: number; nickname: string; username: string; profileUrl: string | null } | null>(null)
  const [rankingData, setRankingData] = useState<RankingUser[]>(mockRankingData)
  const [userRank, setUserRank] = useState<number | null>(null)

  // 현재 사용자 정보 로드
  useEffect(() => {
    ;(async () => {
      try {
        const me = await getCurrentUser()
        setCurrentUser({
          id: me.id,
          nickname: me.nickname,
          username: me.username,
          profileUrl: me.profileUrl,
        })

        // 사용자의 랭킹 찾기
        const rank = rankingData.findIndex((user) => user.userId === me.id)
        if (rank !== -1) {
          setUserRank(rank + 1)
        }
      } catch (error) {
        console.error("현재 사용자 정보 로드 실패:", error)
      }
    })()
  }, [rankingData])

  // 로딩 애니메이션 효과
  useEffect(() => {
    setIsLoaded(true)
    setTimeout(() => setShowHeader(true), 100)
    setTimeout(() => setShowList(true), 300)
  }, [])

  // 전체 랭킹
  const allRanking = rankingData

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 md:p-10"
      style={{
        backgroundColor: "#fff8ea",
        transition: "opacity 0.5s ease-in",
        opacity: isLoaded ? 1 : 0,
      }}
    >
      <div className="relative z-10 w-full max-w-4xl">
        {/* 헤더 */}
        <header
          className="mb-6 flex items-center gap-4 transition-all duration-700 ease-out"
          style={{
            opacity: showHeader ? 1 : 0,
            transform: showHeader ? "translateY(0)" : "translateY(-20px)",
          }}
        >
          <button
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm hover:bg-black/5 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold font-sans" style={{ color: colors.text }}>
            랭킹
          </h1>
        </header>

        {/* 랭킹 포인트 정책 안내 */}
        <section
          className="mb-6 rounded-3xl bg-gradient-to-br from-white/85 via-white/70 to-white/50 backdrop-blur-3xl border border-white/70 shadow-[0_18px_50px_rgba(0,0,0,0.12)] px-6 py-5 transition-all duration-700 ease-out"
          style={{
            opacity: showHeader ? 1 : 0,
            transform: showHeader ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <Trophy className="w-5 h-5" style={{ color: colors.main }} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm md:text-base font-semibold font-sans mb-1.5" style={{ color: colors.text }}>
                랭킹 포인트는 어떻게 계산되나요?
              </h2>
              <p className="text-xs md:text-sm font-sans mb-2" style={{ color: colors.textLight }}>
                포인트는 공부방에서의 활동을 숫자로 표현한 값이에요. 아래 항목들을 조합해서 최종 점수가 결정됩니다.
              </p>
              <ul className="text-xs md:text-sm font-sans space-y-1.5" style={{ color: colors.textLight }}>
                <li>· 집중 시간과 세션 완료 여부, 출석 일수 등 학습 관련 지표를 기반으로 포인트가 쌓입니다.</li>
                <li>· 포인트는 일정 주기마다 다시 계산되어, 최근 학습 활동이 랭킹에 잘 반영되도록 조정돼요.</li>
                <li>· 자세한 포인트 정책은 곧 안내될 예정이며, 정책이 바뀌어도 내 실제 공부 기록은 그대로 유지됩니다.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 전체 랭킹 표 */}
        <section
          className="mb-6 rounded-3xl bg-gradient-to-br from-white/80 via-white/65 to-white/45 backdrop-blur-3xl border border-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.14)] px-6 py-6 transition-all duration-700 ease-out"
          style={{
            opacity: showList ? 1 : 0,
            transform: showList ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: colors.main,
                boxShadow: `0 0 10px ${colors.shadow}`,
              }}
            />
            <h2 className="text-lg font-semibold font-sans" style={{ color: colors.text }}>
              전체 랭킹
            </h2>
          </div>

          {/* 표 헤더 */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 mb-2 border-b border-white/40">
            <div className="col-span-1 text-center">
              <span className="text-xs font-semibold font-sans" style={{ color: colors.text }}>
                순위
              </span>
            </div>
            <div className="col-span-4">
              <span className="text-xs font-semibold font-sans" style={{ color: colors.text }}>
                닉네임
              </span>
            </div>
            <div className="col-span-3 text-right">
              <span className="text-xs font-semibold font-sans" style={{ color: colors.text }}>
                포인트
              </span>
            </div>
            <div className="col-span-4 text-right">
              <span className="text-xs font-semibold font-sans" style={{ color: colors.text }}>
                참여 일수
              </span>
            </div>
          </div>

          {/* 표 내용 */}
          <div className="space-y-2">
            {allRanking.map((user, index) => {
              const isCurrentUser = currentUser && user.userId === currentUser.id
              return (
                <div
                  key={user.userId}
                  className="grid grid-cols-12 gap-4 px-4 py-3 rounded-lg bg-white/50 border border-white/60 transition-all duration-300 ease-out hover:bg-white/70"
                  style={{
                    backdropFilter: "blur(10px)",
                    opacity: showList ? 1 : 0,
                    transform: showList ? "translateX(0)" : "translateX(-20px)",
                    transitionDelay: `${index * 30}ms`,
                    borderColor: isCurrentUser ? colors.main : "rgba(255, 255, 255, 0.6)",
                    borderWidth: isCurrentUser ? "2px" : "1px",
                    boxShadow: isCurrentUser ? `0 4px 12px ${colors.shadow}` : "none",
                  }}
                >
                  {/* 순위 */}
                  <div className="col-span-1 text-center flex items-center justify-center">
                    {user.rank === 1 ? (
                      <div className="relative">
                        <Medal className="w-6 h-6" style={{ color: "#FFD700" }} fill="#FFD700" />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                          1
                        </span>
                      </div>
                    ) : user.rank === 2 ? (
                      <div className="relative">
                        <Medal className="w-6 h-6" style={{ color: "#C0C0C0" }} fill="#C0C0C0" />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                          2
                        </span>
                      </div>
                    ) : user.rank === 3 ? (
                      <div className="relative">
                        <Medal className="w-6 h-6" style={{ color: "#CD7F32" }} fill="#CD7F32" />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                          3
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-bold font-sans" style={{ color: colors.text }}>
                        {user.rank}
                      </span>
                    )}
                  </div>

                  {/* 닉네임 */}
                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold font-sans truncate" style={{ color: colors.text }}>
                      {user.nickname}
                    </p>
                    {isCurrentUser && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/80 border border-white flex-shrink-0"
                        style={{ color: colors.main }}>
                        나
                      </span>
                    )}
                  </div>

                  {/* 포인트 */}
                  <div className="col-span-3 text-right flex items-center justify-end">
                    <span className="text-sm font-sans" style={{ color: colors.text }}>
                      {user.points.toLocaleString()}점
                    </span>
                  </div>

                  {/* 참여 일수 */}
                  <div className="col-span-4 text-right flex items-center justify-end">
                    <span className="text-sm font-sans" style={{ color: colors.textLight }}>
                      {user.studyDays}일
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 사용자 랭킹 정보 (랭킹에 포함되지 않은 경우) */}
        {currentUser && userRank === null && (
          <section
            className="rounded-3xl bg-gradient-to-br from-white/80 via-white/65 to-white/45 backdrop-blur-3xl border border-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.14)] px-6 py-6 transition-all duration-700 ease-out"
            style={{
              opacity: showList ? 1 : 0,
              transform: showList ? "translateY(0)" : "translateY(20px)",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  background: colors.main,
                  boxShadow: `0 0 10px ${colors.shadow}`,
                }}
              />
              <h2 className="text-lg font-semibold font-sans" style={{ color: colors.text }}>
                내 정보
              </h2>
            </div>
            <div className="flex items-center justify-center py-4">
              <p className="text-sm font-sans" style={{ color: colors.textLight }}>
                아직 랭킹에 포함되지 않았어요. 공부를 시작해보세요!
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
