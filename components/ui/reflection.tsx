"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import { Star } from "lucide-react"
import { CustomScrollbar } from "./custom-scrollbar"

export interface Reflection {
  id: number
  authorName: string
  authorAvatar?: string
  content: string
  images?: string[]
  timestamp: Date
  focusScore?: number | null
  sessionId?: number
}

export interface ReflectionProps {
  /**
   * 초기 회고 목록
   */
  initialReflections?: Reflection[]
  /**
   * 회고가 변경될 때 호출되는 콜백
   */
  onReflectionsChange?: (reflections: Reflection[]) => void
  /**
   * 실시간으로 추가되는 회고 이벤트
   * (가장 최신 회고가 위로 오도록 정렬)
   */
  liveReflection?: {
    reflectionId: number
    sessionId: number
    userName: string
    userProfileUrl: string | null
    content: string
    focusScore: number | null
    imageUrl: string | null
    createdAt: Date
  } | null
  /**
   * 회고 처리 완료 후 호출되는 콜백 (중복 방지를 위해 reflectionData 초기화용)
   */
  onReflectionProcessed?: () => void
  /**
   * 테두리 표시 여부 (기본값: true)
   */
  showBorder?: boolean
}

const colors = {
  // 시스템 primary 그린 팔레트
  main: "#2c5f2d",
  text: "rgba(45, 74, 62, 0.95)",
  textLight: "rgba(45, 74, 62, 0.7)",
  shadow: "rgba(45, 74, 62, 0.35)",
}

export function Reflection({
  initialReflections = [],
  onReflectionsChange,
  liveReflection,
  onReflectionProcessed,
  showBorder = true,
}: ReflectionProps) {
  const [reflections, setReflections] = useState<Reflection[]>(initialReflections)
  const processedReflectionIdsRef = useRef<Set<number>>(new Set())
  const lastInitialReflectionsRef = useRef<Reflection[]>([])

  // initialReflections가 변경되면 state 업데이트 및 처리된 ID 기록
  useEffect(() => {
    // initialReflections가 비어있으면 무시 (단, 처음 로드 시에는 제외)
    if (initialReflections.length === 0 && lastInitialReflectionsRef.current.length > 0) {
      return
    }

    // 이전 initialReflections와 비교하여 실제로 변경되었는지 확인
    const hasChanged = 
      lastInitialReflectionsRef.current.length !== initialReflections.length ||
      lastInitialReflectionsRef.current.some((prev, idx) => {
        const current = initialReflections[idx]
        return !current || prev.id !== current.id
      })

    // 처음 로드 시 (lastInitialReflectionsRef가 비어있음) 또는 실제로 변경된 경우에만 업데이트
    const isFirstLoad = lastInitialReflectionsRef.current.length === 0

    if (!hasChanged && !isFirstLoad) {
      // 변경사항이 없으면 무시 (웹소켓으로 추가된 회고 보존)
      return
    }

    // initialReflections가 변경되었을 때만 업데이트
    setReflections((prev) => {
      // 처음 로드 시에는 initialReflections로 완전히 교체
      if (isFirstLoad && initialReflections.length > 0) {
        initialReflections.forEach((reflection) => {
          processedReflectionIdsRef.current.add(reflection.id)
        })
        return initialReflections
      }

      // 이후 업데이트 시에는 기존 회고와 새로 받은 회고를 병합 (중복 제거)
      const mergedMap = new Map<number, Reflection>()
      
      // 기존 회고 먼저 추가 (웹소켓으로 받은 회고 포함)
      prev.forEach((reflection) => {
        mergedMap.set(reflection.id, reflection)
      })
      
      // initialReflections 추가 (중복은 덮어쓰지 않음 - 기존 것이 우선)
      initialReflections.forEach((reflection) => {
        if (!mergedMap.has(reflection.id)) {
          mergedMap.set(reflection.id, reflection)
        }
        // 처리된 ID 기록
        processedReflectionIdsRef.current.add(reflection.id)
      })
      
      // 배열로 변환 후 최신 순으로 정렬
      const merged = Array.from(mergedMap.values())
      merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      
      return merged
    })

    // 마지막 initialReflections 저장
    lastInitialReflectionsRef.current = [...initialReflections]
  }, [initialReflections])

  // 처리 완료 콜백을 안전하게 호출하는 헬퍼 함수
  const callOnReflectionProcessed = useCallback(() => {
    // 다음 틱에 호출하여 렌더링 중 상태 업데이트 방지
    setTimeout(() => {
      onReflectionProcessed?.()
    }, 0)
  }, [onReflectionProcessed])

  // 실시간 회고 이벤트 수신 시 리스트에 추가 (최신 순 정렬)
  useEffect(() => {
    if (!liveReflection) return

    // 이미 처리한 회고인지 확인 (processedReflectionIdsRef로 중복 방지)
    if (processedReflectionIdsRef.current.has(liveReflection.reflectionId)) {
      callOnReflectionProcessed()
      return
    }

    // 처리된 회고 ID 기록
    processedReflectionIdsRef.current.add(liveReflection.reflectionId)

    setReflections((prev) => {
      // 이미 리스트에 있는 회고인지 확인 (중복 방지)
      const exists = prev.some((r) => r.id === liveReflection.reflectionId)
      if (exists) {
        callOnReflectionProcessed()
        return prev
      }

      const newReflection: Reflection = {
        id: liveReflection.reflectionId,
        authorName: liveReflection.userName,
        authorAvatar: liveReflection.userProfileUrl || undefined,
        content: liveReflection.content,
        images: liveReflection.imageUrl ? [liveReflection.imageUrl] : [],
        timestamp: liveReflection.createdAt,
        focusScore: liveReflection.focusScore,
        sessionId: liveReflection.sessionId,
      }

      // 최신 순으로 정렬하여 추가
      const next = [newReflection, ...prev].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      )

      onReflectionsChange?.(next)
      return next
    })

    callOnReflectionProcessed()
  }, [liveReflection, onReflectionsChange, callOnReflectionProcessed])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div
      className={`flex flex-col rounded-3xl w-full h-full bg-gradient-to-br from-white/70 via-white/45 to-white/25 backdrop-blur-3xl shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${showBorder ? 'border-2 border-[#2c5f2d]' : ''}`}
    >
      {/* Header */}
      <div
        className="px-6 py-4 border-b"
        style={{
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: colors.main,
              boxShadow: `0 0 10px ${colors.shadow}`,
            }}
          />
          <span
            className="text-lg font-medium font-sans"
            style={{ color: colors.text }}
          >
            회고
          </span>
        </div>
      </div>

      {/* Reflections List */}
      <CustomScrollbar className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 max-h-full">
        {reflections.length === 0 ? (
          <div
            className="text-center py-8 text-sm font-sans"
            style={{ color: colors.textLight }}
          >
            아직 회고가 없습니다
          </div>
        ) : (
          reflections.map((reflection) => (
            <div
              key={reflection.id}
              className="flex gap-3 px-4 py-3 rounded-2xl border border-white/60"
              style={{
                backgroundColor: "rgba(197, 212, 192, 0.6)",
                backdropFilter: "blur(10px)",
              }}
            >
              {/* 프로필 사진 */}
              <div className="flex-shrink-0">
                {reflection.authorAvatar ? (
                  <img
                    src={reflection.authorAvatar}
                    alt={reflection.authorName}
                    className="w-12 h-12 rounded-full border-2 border-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.08)] object-cover"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full border-2 border-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center text-white font-semibold text-sm"
                    style={{
                      background: "#c5d4c0",
                    }}
                  >
                    {reflection.authorName.charAt(0)}
                  </div>
                )}
              </div>

              {/* 작성자와 회고 내용 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="text-xs font-semibold font-sans"
                    style={{ color: "#111827" }} // 작성자 이름: 검정색
                  >
                    {reflection.authorName}
                  </span>
                  <span
                    className="text-[10px] font-sans"
                    style={{ color: colors.textLight }}
                  >
                    {formatTime(reflection.timestamp)}
                  </span>
                  {/* 세션 정보 표시 */}
                  {reflection.sessionId !== undefined && reflection.sessionId !== null && (
                    <span
                      className="text-[10px] font-sans px-1.5 py-0.5 rounded-md"
                      style={{
                        color: colors.text,
                        backgroundColor: "rgba(255, 255, 255, 0.7)",
                      }}
                    >
                      {reflection.sessionId}번째 세션
                    </span>
                  )}
                  {/* 별점 표시 */}
                  {reflection.focusScore !== null && reflection.focusScore !== undefined && (
                    <div className="flex items-center gap-0.5 ml-auto">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          className="w-3 h-3"
                          fill={value <= reflection.focusScore! ? "#facc15" : "transparent"}
                          stroke={value <= reflection.focusScore! ? "#facc15" : "#e5e7eb"}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <p
                  className="text-xs font-sans leading-relaxed break-words mb-2"
                  style={{ color: "#111827" }} // 회고 내용: 검정색
                >
                  {reflection.content}
                </p>
                
                {/* 학습 사진 갤러리 */}
                {reflection.images && reflection.images.length > 0 && (
                  <div
                    className={`grid gap-2 mt-2 ${
                      reflection.images.length === 1
                        ? "grid-cols-1 max-w-xs"
                        : reflection.images.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-3"
                    }`}
                  >
                    {reflection.images.map((image, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-lg overflow-hidden border border-white/60 shadow-sm cursor-pointer hover:opacity-90 transition-opacity group"
                        style={{
                          aspectRatio: reflection.images?.length === 1 ? "16/9" : "1",
                          background: "rgba(255, 255, 255, 0.3)",
                        }}
                        onClick={() => window.open(image, "_blank")}
                      >
                        <img
                          src={image}
                          alt={`${reflection.authorName}의 학습 사진 ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = "/placeholder.jpg"
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </CustomScrollbar>
    </div>
  )
}
