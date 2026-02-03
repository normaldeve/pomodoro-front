"use client"

import { useTheme as useNextTheme, type ThemeProviderProps } from "next-themes"

// 이 프로젝트에서 사용할 커스텀 테마 이름들
export type AppTheme =
  | "minimal-light"
  | "monochrome"
  | "glass"
  | "dark"
  | "neon"
  | "terminal"
  | "luxury"
  | "retro"
  | "system"
  | "light"
  | string

// next-themes의 useTheme를 thin wrapper로 감싸서 ThemedFlipDigit에서 사용
export function useTheme() {
  const { theme, setTheme, systemTheme, resolvedTheme, ...rest } = useNextTheme()

  // theme가 undefined인 경우를 대비해 기본값 설정
  const safeTheme = (theme ?? resolvedTheme ?? systemTheme ?? "minimal-light") as AppTheme

  return {
    theme: safeTheme,
    setTheme,
    systemTheme,
    resolvedTheme,
    ...rest,
  }
}

// 필요시 외부에서 타입 재사용할 수 있도록 export
export type AppThemeProviderProps = ThemeProviderProps

