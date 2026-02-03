export type ThemeConfig = {
  fontClass: string
  card: string
  cardForeground: string
  border: string
  shadow: string
}

// 각 테마별 카드/텍스트/테두리/그림자 스타일 정의
const baseCard =
  "bg-card/90 backdrop-blur-xl border border-border/60"

export const themes: Record<string, ThemeConfig> = {
  // 기본 라이트 스타일
  "minimal-light": {
    fontClass: "font-sans",
    card: baseCard + " bg-white/95",
    cardForeground: "text-slate-900",
    border: "border-slate-200/70",
    shadow: "shadow-[0_18px_50px_rgba(15,23,42,0.18)]",
  },
  // 흑백 느낌
  monochrome: {
    fontClass: "font-sans",
    card: baseCard + " bg-slate-900/95",
    cardForeground: "text-slate-50",
    border: "border-slate-700/80",
    shadow: "shadow-[0_20px_60px_rgba(15,23,42,0.7)]",
  },
  // 유리 느낌
  glass: {
    fontClass: "font-sans",
    card: "glass-effect bg-white/20",
    cardForeground: "text-slate-900",
    border: "border-white/70",
    shadow: "shadow-[0_22px_70px_rgba(15,23,42,0.35)]",
  },
  // next-themes 기본 값 대응
  light: {
    fontClass: "font-sans",
    card: baseCard + " bg-white/95",
    cardForeground: "text-slate-900",
    border: "border-slate-200/70",
    shadow: "shadow-[0_18px_50px_rgba(15,23,42,0.18)]",
  },
  system: {
    fontClass: "font-sans",
    card: baseCard + " bg-white/95",
    cardForeground: "text-slate-900",
    border: "border-slate-200/70",
    shadow: "shadow-[0_18px_50px_rgba(15,23,42,0.18)]",
  },
}

