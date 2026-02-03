"use client"

import React, { useState, useRef, useCallback } from "react"

const colors = {
  // 시스템 primary/accent 팔레트에 맞춘 그린 톤
  main: "#2c5f2d",
  fill: "rgba(44, 95, 45, 0.9)",
  text: "rgba(44, 95, 45, 0.95)",
  tick: "rgba(44, 95, 45, 0.6)",
  shadow: "rgba(44, 95, 45, 0.3)",
}

interface PomodoroDialStaticProps {
  /** 분 단위 (0~60) */
  minutes?: number
}

export function PomodoroDialStatic({ minutes: initialMinutes = 50 }: PomodoroDialStaticProps) {
  const [minutes, setMinutes] = useState(initialMinutes)
  const [isDragging, setIsDragging] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  
  const size = 320
  const center = size / 2
  const radius = 130
  const handleRadius = 12

  const getAngleFromMinutes = (mins: number) => {
    return (mins / 60) * 360 - 90
  }

  const getMinutesFromAngle = (angle: number) => {
    let normalizedAngle = angle + 90
    if (normalizedAngle < 0) normalizedAngle += 360
    if (normalizedAngle >= 360) normalizedAngle -= 360
    return Math.round((normalizedAngle / 360) * 60)
  }

  const getPointOnCircle = (angle: number) => {
    const rad = (angle * Math.PI) / 180
    return {
      x: Math.round((center + radius * Math.cos(rad)) * 100) / 100,
      y: Math.round((center + radius * Math.sin(rad)) * 100) / 100,
    }
  }

  // Handle mouse/touch events for dragging
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true)
      ;(e.target as Element).setPointerCapture(e.pointerId)
    },
    []
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !svgRef.current) return

      const svg = svgRef.current
      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left - center
      const y = e.clientY - rect.top - center

      const angle = Math.atan2(y, x) * (180 / Math.PI)
      const mins = getMinutesFromAngle(angle)
      const clampedMins = Math.max(1, Math.min(60, mins === 0 ? 60 : mins))

      setMinutes(clampedMins)
    },
    [isDragging]
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

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

  // Tick marks
  const ticks = []
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * 360 - 90
    const rad = (angle * Math.PI) / 180
    const isMajor = i % 5 === 0
    const innerRadius = isMajor ? radius + 15 : radius + 12
    const outerRadius = isMajor ? radius + 25 : radius + 18

    // 반올림하여 서버/클라이언트 간 부동소수점 차이로 인한 hydration 에러 방지
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

  const handlePoint = getPointOnCircle(getAngleFromMinutes(minutes))

  return (
    <div className="flex items-center justify-center">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        className="cursor-pointer select-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Tick marks */}
        {ticks}

        {/* Filled pie section */}
        <path
          d={createPiePath(minutes)}
          fill={colors.fill}
          style={{
            filter: `drop-shadow(0 4px 12px ${colors.shadow})`,
          }}
        />

        {/* Center point */}
        <circle cx={center} cy={center} r={4} fill={colors.text} />

        {/* Draggable handle */}
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
      </svg>
    </div>
  )
}

