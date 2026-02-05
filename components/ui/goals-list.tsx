"use client"

import React, { useState, useEffect } from "react"
import { Plus, X } from "lucide-react"
import { CustomScrollbar } from "./custom-scrollbar"
import { createGoal, getMyGoals, toggleGoal, deleteGoal, StudyGoalResponse } from "@/lib/api"

export interface Goal {
  id: number
  text: string
  completed: boolean
}

export interface GoalsListProps {
  /**
   * 방 ID (필수)
   */
  roomId: number
  /**
   * 방 상태 (FINISHED일 때 목표 작성 비활성화)
   */
  roomStatus?: string
}

const colors = {
  // 시스템 primary 그린 팔레트
  main: "#2c5f2d",
  text: "rgba(45, 74, 62, 0.95)",
  textLight: "rgba(45, 74, 62, 0.7)",
  shadow: "rgba(45, 74, 62, 0.35)",
}

export function GoalsList({ roomId, roomStatus }: GoalsListProps) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const isFinished = roomStatus === 'FINISHED'

  // API 응답을 Goal 형식으로 변환
  const mapToGoal = (response: StudyGoalResponse): Goal => ({
    id: response.id,
    text: response.content,
    completed: response.isCompleted,
  })

  // 초기 목표 목록 로드
  useEffect(() => {
    const loadGoals = async () => {
      if (!roomId) return
      
      setIsLoading(true)
      try {
        const response = await getMyGoals(roomId)
        const mappedGoals = response.map(mapToGoal)
        setGoals(mappedGoals)
      } catch (error) {
        console.error("목표 목록 로드 실패:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadGoals()
  }, [roomId])

  const handleAddGoal = async () => {
    if (!inputValue.trim() || isFinished) return

    const content = inputValue.trim()
    setInputValue("")

    try {
      const response = await createGoal(roomId, { content })
      const newGoal = mapToGoal(response)
      setGoals([...goals, newGoal])
    } catch (error) {
      console.error("목표 생성 실패:", error)
      setInputValue(content)
    }
  }

  const handleToggleGoal = async (id: number) => {
    if (isFinished) return
    
    const previousGoals = goals
    const updatedGoals = goals.map((goal) =>
      goal.id === id ? { ...goal, completed: !goal.completed } : goal
    )
    setGoals(updatedGoals)

    try {
      await toggleGoal(id)
      const response = await getMyGoals(roomId)
      const mappedGoals = response.map(mapToGoal)
      setGoals(mappedGoals)
    } catch (error) {
      console.error("목표 토글 실패:", error)
      setGoals(previousGoals)
    }
  }

  const handleDeleteGoal = async (id: number) => {
    if (isFinished) return
    
    const previousGoals = goals
    const updatedGoals = goals.filter((goal) => goal.id !== id)
    setGoals(updatedGoals)

    try {
      await deleteGoal(id)
      const response = await getMyGoals(roomId)
      const mappedGoals = response.map(mapToGoal)
      setGoals(mappedGoals)
    } catch (error) {
      console.error("목표 삭제 실패:", error)
      setGoals(previousGoals)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleAddGoal()
    }
  }

  return (
    <div
      className="flex flex-col rounded-3xl w-full h-full bg-gradient-to-br from-white/70 via-white/45 to-white/25 backdrop-blur-3xl border border-white/60 shadow-[0_24px_80px_rgba(0,0,0,0.16)]"
    >
      {/* Header */}
      <div
        className="px-6 py-4 border-b"
        style={{
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: colors.main,
              boxShadow: `0 0 10px ${colors.shadow}`,
            }}
          />
          <span
            className="text-lg font-medium font-sans"
            style={{ color: colors.text }}
          >
            목표
          </span>
        </div>
      </div>

      {/* Goals List */}
      <CustomScrollbar className="flex-1 overflow-y-auto px-4 py-4 space-y-2 min-h-0 max-h-full">
        {isLoading ? (
          <div
            className="text-center py-8 text-sm font-sans"
            style={{ color: colors.textLight }}
          >
            로딩 중...
          </div>
        ) : goals.length === 0 ? (
          <div
            className="text-center py-8 text-sm font-sans"
            style={{ color: colors.textLight }}
          >
            목표를 추가해보세요
          </div>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="flex items-center gap-3 px-3 py-2 rounded-xl border border-white/60"
              style={{
                backgroundColor: goal.completed ? "rgba(197, 212, 192, 0.4)" : "rgba(197, 212, 192, 0.6)",
                backdropFilter: "blur(10px)",
                opacity: goal.completed ? 0.6 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={goal.completed}
                onChange={() => handleToggleGoal(goal.id)}
                disabled={isFinished}
                className="w-4 h-4 rounded border-2"
                style={{
                  accentColor: colors.main,
                  borderColor: colors.textLight,
                  cursor: isFinished ? "not-allowed" : "pointer",
                  opacity: isFinished ? 0.5 : 1,
                }}
              />
              <span
                className={`flex-1 text-sm font-sans ${
                  goal.completed ? "line-through" : ""
                }`}
                style={{
                  // 등록된 목표 텍스트는 기본적으로 검정색, 완료된 항목만 약간 옅은 회색
                  color: goal.completed ? "#6b7280" : "#111827",
                }}
              >
                {goal.text}
              </span>
              <button
                onClick={() => handleDeleteGoal(goal.id)}
                disabled={isFinished}
                className="p-1 rounded-full transition-colors"
                style={{
                  cursor: isFinished ? "not-allowed" : "pointer",
                  opacity: isFinished ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isFinished) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.4)"
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isFinished) {
                    e.currentTarget.style.background = "transparent"
                  }
                }}
                aria-label="목표 삭제"
              >
                <X size={14} style={{ color: colors.textLight }} />
              </button>
            </div>
          ))
        )}
      </CustomScrollbar>

      {/* Input area */}
      <div
        className="px-4 py-4 border-t"
        style={{
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            background: "rgba(255, 255, 255, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => !isFinished && setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isFinished ? "세션이 종료되어 목표를 추가할 수 없습니다" : "목표를 입력하세요..."}
            disabled={isFinished}
            className="flex-1 bg-transparent outline-none text-sm font-sans placeholder:text-gray-400"
            style={{ 
              color: colors.text,
              cursor: isFinished ? "not-allowed" : "text",
              opacity: isFinished ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleAddGoal}
            disabled={!inputValue.trim() || isFinished}
            className="p-2 rounded-full transition-all duration-200"
            style={{
              background: isFinished || !inputValue.trim()
                ? "rgba(45, 74, 62, 0.15)" // 비활성 상태 연한 그린
                : colors.main,
              color: "white",
              cursor: isFinished || !inputValue.trim() ? "not-allowed" : "pointer",
              opacity: isFinished ? 0.5 : 1,
              transform: !isFinished && inputValue.trim() ? "scale(1)" : "scale(1)",
            }}
            onMouseEnter={(e) => {
              if (!isFinished && inputValue.trim()) {
                e.currentTarget.style.transform = "scale(1.1)"
              }
            }}
            onMouseLeave={(e) => {
              if (!isFinished && inputValue.trim()) {
                e.currentTarget.style.transform = "scale(1)"
              }
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
