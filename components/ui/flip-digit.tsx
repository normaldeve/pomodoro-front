"use client"

import { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"

interface FlipDigitProps {
  digit: string
  className?: string
}

export function FlipDigit({ digit, className }: FlipDigitProps) {
  const [currentDigit, setCurrentDigit] = useState(digit)
  const [previousDigit, setPreviousDigit] = useState(digit)
  const [isFlipping, setIsFlipping] = useState(false)
  const flipTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (digit !== currentDigit) {
      if (flipTimeoutRef.current) {
        clearTimeout(flipTimeoutRef.current)
      }
      setPreviousDigit(currentDigit)
      setIsFlipping(true)
      setCurrentDigit(digit)

      flipTimeoutRef.current = setTimeout(() => {
        setIsFlipping(false)
        setPreviousDigit(digit)
      }, 800)
    }

    return () => {
      if (flipTimeoutRef.current) {
        clearTimeout(flipTimeoutRef.current)
      }
    }
  }, [digit, currentDigit])

  return (
    <div className={cn("flip-digit-wrapper", className)}>
      {/* Base card - 항상 현재 숫자 표시 */}
      <div className="flip-card-static">
        <div className="flip-half-top">
          <span className="flip-number">{currentDigit}</span>
        </div>
        <div className="flip-half-bottom">
          <span className="flip-number">{currentDigit}</span>
        </div>
        <div className="flip-line" />
      </div>

      {/* 플립 애니메이션 오버레이 */}
      {isFlipping && (
        <div className="flip-animation-container" key={`flip-${previousDigit}-${currentDigit}`}>
          <div className="flip-flap flip-flap-top">
            <div className="flip-flap-face flip-flap-front">
              <span className="flip-number">{previousDigit}</span>
            </div>
          </div>
          <div className="flip-flap flip-flap-bottom">
            <div className="flip-flap-face flip-flap-back">
              <span className="flip-number">{currentDigit}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}