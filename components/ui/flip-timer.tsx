"use client"

import React, { useState, useRef, useEffect } from "react"
import { Pause, Play, Check, X, Settings, Plus, Minus } from "lucide-react"
import { TimerState } from "@/lib/websocket"
import { ThemedFlipDigit } from "./themed-flip-digit"
import { cn } from "@/lib/utils"

// PomodoroTimer와 동일한 인터페이스
export interface FlipTimerProps {
  defaultMinutes?: number
  onTimeSet?: (minutes: number) => void
  onTick?: (remainingSeconds: number) => void
  onComplete?: () => void
  onStart?: (minutes: number) => void
  onPause?: () => void
  onResume?: () => void
  currentSession?: number
  totalSessions?: number
  disabled?: boolean
  externalTimerState?: TimerState | null
  externalMinutes?: number | null
  onDragStart?: () => void
  onDragMove?: (minutes: number) => void
  onDragEnd?: (minutes: number) => void
  onNextFocusMinutesSet?: (minutes: number) => void
  roomStatus?: string
}

// 집중 시간 색상
const focusColors = {
  main: "#2c5f2d",
  text: "rgba(45, 74, 62, 0.95)",
  buttonBg: "rgba(45, 74, 62, 0.95)",
  buttonBgLight: "rgba(45, 74, 62, 0.2)",
  textLight: "rgba(45, 74, 62, 0.6)",
  shadow: "rgba(45, 74, 62, 0.3)",
}

// 휴식 시간 색상
const breakColors = {
  main: "#6f8f77",
  text: "rgba(54, 79, 63, 0.95)",
  buttonBg: "rgba(111, 143, 119, 0.95)",
  buttonBgLight: "rgba(111, 143, 119, 0.2)",
  textLight: "rgba(111, 143, 119, 0.7)",
  shadow: "rgba(111, 143, 119, 0.35)",
}

// 종료 색상
const finishedColors = {
  main: "rgba(156, 163, 175, 1)",
  text: "rgba(156, 163, 175, 0.9)",
  buttonBg: "rgba(156, 163, 175, 0.85)",
  buttonBgLight: "rgba(156, 163, 175, 0.2)",
  textLight: "rgba(156, 163, 175, 0.6)",
  shadow: "rgba(156, 163, 175, 0.3)",
}

function formatTime(totalSeconds: number): string {
  const totalMinutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const seconds = totalSeconds % 60
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export function FlipTimer({
  defaultMinutes = 25,
  onTimeSet,
  onTick,
  onComplete,
  onStart,
  onPause,
  onResume,
  currentSession = 1,
  totalSessions = 4,
  disabled = false,
  externalTimerState = null,
  externalMinutes = null,
  onDragStart,
  onDragMove,
  onDragEnd,
  onNextFocusMinutesSet,
  roomStatus,
}: FlipTimerProps) {
  const initialMinutes = Math.min(60, Math.max(1, defaultMinutes))
  // 시간과 분을 별도로 관리 (초기값을 시간과 분으로 분리)
  const [hours, setHours] = useState(Math.floor(initialMinutes / 60))
  const [minutes, setMinutes] = useState(initialMinutes % 60)
  const [isRunning, setIsRunning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(initialMinutes * 60)
  const [isEditingNextFocus, setIsEditingNextFocus] = useState(false)
  const [editingHours, setEditingHours] = useState(Math.floor(initialMinutes / 60))
  const [editingMinutes, setEditingMinutes] = useState(initialMinutes % 60)
  const [showNextFocusButton, setShowNextFocusButton] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 총 분을 계산하는 헬퍼 함수
  const getTotalMinutes = (h: number, m: number) => h * 60 + m

  const effectiveTimerState = externalTimerState
  const isExternalControl = effectiveTimerState !== null && effectiveTimerState !== undefined

  // 백엔드에서 받은 TimerState로 상태 동기화 (1초마다 업데이트)
  useEffect(() => {
    if (effectiveTimerState) {
      // remainingSeconds를 항상 동기화 (정지 상태에서도 정확한 시간 표시)
      setRemainingSeconds(effectiveTimerState.remainingSeconds)
      setIsRunning(effectiveTimerState.running)
      
      // phaseDurationSeconds를 분으로 변환하여 시간과 분 설정
      const phaseMinutes = Math.floor(effectiveTimerState.phaseDurationSeconds / 60)
      setHours(Math.floor(phaseMinutes / 60))
      setMinutes(phaseMinutes % 60)
      
      // phase가 BREAK에서 FOCUS로 변경되면 집중 시간 변경 모드 종료 및 버튼 숨김
      if (effectiveTimerState.phase === 'FOCUS' && isEditingNextFocus) {
        setIsEditingNextFocus(false)
        setShowNextFocusButton(false)
      }
    }
  }, [effectiveTimerState, isEditingNextFocus])

  // 외부에서 제어하는 분 값 동기화
  useEffect(() => {
    if (externalMinutes !== null && externalMinutes !== undefined && !effectiveTimerState) {
      const clampedMinutes = Math.max(1, Math.min(999, externalMinutes))
      setHours(Math.floor(clampedMinutes / 60))
      setMinutes(clampedMinutes % 60)
      setRemainingSeconds(clampedMinutes * 60)
    }
  }, [externalMinutes, effectiveTimerState])

  // Timer logic
  useEffect(() => {
    if (isExternalControl) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    if (isRunning && remainingSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          const next = prev - 1
          if (next <= 0) {
            setIsRunning(false)
            onTick?.(0)
            onComplete?.()
            return 0
          }
          onTick?.(next)
          return next
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isRunning, onTick, onComplete, isExternalControl])

  const toggleTimer = () => {
    if (disabled || isExternalControl) return
    if (!isRunning && remainingSeconds === 0) {
      const totalMins = getTotalMinutes(hours, minutes)
      setRemainingSeconds(totalMins * 60)
    }
    const wasRunning = isRunning
    const willBeRunning = !wasRunning
    setIsRunning(willBeRunning)
    if (!wasRunning && willBeRunning) {
      const totalMins = getTotalMinutes(hours, minutes)
      onStart?.(totalMins)
    }
  }

  const resetTimer = () => {
    if (disabled) return
    setIsRunning(false)
    const totalMins = getTotalMinutes(hours, minutes)
    setRemainingSeconds(totalMins * 60)
    onTick?.(totalMins * 60)
  }

  const handleTimeChange = (deltaHours: number, deltaMinutes: number) => {
    if (disabled || isExternalControl || isRunning) return
    onDragStart?.()
    let newHours = hours + deltaHours
    let newMinutes = minutes + deltaMinutes
    
    // 분이 60 이상이면 시간으로 변환
    if (newMinutes >= 60) {
      newHours += Math.floor(newMinutes / 60)
      newMinutes = newMinutes % 60
    } else if (newMinutes < 0) {
      // 분이 음수이면 시간에서 빌려오기
      const borrow = Math.ceil(Math.abs(newMinutes) / 60)
      newHours -= borrow
      newMinutes += borrow * 60
    }
    
    // 시간이 음수이면 0으로 제한
    if (newHours < 0) {
      newHours = 0
      newMinutes = Math.max(0, newMinutes)
    }
    
    // 최소 1분은 보장
    const totalMins = getTotalMinutes(newHours, newMinutes)
    if (totalMins < 1) {
      newHours = 0
      newMinutes = 1
    }
    
    setHours(newHours)
    setMinutes(newMinutes)
    const finalTotalMins = getTotalMinutes(newHours, newMinutes)
    setRemainingSeconds(finalTotalMins * 60)
    onTimeSet?.(finalTotalMins)
    onDragMove?.(finalTotalMins)
    onDragEnd?.(finalTotalMins)
  }

  const handleHoursInputChange = (value: string) => {
    if (disabled || isExternalControl || isRunning) return
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0) {
      onDragStart?.()
      const newHours = num
      const totalMins = getTotalMinutes(newHours, minutes)
      if (totalMins >= 1) {
        setHours(newHours)
        setRemainingSeconds(totalMins * 60)
        onTimeSet?.(totalMins)
        onDragMove?.(totalMins)
        onDragEnd?.(totalMins)
      }
    }
  }

  const handleMinutesInputChange = (value: string) => {
    if (disabled || isExternalControl || isRunning) return
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0 && num < 60) {
      onDragStart?.()
      const newMinutes = num
      const totalMins = getTotalMinutes(hours, newMinutes)
      if (totalMins >= 1) {
        setMinutes(newMinutes)
        setRemainingSeconds(totalMins * 60)
        onTimeSet?.(totalMins)
        onDragMove?.(totalMins)
        onDragEnd?.(totalMins)
      }
    }
  }

  // 표시할 값 결정
  const effectiveRemainingSeconds = (externalMinutes !== null && externalMinutes !== undefined && !effectiveTimerState)
    ? externalMinutes * 60
    : remainingSeconds

  // 세션 정보
  const effectiveCurrentSession = isExternalControl && effectiveTimerState
    ? effectiveTimerState.currentSession
    : currentSession
  const effectiveTotalSessions = isExternalControl && effectiveTimerState
    ? effectiveTimerState.totalSessions
    : totalSessions

  // phase에 따른 타이틀 및 색상
  const currentPhase = isExternalControl && effectiveTimerState
    ? effectiveTimerState.phase
    : 'FOCUS'

  const isFinished = roomStatus === 'FINISHED'
  const isWaiting = roomStatus === 'WAITING'

  const phaseTitle = isEditingNextFocus
    ? '집중하기'
    : (isFinished ? '종료' : isWaiting ? '집중 시간 설정하기' : currentPhase === 'FOCUS' ? '집중하기' : currentPhase === 'BREAK' ? '휴식하기' : '완료')

  const colors = isEditingNextFocus
    ? focusColors
    : (isFinished ? finishedColors : currentPhase === 'BREAK' ? breakColors : focusColors)

  // 항상 초 단위까지 표시
  const formattedTime = formatTime(effectiveRemainingSeconds)
  const timeChars = formattedTime.split("")

  return (
    <div className="flex flex-col items-center gap-8 relative w-full">
      {/* 오른쪽 상단 톱니바퀴 아이콘 및 토글 메뉴 */}
      {!disabled && isExternalControl && effectiveTimerState && currentPhase === 'BREAK' && !isFinished && !isEditingNextFocus && (
        <div className="absolute top-0 right-0 flex flex-col items-end gap-2">
          <button
            onClick={() => setShowNextFocusButton(!showNextFocusButton)}
            className="p-2 rounded-full transition-all duration-300 hover:bg-opacity-20 flex items-center justify-center"
            style={{
              background: showNextFocusButton ? colors.buttonBgLight : 'transparent',
              color: colors.text,
            }}
            aria-label="설정"
          >
            <Settings className="h-5 w-5" />
          </button>
          
          {showNextFocusButton && (
            <button
              onClick={() => {
                setIsEditingNextFocus(true)
                setShowNextFocusButton(false)
                const defaultFocus = Math.floor(effectiveTimerState.phaseDurationSeconds / 60) || 25
                setEditingHours(Math.floor(defaultFocus / 60))
                setEditingMinutes(defaultFocus % 60)
              }}
              className="px-6 py-2 rounded-full font-sans font-medium text-base transition-all duration-300 hover-lift whitespace-nowrap"
              style={{
                background: "white",
                color: colors.text,
                border: `1px solid ${colors.shadow}`,
                backdropFilter: "blur(20px)",
                boxShadow: `0 4px 16px ${colors.shadow}`,
              }}
            >
              다음 집중 시간 변경
            </button>
          )}
        </div>
      )}

      {/* Title + session info */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: colors.main,
              boxShadow: `0 0 10px ${colors.shadow}`,
            }}
          />
          <span
            className="text-xl font-medium font-sans"
            style={{ color: colors.text }}
          >
            {phaseTitle}
          </span>
        </div>
        {!isWaiting && (
          <div
            className="text-sm font-sans"
            style={{ color: colors.textLight }}
          >
            현재 세션 {effectiveCurrentSession} / {effectiveTotalSessions}
          </div>
        )}
      </div>

      {/* 플립 타이머 표시 */}
      <div className="flex flex-col items-center gap-6">
        {/* 시간 설정 UI (WAITING 상태이거나 집중 시간 변경 모드일 때) */}
        {(!disabled && !isExternalControl && !isRunning && !isFinished) || (isEditingNextFocus) ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              {/* 시간 입력 */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    if (isEditingNextFocus) {
                      setEditingHours(editingHours + 1)
                    } else {
                      handleTimeChange(1, 0)
                    }
                  }}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  style={{
                    background: colors.buttonBgLight,
                    color: colors.text,
                    border: `1px solid ${colors.shadow}`,
                  }}
                >
                  <Plus className="h-5 w-5" />
                </button>
                
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={isEditingNextFocus ? editingHours : hours}
                    onChange={(e) => {
                      if (isEditingNextFocus) {
                        const num = parseInt(e.target.value, 10)
                        if (!isNaN(num) && num >= 0) {
                          setEditingHours(num)
                        }
                      } else {
                        handleHoursInputChange(e.target.value)
                      }
                    }}
                    className="w-16 text-center text-2xl font-bold font-sans border-0 bg-transparent focus:outline-none"
                    style={{ color: colors.text }}
                  />
                  <span className="text-sm font-sans" style={{ color: colors.textLight }}>
                    시간
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (isEditingNextFocus) {
                      const newHours = Math.max(0, editingHours - 1)
                      setEditingHours(newHours)
                    } else {
                      handleTimeChange(-1, 0)
                    }
                  }}
                  disabled={isEditingNextFocus ? editingHours <= 0 && editingMinutes <= 1 : getTotalMinutes(hours, minutes) <= 1}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  style={{
                    background: colors.buttonBgLight,
                    color: colors.text,
                    border: `1px solid ${colors.shadow}`,
                  }}
                >
                  <Minus className="h-5 w-5" />
                </button>
              </div>

              <span className="text-3xl font-bold" style={{ color: colors.text }}>:</span>

              {/* 분 입력 */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    if (isEditingNextFocus) {
                      let newHours = editingHours
                      let newMinutes = editingMinutes + 1
                      if (newMinutes >= 60) {
                        newHours += 1
                        newMinutes = 0
                      }
                      setEditingHours(newHours)
                      setEditingMinutes(newMinutes)
                    } else {
                      handleTimeChange(0, 1)
                    }
                  }}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  style={{
                    background: colors.buttonBgLight,
                    color: colors.text,
                    border: `1px solid ${colors.shadow}`,
                  }}
                >
                  <Plus className="h-5 w-5" />
                </button>
                
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={isEditingNextFocus ? editingMinutes : minutes}
                    onChange={(e) => {
                      if (isEditingNextFocus) {
                        const num = parseInt(e.target.value, 10)
                        if (!isNaN(num) && num >= 0 && num < 60) {
                          setEditingMinutes(num)
                        }
                      } else {
                        handleMinutesInputChange(e.target.value)
                      }
                    }}
                    className="w-16 text-center text-2xl font-bold font-sans border-0 bg-transparent focus:outline-none"
                    style={{ color: colors.text }}
                  />
                  <span className="text-sm font-sans" style={{ color: colors.textLight }}>
                    분
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (isEditingNextFocus) {
                      let newHours = editingHours
                      let newMinutes = editingMinutes - 1
                      if (newMinutes < 0) {
                        if (newHours > 0) {
                          newHours -= 1
                          newMinutes = 59
                        } else {
                          newMinutes = 0
                        }
                      }
                      setEditingHours(newHours)
                      setEditingMinutes(newMinutes)
                    } else {
                      handleTimeChange(0, -1)
                    }
                  }}
                  disabled={isEditingNextFocus ? editingHours <= 0 && editingMinutes <= 0 : getTotalMinutes(hours, minutes) <= 1}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  style={{
                    background: colors.buttonBgLight,
                    color: colors.text,
                    border: `1px solid ${colors.shadow}`,
                  }}
                >
                  <Minus className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* 플립 타이머 숫자 표시 */}
        <div className="flex items-center justify-center gap-2">
          {timeChars.map((ch, idx) =>
            ch === ":" ? (
              <span
                key={`colon-${idx}`}
                className="px-2 text-5xl md:text-6xl font-bold tabular-nums select-none"
                style={{ color: colors.text }}
              >
                :
              </span>
            ) : (
              <ThemedFlipDigit key={idx} digit={ch} />
            ),
          )}
        </div>
      </div>

      {/* 시작/초기화 버튼 */}
      {!disabled && !isExternalControl && !isFinished && (
        <div className="flex gap-4">
          <button
            onClick={toggleTimer}
            className="px-8 py-3 rounded-full font-sans font-medium text-lg transition-all duration-300 hover-lift"
            style={{
              background: isRunning ? colors.buttonBgLight : colors.buttonBg,
              color: isRunning ? colors.text : "white",
              border: `1px solid ${colors.shadow}`,
              backdropFilter: "blur(20px)",
              boxShadow: `0 8px 32px ${colors.shadow}`,
            }}
          >
            {isRunning ? "일시정지" : remainingSeconds === 0 ? "다시 시작" : "시작"}
          </button>
          <button
            onClick={resetTimer}
            className="px-8 py-3 rounded-full font-sans font-medium text-lg transition-all duration-300 hover-lift"
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              color: colors.text,
              border: "1px solid rgba(255, 255, 255, 0.3)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
            }}
          >
            초기화
          </button>
        </div>
      )}

      {/* 집중 시간 변경 모드 - 체크/X 버튼 */}
      {!disabled && isExternalControl && effectiveTimerState && isEditingNextFocus && (
        <div className="flex gap-4">
          <button
            onClick={() => {
              const totalMins = getTotalMinutes(editingHours, editingMinutes)
              if (totalMins >= 1) {
                onNextFocusMinutesSet?.(totalMins)
                setIsEditingNextFocus(false)
              }
            }}
            className="px-8 py-3 rounded-full font-sans font-medium text-lg transition-all duration-300 hover-lift flex items-center justify-center"
            style={{
              background: colors.buttonBg,
              color: "white",
              border: `1px solid ${colors.shadow}`,
              backdropFilter: "blur(20px)",
              boxShadow: `0 8px 32px ${colors.shadow}`,
            }}
          >
            <Check className="h-6 w-6" />
          </button>
          <button
            onClick={() => {
              setIsEditingNextFocus(false)
              const defaultFocus = Math.floor(effectiveTimerState.phaseDurationSeconds / 60) || 25
              setEditingHours(Math.floor(defaultFocus / 60))
              setEditingMinutes(defaultFocus % 60)
            }}
            className="px-8 py-3 rounded-full font-sans font-medium text-lg transition-all duration-300 hover-lift flex items-center justify-center"
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              color: colors.text,
              border: "1px solid rgba(255, 255, 255, 0.3)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
            }}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* 정지/재개 버튼 */}
      {!disabled && isExternalControl && effectiveTimerState && !isFinished && !isEditingNextFocus && (
        <div className="flex gap-4">
          <button
            onClick={() => {
              if (effectiveTimerState.running) {
                onPause?.()
              } else {
                onResume?.()
              }
            }}
            className="px-8 py-3 rounded-full font-sans font-medium text-lg transition-all duration-300 hover-lift flex items-center justify-center"
            style={{
              background: effectiveTimerState.running ? colors.buttonBgLight : colors.buttonBg,
              color: effectiveTimerState.running ? colors.text : "white",
              border: `1px solid ${colors.shadow}`,
              backdropFilter: "blur(20px)",
              boxShadow: `0 8px 32px ${colors.shadow}`,
            }}
          >
            {effectiveTimerState.running ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
