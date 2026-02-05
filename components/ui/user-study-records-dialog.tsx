"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { CustomScrollbar } from "./custom-scrollbar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react"
import { getStudyHeatmap } from "@/lib/api"
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip"
import Image from "next/image"

export interface UserStudyRecordsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const colors = {
  // 시스템 primary 그린 팔레트
  main: "#2c5f2d",
  text: "rgba(45, 74, 62, 0.95)",
}

export function UserStudyRecordsDialog({ open, onOpenChange }: UserStudyRecordsDialogProps) {
  const [selectedYear, setSelectedYear] = useState(Math.max(new Date().getFullYear(), 2025))
  const [studyLevelMap, setStudyLevelMap] = useState<Map<string, number>>(new Map())
  const [studyMinutesMap, setStudyMinutesMap] = useState<Map<string, number>>(new Map())
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false)
  
  // 임시 데이터: 나의 뽀모 정보
  const [myPomoData] = useState({
    points: 3200,
    level: 3, // 1~5 레벨
  })
  
  // 레벨에 따른 이미지 경로 반환
  const getLevelImagePath = (level: number): string => {
    switch (level) {
      case 1:
        return "/images/level/level1png.png"
      case 2:
        return "/images/level/level2.png"
      case 3:
        return "/images/level/level3.png"
      case 4:
        return "/images/level/level4png.png"
      case 5:
        return "/images/level/level5.png"
      default:
        return "/images/level/level1png.png"
    }
  }

  // 공부 히트맵 데이터 불러오기
  useEffect(() => {
    if (!open) return

    const fetchHeatmap = async () => {
      setIsLoadingHeatmap(true)
      try {
        const response = await getStudyHeatmap(selectedYear)
        const levelMap = new Map<string, number>()
        const minutesMap = new Map<string, number>()
        response.records.forEach((record) => {
          levelMap.set(record.date, record.level)
          minutesMap.set(record.date, record.totalMinutes)
        })
        setStudyLevelMap(levelMap)
        setStudyMinutesMap(minutesMap)
      } catch (error) {
        console.error("Failed to fetch study heatmap:", error)
        setStudyLevelMap(new Map())
        setStudyMinutesMap(new Map())
      } finally {
        setIsLoadingHeatmap(false)
      }
    }

    fetchHeatmap()
  }, [open, selectedYear])

  // 로컬 시간대를 사용하여 날짜 문자열 생성 (YYYY-MM-DD)
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 전체 연도 달력 생성 (1월~12월)
  const generateCalendar = (year: number) => {
    const months: { date: Date; level: number }[][] = []
    
    // 1월부터 12월까지
    for (let month = 0; month < 12; month++) {
      const monthDate = new Date(year, month, 1)
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const firstDayOfWeek = monthDate.getDay()
      
      const monthDays: { date: Date; level: number }[] = []
      
      // 빈 칸 추가 (첫 주 시작 전)
      for (let i = 0; i < firstDayOfWeek; i++) {
        monthDays.push({ date: new Date(0), level: 0 })
      }
      
      // 날짜 추가
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day)
        const dateStr = formatDateString(date)
        const level = studyLevelMap.get(dateStr) ?? 0
        monthDays.push({ date, level })
      }
      
      months.push(monthDays)
    }
    
    return { year, months }
  }

  // 분 단위를 "X시간 Y분" 형태로 변환
  const formatStudyMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) {
      return `${mins}분`
    }
    if (mins === 0) {
      return `${hours}시간`
    }
    return `${hours}시간 ${mins}분`
  }

  interface StudyDayTooltipProps {
    dateStr: string
    totalMinutes: number
    children: React.ReactNode
  }

  const StudyDayTooltip: React.FC<StudyDayTooltipProps> = ({ dateStr, totalMinutes, children }) => {
    const hasStudy = totalMinutes > 0

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs">
            <div className="font-semibold mb-0.5">{dateStr}</div>
            {hasStudy ? (
              <div>공부 시간: {formatStudyMinutes(totalMinutes)}</div>
            ) : (
              <div>기록 없음</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  const calendarData = generateCalendar(selectedYear)

  // 공부 레벨(0~4)에 따른 색상 결정
  const getColorByLevel = (level: number) => {
    switch (level) {
      case 0:
        return "#9ca3af" // 더 진한 회색 (공부 없음)
      case 1:
        return "#033a16" // 가장 진한 연두색 (가장 적게 공부)
      case 2:
        return "#196c2e"
      case 3:
        return "#2ea043"
      case 4:
      default:
        return "#56d364" // 가장 연한 연두색 (가장 많이 공부)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col rounded-3xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.45), rgba(255,255,255,0.25))",
          backdropFilter: "blur(30px) saturate(180%)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
          border: "1px solid rgba(255, 255, 255, 0.6)",
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="text-2xl font-semibold text-center"
            style={{ color: colors.text }}
          >
            공부 기록
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="mypomo" className="flex-1 flex flex-col min-h-0 mt-4">
          <TabsList
            className="grid w-full grid-cols-2 mb-4 p-1"
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            <TabsTrigger
              value="mypomo"
              className="flex items-center gap-2 rounded-lg transition-all data-[state=active]:bg-white/40 data-[state=active]:backdrop-blur-[10px] data-[state=active]:shadow-sm"
              style={{
                color: colors.text,
              }}
            >
              <span>나의 뽀모</span>
            </TabsTrigger>
            <TabsTrigger
              value="records"
              className="flex items-center gap-2 rounded-lg transition-all data-[state=active]:bg-white/40 data-[state=active]:backdrop-blur-[10px] data-[state=active]:shadow-sm"
              style={{
                color: colors.text,
              }}
            >
              <span>공부 기록</span>
            </TabsTrigger>
          </TabsList>

          <CustomScrollbar className="flex-1 overflow-y-auto min-h-0">
            <TabsContent value="mypomo" className="mt-0">
              <div className="flex flex-col items-center justify-center gap-6 px-2 py-12">
                <Image
                  src="/images/home_icon.png"
                  alt="개발 중 안내 아이콘"
                  width={80}
                  height={80}
                  className="w-20 h-20 object-contain"
                />
                <div className="flex flex-col items-center gap-2 text-center">
                  <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
                    나의 뽀모도 기능 개발 중
                  </h3>
                  <p className="text-sm text-gray-600">
                    나의 뽀모도 기능은 현재 개발 중이에요.
                    <br />
                    곧 만나볼 수 있을 거예요!
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="records" className="mt-0">
              <div className="flex flex-col gap-4 px-2">
                <div className="mb-4">
              {/* 년도 표시 및 이동 버튼 */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  onClick={() => {
                    if (selectedYear > 2025) {
                      setSelectedYear(selectedYear - 1)
                    }
                  }}
                  disabled={selectedYear <= 2025}
                  className={`p-2 rounded-full transition-colors ${
                    selectedYear <= 2025
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:bg-white/50 cursor-pointer"
                  }`}
                  style={{ color: colors.text }}
                  aria-label="이전 년도"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold" style={{ color: colors.text }}>
                  {calendarData.year}년
                </h2>
                <button
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  className="p-2 rounded-full hover:bg-white/50 transition-colors"
                  style={{ color: colors.text }}
                  aria-label="다음 년도"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold" style={{ color: colors.text }}>
                  공부 기록
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ background: "#9ca3af" }} />
                      <span className="text-[10px] text-gray-500">0시간</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ background: "#033a16" }} />
                      <span className="text-[10px] text-gray-500">0~1시간</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ background: "#196c2e" }} />
                      <span className="text-[10px] text-gray-500">1~2시간</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ background: "#2ea043" }} />
                      <span className="text-[10px] text-gray-500">2~3시간</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ background: "#56d364" }} />
                      <span className="text-[10px] text-gray-500">3시간 이상</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 그리드 레이아웃: 4개씩 3줄 */}
              <div className="grid grid-cols-4 gap-3">
                {calendarData.months.map((monthDays, monthIndex) => {
                  const monthDate = monthDays.find(d => d.date.getTime() !== 0)?.date || new Date()
                  const today = new Date()
                  const isCurrentMonth = 
                    selectedYear === today.getFullYear() && 
                    monthDate.getMonth() === today.getMonth()
                  
                  return (
                    <div 
                      key={monthIndex} 
                      className="flex flex-col rounded-lg p-2 transition-all"
                      style={
                        isCurrentMonth
                          ? {
                              border: `2px solid ${colors.main}`,
                            }
                          : {}
                      }
                    >
                      <div 
                        className={`text-xs mb-1 text-center font-medium ${
                          isCurrentMonth ? "font-bold" : ""
                        }`}
                        style={isCurrentMonth ? { color: colors.text } : { color: "rgba(107, 114, 128, 1)" }}
                      >
                        {monthDate.getMonth() + 1}월
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {monthDays.map((day, dayIndex) => {
                          if (day.date.getTime() === 0) {
                            return <div key={dayIndex} className="w-3 h-3" />
                          }
                          const isCurrentMonthDay = day.date.getMonth() === monthDate.getMonth()
                          if (!isCurrentMonthDay) {
                            return <div key={dayIndex} className="w-3 h-3" />
                          }
                          const dateStr = formatDateString(day.date)
                          const totalMinutes = studyMinutesMap.get(dateStr) ?? 0

                          return (
                            <StudyDayTooltip
                              key={dayIndex}
                              dateStr={dateStr}
                              totalMinutes={totalMinutes}
                            >
                              <div
                                className="w-3 h-3 rounded-sm cursor-pointer"
                                style={{
                                  background: getColorByLevel(day.level),
                                }}
                              />
                            </StudyDayTooltip>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
            </TabsContent>
          </CustomScrollbar>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

