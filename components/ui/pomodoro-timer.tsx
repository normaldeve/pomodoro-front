"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { Pause, Play, Check, X, Settings } from "lucide-react"
import { TimerState } from "@/lib/websocket"

export interface PomodoroTimerProps {
  /**
   * 기본 분 설정 (1~60)
   * 기본값: 25
   */
  defaultMinutes?: number
  /**
   * 타이머 시간이 설정될 때 호출
   */
  onTimeSet?: (minutes: number) => void
  /**
   * 남은 시간이 변경될 때 호출
   */
  onTick?: (remainingSeconds: number) => void
  /**
   * 타이머가 완료되었을 때 호출
   */
  onComplete?: () => void
  /**
   * 타이머가 시작될 때 호출 (방장용 - 웹소켓으로 전송)
   */
  onStart?: (minutes: number) => void
  /**
   * 타이머 일시정지 시 호출 (방장용 - 웹소켓으로 전송)
   */
  onPause?: () => void
  /**
   * 타이머 재개 시 호출 (방장용 - 웹소켓으로 전송)
   */
  onResume?: () => void
  /**
   * 현재 세션 번호
   */
  currentSession?: number
  /**
   * 전체 세션 수
   */
  totalSessions?: number
  /**
   * 타이머 조작 비활성화 여부
   * true일 경우 타이머를 조작할 수 없음
   */
  disabled?: boolean
  /**
   * 백엔드에서 받은 타이머 상태 (멤버용 - 웹소켓으로 받은 값)
   * 이 값이 있으면 모든 타이머 상태를 이 값으로 제어
   */
  externalTimerState?: TimerState | null
  /**
   * 외부에서 제어하는 다이얼 분 값 (멤버용 - 방장이 드래그 중일 때)
   * 이 값이 있으면 다이얼을 이 값으로 업데이트
   */
  externalMinutes?: number | null
  /**
   * 드래그 시작 시 호출 (방장용)
   */
  onDragStart?: () => void
  /**
   * 드래그 중 호출 (방장용)
   */
  onDragMove?: (minutes: number) => void
  /**
   * 드래그 종료 시 호출 (방장용)
   */
  onDragEnd?: (minutes: number) => void
  /**
   * 다음 집중 시간 설정 시 호출 (방장용 - 쉬는 시간 중)
   */
  onNextFocusMinutesSet?: (minutes: number) => void
  /**
   * 방 상태 (FINISHED일 때 타이머 종료 표시)
   */
  roomStatus?: string
}

// 집중 시간 색상 (시스템 primary 그린 팔레트)
const focusColors = {
  main: "#2c5f2d",
  fill: "rgba(44, 95, 45, 0.9)",
  text: "rgba(44, 95, 45, 0.95)",
  tick: "rgba(44, 95, 45, 0.6)",
  shadow: "rgba(44, 95, 45, 0.3)",
  buttonBg: "rgba(44, 95, 45, 0.95)",
  buttonBgLight: "rgba(44, 95, 45, 0.2)",
  textLight: "rgba(44, 95, 45, 0.6)",
}

// 휴식 시간 색상 (accent를 기반으로 한 라이트 그린 팔레트)
const breakColors = {
  main: "#6f8f77",
  fill: "rgba(111, 143, 119, 0.9)",
  text: "rgba(54, 79, 63, 0.95)",
  tick: "rgba(111, 143, 119, 0.7)",
  shadow: "rgba(111, 143, 119, 0.35)",
  buttonBg: "rgba(111, 143, 119, 0.95)",
  buttonBgLight: "rgba(111, 143, 119, 0.2)",
  textLight: "rgba(111, 143, 119, 0.7)",
}

// 종료 색상 (회색)
const finishedColors = {
  main: "rgba(156, 163, 175, 1)",
  fill: "rgba(156, 163, 175, 0.85)",
  text: "rgba(156, 163, 175, 0.9)",
  tick: "rgba(156, 163, 175, 0.6)",
  shadow: "rgba(156, 163, 175, 0.3)",
  buttonBg: "rgba(156, 163, 175, 0.85)",
  buttonBgLight: "rgba(156, 163, 175, 0.2)",
  textLight: "rgba(156, 163, 175, 0.6)",
}

export function PomodoroTimer({
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
}: PomodoroTimerProps) {
  const initialMinutes = Math.min(60, Math.max(1, defaultMinutes))
  const [minutes, setMinutes] = useState(initialMinutes)
  const [isRunning, setIsRunning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(initialMinutes * 60)
  const [isDragging, setIsDragging] = useState(false)
  const [isEditingNextFocus, setIsEditingNextFocus] = useState(false)
  const [editingMinutes, setEditingMinutes] = useState(initialMinutes)
  const [showNextFocusButton, setShowNextFocusButton] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSentTimeRef = useRef<number>(0)
  const throttleDelay = 200 // 200ms마다 전송

  // 백엔드에서 받은 TimerState가 있으면 외부 제어
  const effectiveTimerState = externalTimerState
  // effectiveTimerState가 있으면 외부 제어 (정지 상태에서도 버튼 표시를 위해)
  const isExternalControl = effectiveTimerState !== null && effectiveTimerState !== undefined

  // 전체 다이얼 크기 (폭/높이) - 위아래/좌우 여유를 모두 넉넉하게 설정
  const size = 420
  const center = size / 2
  const radius = 130
  const handleRadius = 12

  // Calculate angle from minutes (0 at top, clockwise)
  const getAngleFromMinutes = (mins: number) => {
    return (mins / 60) * 360 - 90
  }

  // Calculate minutes from angle
  const getMinutesFromAngle = (angle: number) => {
    let normalizedAngle = angle + 90
    if (normalizedAngle < 0) normalizedAngle += 360
    if (normalizedAngle >= 360) normalizedAngle -= 360
    return Math.round((normalizedAngle / 360) * 60)
  }

  // Get point on circle from angle
  const getPointOnCircle = (angle: number) => {
    const rad = (angle * Math.PI) / 180
    return {
      x: Math.round((center + radius * Math.cos(rad)) * 100) / 100,
      y: Math.round((center + radius * Math.sin(rad)) * 100) / 100,
    }
  }

  // Create pie slice path
  const createPiePath = (mins: number) => {
    if (mins === 0) return ""
    if (mins === 60) {
      return `M ${center} ${center} m -${radius} 0 a ${radius} ${radius} 0 1 0 ${
        radius * 2
      } 0 a ${radius} ${radius} 0 1 0 -${radius * 2} 0`
    }

    const startAngle = -90
    const endAngle = getAngleFromMinutes(mins)
    const startPoint = getPointOnCircle(startAngle)
    const endPoint = getPointOnCircle(endAngle)
    const largeArcFlag = mins > 30 ? 1 : 0

    return `M ${center} ${center} L ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y} Z`
  }

  // 백엔드에서 받은 TimerState로 상태 동기화 (1초마다 업데이트)
  useEffect(() => {
    if (effectiveTimerState) {
      // remainingSeconds를 항상 동기화 (정지 상태에서도 정확한 시간 표시)
      setRemainingSeconds(effectiveTimerState.remainingSeconds)
      setIsRunning(effectiveTimerState.running)
      
      // phaseDurationSeconds를 분으로 변환하여 minutes 설정
      const phaseMinutes = Math.floor(effectiveTimerState.phaseDurationSeconds / 60)
      setMinutes(phaseMinutes)
      
      // phase가 BREAK에서 FOCUS로 변경되면 집중 시간 변경 모드 종료 및 버튼 숨김
      if (effectiveTimerState.phase === 'FOCUS' && isEditingNextFocus) {
        setIsEditingNextFocus(false)
        setShowNextFocusButton(false)
      }
    }
  }, [effectiveTimerState, isEditingNextFocus])

  // 외부에서 제어하는 다이얼 분 값 동기화 (방장이 드래그 중일 때)
  useEffect(() => {
    if (externalMinutes !== null && externalMinutes !== undefined && !effectiveTimerState) {
      // TimerState가 없을 때만 다이얼 드래그 시간 반영
      const clampedMinutes = Math.max(1, Math.min(60, externalMinutes))
      setMinutes(clampedMinutes)
      setRemainingSeconds(clampedMinutes * 60)
    }
  }, [externalMinutes, effectiveTimerState])


  // Handle mouse/touch events for dragging
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 집중 시간 변경 모드 중이거나, 외부 제어 중이거나, 로컬 타이머가 실행 중이면 드래그 불가
      if (isEditingNextFocus) {
        // 집중 시간 변경 모드에서는 드래그 가능
        setIsDragging(true)
        ;(e.target as Element).setPointerCapture(e.pointerId)
        return
      }
      if (isExternalControl || isRunning || disabled) return
      setIsDragging(true)
      ;(e.target as Element).setPointerCapture(e.pointerId)
      onDragStart?.()
    },
    [isEditingNextFocus, isExternalControl, isRunning, disabled, onDragStart]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !svgRef.current) return
      
      // 집중 시간 변경 모드 중
      if (isEditingNextFocus) {
        const svg = svgRef.current
        const rect = svg.getBoundingClientRect()
        const x = e.clientX - rect.left - center
        const y = e.clientY - rect.top - center

        const angle = Math.atan2(y, x) * (180 / Math.PI)
        const mins = getMinutesFromAngle(angle)
        const clampedMins = Math.max(1, Math.min(60, mins === 0 ? 60 : mins))

        setEditingMinutes(clampedMins)
        return
      }

      // 일반 드래그 모드
      if (isExternalControl || isRunning || disabled) return

      const svg = svgRef.current
      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left - center
      const y = e.clientY - rect.top - center

      const angle = Math.atan2(y, x) * (180 / Math.PI)
      const mins = getMinutesFromAngle(angle)
      const clampedMins = Math.max(1, Math.min(60, mins === 0 ? 60 : mins))

      setMinutes(clampedMins)
      setRemainingSeconds(clampedMins * 60)
      onTimeSet?.(clampedMins)

      // Throttle 적용하여 웹소켓 메시지 전송
      const now = Date.now()
      if (now - lastSentTimeRef.current > throttleDelay) {
        onDragMove?.(clampedMins)
        lastSentTimeRef.current = now
      }
    },
    [isDragging, isEditingNextFocus, isExternalControl, isRunning, disabled, onTimeSet, onDragMove, throttleDelay]
  )

  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      if (isEditingNextFocus) {
        // 집중 시간 변경 모드에서는 드래그 종료만 처리 (확정은 체크 버튼으로)
      } else {
        onDragEnd?.(minutes)
      }
    }
    setIsDragging(false)
  }, [isDragging, isEditingNextFocus, minutes, onDragEnd])

  // Timer logic (외부 제어가 아닐 때만 로컬 타이머 실행)
  useEffect(() => {
    // 외부 제어 중이면 로컬 타이머를 실행하지 않음 (백엔드에서 1초마다 업데이트)
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
      setRemainingSeconds(minutes * 60)
    }
    const wasRunning = isRunning
    const willBeRunning = !wasRunning
    setIsRunning(willBeRunning)
    
    // 타이머가 시작될 때 (이전에 멈춰있었고 지금 시작하는 경우)
    if (!wasRunning && willBeRunning) {
      onStart?.(minutes)
    }
  }

  const resetTimer = () => {
    if (disabled) return
    setIsRunning(false)
    setRemainingSeconds(minutes * 60)
    onTick?.(minutes * 60)
  }

  // 표시할 값 결정
  // 다이얼 드래그 중이면 externalMinutes 사용, 아니면 remainingSeconds 사용
  const effectiveRemainingSeconds = (externalMinutes !== null && externalMinutes !== undefined && !effectiveTimerState)
    ? externalMinutes * 60
    : remainingSeconds
  const displayMinutes = Math.floor(effectiveRemainingSeconds / 60)
  const displaySeconds = effectiveRemainingSeconds % 60
  
  // 다이얼에 표시할 분 계산
  // 집중 시간 변경 모드 중이면: editingMinutes 사용
  // 외부 제어 중이면: 남은 시간을 표시 (진행률 반영)
  // 다이얼 드래그 중이면: externalMinutes 사용
  // 로컬 제어 중이면: 실행 중이면 남은 시간, 멈춰있으면 설정된 시간
  const currentMinutesForDisplay = isEditingNextFocus
    ? editingMinutes  // 집중 시간 변경 모드 중
    : (isExternalControl && effectiveTimerState)
    ? effectiveTimerState.remainingSeconds / 60  // 남은 시간을 분으로 변환 (진행률 반영)
    : (externalMinutes !== null && externalMinutes !== undefined)
    ? externalMinutes  // 다이얼 드래그 중일 때
    : (isRunning ? remainingSeconds / 60 : minutes)
  
  const handlePoint = getPointOnCircle(getAngleFromMinutes(currentMinutesForDisplay))
  
  // 세션 정보 (외부 제어 중이면 TimerState에서 가져오기)
  const effectiveCurrentSession = isExternalControl && effectiveTimerState
    ? effectiveTimerState.currentSession
    : currentSession
  const effectiveTotalSessions = isExternalControl && effectiveTimerState
    ? effectiveTimerState.totalSessions
    : totalSessions
  
  // phase에 따른 타이틀 및 색상
  // 타이머 phase는 FOCUS 또는 BREAK만 가능 (FINISHED는 방 상태로만 판단)
  const currentPhase = isExternalControl && effectiveTimerState
    ? effectiveTimerState.phase
    : 'FOCUS'
  
  // 방 상태가 FINISHED이면 종료 상태로 표시
  const isFinished = roomStatus === 'FINISHED'
  // 방 상태가 WAITING이면 시작 전 상태
  const isWaiting = roomStatus === 'WAITING'
  
  // 집중 시간 변경 모드일 때는 집중하기로 표시
  const phaseTitle = isEditingNextFocus 
    ? '집중하기' 
    : (isFinished ? '종료' : isWaiting ? '집중 시간 설정하기' : currentPhase === 'FOCUS' ? '집중하기' : currentPhase === 'BREAK' ? '휴식하기' : '완료')
  
  // 색상 선택: 집중 시간 변경 모드일 때는 집중 시간 색상(빨간색) 사용, 종료 시 회색
  const colors = isEditingNextFocus 
    ? focusColors 
    : (isFinished ? finishedColors : currentPhase === 'BREAK' ? breakColors : focusColors)

  // Generate tick marks
  const ticks = []
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * 360 - 90
    const rad = (angle * Math.PI) / 180
    const isMajor = i % 5 === 0
    const innerRadius = isMajor ? radius + 15 : radius + 12
    const outerRadius = isMajor ? radius + 25 : radius + 18

    const x1 = Math.round((center + innerRadius * Math.cos(rad)) * 100) / 100
    const y1 = Math.round((center + innerRadius * Math.sin(rad)) * 100) / 100
    const x2 = Math.round((center + outerRadius * Math.cos(rad)) * 100) / 100
    const y2 = Math.round((center + outerRadius * Math.sin(rad)) * 100) / 100

    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={colors.tick}
        strokeWidth={isMajor ? 2.5 : 1.5}
        strokeLinecap="round"
      />
    )
  }

  // Generate numbers (5분 단위로 표시: 0, 5, 10, ... , 55)
  const numbers = []
  const labelMinutes = []
  for (let m = 0; m < 60; m += 5) {
    labelMinutes.push(m)
  }
  for (const minute of labelMinutes) {
    const angle = (minute / 60) * 360 - 90
    const rad = (angle * Math.PI) / 180
    const numberRadius = radius + 45

    const x = Math.round((center + numberRadius * Math.cos(rad)) * 100) / 100
    const y = Math.round((center + numberRadius * Math.sin(rad)) * 100) / 100

    numbers.push(
      <text
        key={minute}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={colors.text}
        fontSize="16"
        fontWeight="500"
        className="font-sans select-none"
      >
        {minute}
      </text>
    )
  }

  return (
    <div className="flex flex-col items-center gap-8 relative w-full">
      {/* 오른쪽 상단 톱니바퀴 아이콘 및 토글 메뉴 - 쉬는 시간 중에만 표시 (방장용), 종료 시 숨김 */}
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
          
          {/* 토글 형식으로 나타나는 다음 집중 시간 변경 버튼 */}
          {showNextFocusButton && (
            <button
              onClick={() => {
                setIsEditingNextFocus(true)
                setShowNextFocusButton(false) // 수정 모드로 진입하면 버튼 숨김
                // 현재 기본 집중 시간으로 초기화 (다음 집중 시간이 설정되어 있으면 그것을 사용, 아니면 기본값)
                // 백엔드에서 nextFocusMinutes를 받을 수 없으므로, phaseDurationSeconds를 사용하거나 기본값 사용
                const defaultFocus = Math.floor(effectiveTimerState.phaseDurationSeconds / 60) || 25
                setEditingMinutes(defaultFocus)
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
            className="text-2xl font-medium font-sans"
            style={{ color: colors.text }}
          >
            {phaseTitle}
          </span>
        </div>
        {/* 세션 정보는 WAITING 상태가 아닐 때만 표시 */}
        {!isWaiting && (
          <div
            className="text-sm font-sans"
            style={{ color: colors.textLight }}
          >
            현재 세션 {effectiveCurrentSession} / {effectiveTotalSessions}
          </div>
        )}
      </div>

      {/* Timer dial */}
      <div className="relative">
        <svg
          ref={svgRef}
          width={size}
          height={size}
          className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ pointerEvents: disabled ? "none" : "auto" }}
        >
          {/* Tick marks */}
          {ticks}

          {/* Numbers */}
          {numbers}

          {/* Filled pie section */}
          <path
            d={createPiePath(currentMinutesForDisplay)}
            // 색상은 항상 동일하게 유지
            fill={colors.fill}
            style={{
              filter: `drop-shadow(0 4px 12px ${colors.shadow})`,
            }}
          />

          {/* Center point */}
          <circle cx={center} cy={center} r={4} fill={colors.text} />

          {/* Draggable handle - 집중 시간 변경 모드 중이거나, 일반 드래그 모드일 때 표시 */}
          {((isEditingNextFocus) || (!isRunning && !disabled && !isExternalControl)) && (
            <circle
              cx={handlePoint.x}
              cy={handlePoint.y}
              r={handleRadius}
              fill="white"
              stroke="rgba(200, 200, 200, 0.8)"
              strokeWidth={2}
              style={{
                cursor: "grab",
                filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2))",
              }}
              onPointerDown={handlePointerDown}
            />
          )}
        </svg>
      </div>

      {/* Time display */}
      <div
        className="text-6xl font-bold font-sans tabular-nums"
        style={{ color: colors.text }}
      >
        {displayMinutes.toString().padStart(2, "0")}
        <span className="text-4xl">:</span>
        {displaySeconds.toString().padStart(2, "0")}
      </div>

      {/* 시작/초기화 버튼 - 타이머 시작 전에만 표시 (방장용), 종료 시 숨김 */}
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
              onNextFocusMinutesSet?.(editingMinutes)
              setIsEditingNextFocus(false)
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
              // 취소 시 현재 phaseDurationSeconds를 사용하여 초기화
              const defaultFocus = Math.floor(effectiveTimerState.phaseDurationSeconds / 60) || 25
              setEditingMinutes(defaultFocus)
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

      {/* 정지/재개 버튼 - 타이머 시작 후에만 표시 (방장용), 집중 시간 변경 모드가 아닐 때만, 종료 시 숨김 */}
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

