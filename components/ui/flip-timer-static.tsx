"use client"

import { ThemedFlipDigit } from "./themed-flip-digit"
import { cn } from "@/lib/utils"

interface FlipTimerStaticProps {
  /** 표시할 시간(초). 기본값: 25분 */
  seconds?: number
  /** 프리뷰 모드 (작은 크기로 표시). 기본값: false */
  preview?: boolean
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function FlipTimerStatic({ seconds = 25 * 60, preview = false }: FlipTimerStaticProps) {
  const formatted = formatTime(seconds)
  const chars = formatted.split("")

  // 포모도로 다이얼과 동일한 방식: 고정 크기로 렌더링하고 사용하는 쪽에서 scale로 조절
  // 포모도로: 320px * scale-50 = 160px
  // 플립 타이머도 비슷한 크기로: 각 숫자 카드 약 32px, 전체 약 160px
  const colonSize = preview ? "text-2xl" : "text-3xl sm:text-4xl"
  const gapSize = preview ? "gap-1" : "gap-1.5"

  return (
    <div className="flex items-center justify-center">
      <div className={cn("flex items-center", gapSize)}>
        {chars.map((ch, idx) =>
          ch === ":" ? (
            <span
              key={`colon-${idx}`}
              className={cn(
                "px-1 font-semibold tabular-nums select-none text-[#2c5f2d]",
                colonSize,
              )}
            >
              :
            </span>
          ) : (
            <ThemedFlipDigit key={idx} digit={ch} preview={preview} />
          ),
        )}
      </div>
    </div>
  )
}

