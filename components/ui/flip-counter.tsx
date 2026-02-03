"use client"

import { FlipDigit } from "./flip-digit"
import { cn } from "@/lib/utils"

interface FlipCounterProps {
  value: number
  className?: string
}

export function FlipCounter({ value, className }: FlipCounterProps) {
  const formattedValue = value.toLocaleString()
  const characters = formattedValue.split("")

  return (
    <div className={cn("flex items-center", className)}>
      {characters.map((char, index) => {
        if (char === ",") {
          return <span key={index} className="mx-0.5 text-foreground/60">,</span>
        }
        return <FlipDigit key={index} digit={char} />
      })}
    </div>
  )
}