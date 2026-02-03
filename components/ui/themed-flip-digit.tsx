"use client"

import { useEffect, useState, useRef } from "react"
import { useTheme } from "./theme-context"
import { themes } from "@/lib/themes"
import { cn } from "@/lib/utils"

interface ThemedFlipDigitProps {
  digit: string
  /** 프리뷰 모드 (작은 크기로 표시). 기본값: false */
  preview?: boolean
}

export function ThemedFlipDigit({ digit, preview = false }: ThemedFlipDigitProps) {
  const { theme } = useTheme()
  const themeConfig = themes[theme]

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

  // Neon glow effect
  const neonGlow = theme === "neon" ? "shadow-[0_0_20px_rgba(34,211,238,0.4),inset_0_0_20px_rgba(34,211,238,0.1)]" : ""
  const neonTextGlow =
    theme === "neon" ? "[text-shadow:0_0_10px_rgba(34,211,238,0.8),0_0_20px_rgba(34,211,238,0.5)]" : ""

  // Terminal scanline effect
  const terminalEffect =
    theme === "terminal"
      ? "after:absolute after:inset-0 after:bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] after:bg-[length:100%_4px] after:pointer-events-none"
      : ""

  // Luxury gold border
  const luxuryBorder = theme === "luxury" ? "ring-1 ring-amber-500/30" : ""

  // Retro texture
  const retroTexture = theme === "retro" ? "bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.02)_100%)]" : ""

  // 프리뷰 모드일 때 포모도로 다이얼과 비슷한 크기 (320px * scale-50 = 160px)
  // 플립 타이머 "25:00" (5문자)를 160px 너비에 맞춤: 각 카드 약 32px
  const containerSize = preview
    ? "w-16 h-24" // 프리뷰용 크기 (64px * 96px, scale-50 적용 시 32px * 48px)
    : "w-10 h-14 sm:w-14 sm:h-20 md:w-[4.5rem] md:h-[6.5rem] lg:w-[5.5rem] lg:h-32"

  const digitFontSize = preview
    ? "text-2xl" // 프리뷰용 폰트 (scale-50 적용 시 적절한 크기)
    : "text-3xl sm:text-5xl md:text-6xl lg:text-7xl"

  return (
    <div
      className={cn(
        "relative",
        containerSize,
        "[perspective:300px]",
        themeConfig.fontClass,
      )}
    >
      {/* Base card */}
      <div
        className={cn(
          "absolute inset-0 rounded-lg overflow-hidden",
          themeConfig.card,
          themeConfig.shadow,
          themeConfig.border,
          "border",
          neonGlow,
          luxuryBorder,
          terminalEffect,
        )}
      >
        {/* Top half */}
        <div
          className={cn(
            "absolute left-0 right-0 top-0 h-1/2",
            "flex items-end justify-center overflow-hidden",
            "rounded-t-lg",
            themeConfig.card,
            retroTexture,
          )}
        >
          <span
            className={cn(
              digitFontSize,
              "font-bold translate-y-1/2",
              "tabular-nums select-none",
              themeConfig.cardForeground,
              neonTextGlow,
            )}
          >
            {currentDigit}
          </span>
        </div>

        {/* Bottom half */}
        <div
          className={cn(
            "absolute left-0 right-0 bottom-0 h-1/2",
            "flex items-start justify-center overflow-hidden",
            "rounded-b-lg",
            themeConfig.card,
            theme === "minimal-light" || theme === "monochrome" || theme === "glass"
              ? "bg-gradient-to-b from-black/[0.03] to-transparent"
              : theme === "dark" || theme === "neon" || theme === "terminal" || theme === "luxury"
                ? "bg-gradient-to-b from-white/[0.03] to-transparent"
                : "bg-gradient-to-b from-black/[0.05] to-transparent",
          )}
        >
          <span
            className={cn(
              digitFontSize,
              "font-bold -translate-y-1/2",
              "tabular-nums select-none",
              themeConfig.cardForeground,
              neonTextGlow,
            )}
          >
            {currentDigit}
          </span>
        </div>

        {/* Divider line */}
        <div
          className={cn(
            "absolute top-1/2 left-0 right-0 h-px -translate-y-px z-10",
            theme === "neon"
              ? "bg-cyan-500/50"
              : theme === "terminal"
                ? "bg-green-500/30"
                : theme === "luxury"
                  ? "bg-amber-500/30"
                  : theme === "dark"
                    ? "bg-white/10"
                    : "bg-black/10",
          )}
        />
      </div>

      {/* Flip animation overlay */}
      {isFlipping && (
        <div className="absolute inset-0 pointer-events-none" key={`flip-${previousDigit}-${currentDigit}`}>
          {/* Top flap flipping down */}
          <div
            className={cn(
              "absolute left-0 right-0 top-0 h-1/2",
              "[transform-style:preserve-3d] [backface-visibility:hidden]",
              "origin-bottom z-20",
              "animate-[flapDown_800ms_cubic-bezier(0.33,0,0.1,1)_forwards]",
            )}
          >
            <div
              className={cn(
                "absolute inset-0 flex items-end justify-center overflow-hidden",
                "rounded-t-lg border",
                themeConfig.card,
                themeConfig.border,
                themeConfig.shadow,
                "[backface-visibility:hidden]",
                neonGlow,
              )}
            >
              <span
                className={cn(
                  digitFontSize,
                  "font-bold translate-y-1/2",
                  "tabular-nums select-none",
                  themeConfig.cardForeground,
                  neonTextGlow,
                )}
              >
                {previousDigit}
              </span>
            </div>
          </div>

          {/* Bottom flap flipping up */}
          <div
            className={cn(
              "absolute left-0 right-0 bottom-0 h-1/2",
              "[transform-style:preserve-3d] [backface-visibility:hidden]",
              "origin-top z-10",
              "[transform:rotateX(180deg)]",
              "animate-[flapUp_800ms_cubic-bezier(0.33,0,0.1,1)_forwards]",
            )}
          >
            <div
              className={cn(
                "absolute inset-0 flex items-start justify-center overflow-hidden",
                "rounded-b-lg border",
                themeConfig.card,
                themeConfig.border,
                "[backface-visibility:hidden]",
                neonGlow,
              )}
            >
              <span
                className={cn(
                  digitFontSize,
                  "font-bold -translate-y-1/2",
                  "tabular-nums select-none",
                  themeConfig.cardForeground,
                  neonTextGlow,
                )}
              >
                {currentDigit}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
