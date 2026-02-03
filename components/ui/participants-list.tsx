"use client"

import { Crown } from "lucide-react"
import { StudyRoomMemberResponse, RoomMemberRole } from "@/lib/api"

const colors = {
  // 시스템 primary 그린 팔레트
  main: "#2c5f2d",
  text: "rgba(45, 74, 62, 0.95)",
  textLight: "rgba(45, 74, 62, 0.7)",
  shadow: "rgba(45, 74, 62, 0.35)",
}

export interface ParticipantsListProps {
  participants: StudyRoomMemberResponse[]
  isLoading?: boolean
}

export function ParticipantsList({ participants, isLoading = false }: ParticipantsListProps) {
  return (
    <aside className="hidden md:block">
      <div className="rounded-3xl bg-gradient-to-br from-white/70 via-white/45 to-white/25 backdrop-blur-3xl border border-white/60 shadow-[0_24px_80px_rgba(0,0,0,0.16)] px-5 py-6 flex flex-col gap-4 h-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: colors.main,
                boxShadow: `0 0 10px ${colors.shadow}`,
              }}
            />
            <h2 className="text-sm font-semibold font-sans" style={{ color: colors.text }}>
              참여자 명단
            </h2>
          </div>
          <span className="text-[11px] font-sans" style={{ color: colors.textLight }}>
            총 {participants.length}명
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="text-center py-4 text-xs font-sans" style={{ color: colors.textLight }}>
              로딩 중...
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-4 text-xs font-sans" style={{ color: colors.textLight }}>
              참여자가 없습니다
            </div>
          ) : (
            participants.map((p) => (
              <div
                key={p.userId}
                className="flex items-center justify-between gap-2 rounded-2xl bg-white/70 px-3 py-2 border border-white/80 shadow-[0_6px_18px_rgba(0,0,0,0.06)]"
                style={{
                  backdropFilter: "blur(18px) saturate(180%)",
                }}
              >
                <div className="flex items-center gap-2">
                  {p.profileUrl ? (
                    <img
                      src={p.profileUrl}
                      alt={p.nickname}
                      className="w-7 h-7 rounded-full border border-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.02)] object-cover"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full border border-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.02)]"
                      style={{ backgroundColor: "#c5d4c0" }}
                    />
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium font-sans" style={{ color: colors.text }}>
                      {p.nickname}
                    </span>
                    {p.role === RoomMemberRole.HOST && (
                      <Crown
                        className="w-3.5 h-3.5"
                        style={{
                          color: "#fbbf24",
                          fill: "#fbbf24",
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
