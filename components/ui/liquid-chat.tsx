"use client"

import React, { useState, useRef, useEffect } from "react"
import { Send } from "lucide-react"
import { CustomScrollbar } from "./custom-scrollbar"

export interface LiquidChatMessage {
  id: number
  text: string
  sender: "user" | "system"
  timestamp: Date
  userName?: string
  userProfileUrl?: string | null
}

export interface LiquidChatProps {
  /**
   * 메시지 배열 (웹소켓으로 받은 모든 메시지)
   */
  messages?: LiquidChatMessage[]
  /**
   * 메시지 전송 시 호출되는 콜백
   */
  onSend?: (message: string) => void
  /**
   * 현재 사용자 이름
   * 기본값: "사용자"
   */
  currentUserName?: string
  /**
   * 이전 메시지 로드 콜백 (무한 스크롤)
   * lastMessageId: 가장 오래된 메시지의 ID
   */
  onLoadMore?: (lastMessageId: number) => Promise<void>
  /**
   * 더 이상 로드할 메시지가 없는지 여부
   */
  hasMore?: boolean
  /**
   * 메시지 로딩 중 여부
   */
  isLoadingMore?: boolean
  /**
   * 초기 로드 완료 여부 (초기 메시지 로드 후 스크롤을 맨 아래로 이동하기 위해)
   */
  isInitialLoadComplete?: boolean
}

const colors = {
  // 시스템 primary 그린 팔레트
  main: "#2c5f2d",
  text: "rgba(45, 74, 62, 0.95)",
  textLight: "rgba(45, 74, 62, 0.7)",
  shadow: "rgba(45, 74, 62, 0.35)",
}

export function LiquidChat({
  messages: externalMessages = [],
  onSend,
  currentUserName = "사용자",
  onLoadMore,
  hasMore = true,
  isLoadingMore = false,
  isInitialLoadComplete = false,
}: LiquidChatProps) {
  const [messages, setMessages] = useState<LiquidChatMessage[]>(externalMessages)
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollPositionRef = useRef<number>(0)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isLoadingRef = useRef(false)
  const previousScrollHeightRef = useRef<number>(0)
  const justLoadedOlderMessagesRef = useRef(false)

  const scrollToBottom = () => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }

  // 입력 필드 클릭 시 전체 페이지 스크롤 방지
  const handleInputMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
    scrollPositionRef.current = window.scrollY
    e.preventDefault()
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
  }

  // 입력 필드 포커스 시 전체 페이지 스크롤 방지
  const handleInputFocus = () => {
    scrollPositionRef.current = window.scrollY
    // 여러 프레임에 걸쳐 스크롤 위치 유지
    const restoreScroll = () => {
      window.scrollTo(0, scrollPositionRef.current)
    }
    setTimeout(restoreScroll, 0)
    requestAnimationFrame(restoreScroll)
    setTimeout(restoreScroll, 10)
    setTimeout(restoreScroll, 50)
    setTimeout(restoreScroll, 100)
  }

  // 입력 필드가 포커스를 받을 때 스크롤 방지
  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    const handleFocus = () => {
      scrollPositionRef.current = window.scrollY
    }

    const handleScroll = () => {
      if (document.activeElement === input) {
        window.scrollTo(0, scrollPositionRef.current)
      }
    }

    input.addEventListener("focus", handleFocus)
    window.addEventListener("scroll", handleScroll, { passive: false })

    return () => {
      input.removeEventListener("focus", handleFocus)
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // 외부에서 받은 메시지 배열이 변경되면 업데이트
  useEffect(() => {
    setMessages(externalMessages)
  }, [externalMessages])

  // 초기 로드 완료 시 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (isInitialLoadComplete && messages.length > 0 && !isLoadingMore) {
      // 초기 로드 완료 시 맨 아래로 스크롤
      const timeoutId = setTimeout(() => {
        scrollToBottom()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [isInitialLoadComplete]) // messages.length 제거하여 예전 메시지 로드 시 트리거 방지

  // 새 메시지가 추가될 때마다 맨 아래로 스크롤
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || messages.length === 0) return

    // 초기 로드가 완료된 후에만 자동 스크롤
    if (!isInitialLoadComplete) return

    // 예전 메시지를 로드 중이면 자동 스크롤하지 않음 (스크롤 위치 복원 로직이 처리)
    if (isLoadingMore || isLoadingRef.current) return

    // 이전 메시지 로드가 방금 완료된 직후면 자동 스크롤하지 않음
    if (justLoadedOlderMessagesRef.current) {
      justLoadedOlderMessagesRef.current = false
      return
    }

    // 새 메시지가 추가되면 항상 맨 아래로 스크롤
    const timeoutId = setTimeout(() => {
      scrollToBottom()
    }, 100)
    return () => clearTimeout(timeoutId)
  }, [messages, isInitialLoadComplete, isLoadingMore])

  // 무한 스크롤: 스크롤이 맨 위에 가까우면 이전 메시지 로드
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !onLoadMore || !hasMore || isLoadingMore || isLoadingRef.current) return

    const handleScroll = () => {
      // 스크롤이 맨 위에서 100px 이내에 있으면 이전 메시지 로드
      if (container.scrollTop < 100 && hasMore && !isLoadingRef.current) {
        // 가장 오래된 메시지(첫 번째 메시지)의 ID 사용
        const oldestMessage = messages[0]
        if (oldestMessage?.id) {
          isLoadingRef.current = true
          // 현재 스크롤 높이와 위치를 저장 (새 메시지가 위에 추가될 때 복원하기 위해)
          previousScrollHeightRef.current = container.scrollHeight
          
          onLoadMore(oldestMessage.id)
            .then(() => {
              // 메시지 로드 완료, 스크롤 위치 복원은 별도 useEffect에서 처리
            })
            .catch((error) => {
              console.error('이전 메시지 로드 실패:', error)
              isLoadingRef.current = false
              previousScrollHeightRef.current = 0
            })
        }
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [messages, onLoadMore, hasMore, isLoadingMore])

  // 메시지가 업데이트되고 로딩이 완료된 후 스크롤 위치 복원
  useEffect(() => {
    // 로딩이 완료되고 이전에 스크롤 위치를 저장했을 때만 복원
    if (!isLoadingMore && isLoadingRef.current && previousScrollHeightRef.current > 0) {
      const container = messagesContainerRef.current
      if (container) {
        // 메시지 업데이트 후 스크롤 위치 복원
        const restoreScroll = () => {
          if (container && previousScrollHeightRef.current > 0) {
            const newScrollHeight = container.scrollHeight
            const scrollDiff = newScrollHeight - previousScrollHeightRef.current
            if (scrollDiff > 0) {
              // 새 메시지가 위에 추가되었으므로, 증가한 높이만큼 스크롤 위치를 조정
              // 이렇게 하면 사용자가 보고 있던 메시지가 그대로 보임
              container.scrollTop = scrollDiff
            }
            // 복원 후 초기화
            isLoadingRef.current = false
            previousScrollHeightRef.current = 0
            // 이전 메시지 로드가 완료되었음을 표시 (다음 자동 스크롤을 방지하기 위해)
            justLoadedOlderMessagesRef.current = true
          }
        }

        // DOM 업데이트 완료 후 스크롤 위치 복원 (여러 시점에 시도하여 확실히 복원)
        requestAnimationFrame(() => {
          restoreScroll()
          setTimeout(restoreScroll, 10)
          setTimeout(restoreScroll, 50)
          setTimeout(restoreScroll, 100)
        })
      } else {
        // 컨테이너가 없으면 초기화만
        isLoadingRef.current = false
        previousScrollHeightRef.current = 0
      }
    } else if (!isLoadingMore) {
      // 로딩이 완료되었지만 복원할 필요가 없으면 초기화
      isLoadingRef.current = false
    }
  }, [messages, isLoadingMore])

  const handleSend = () => {
    if (!inputValue.trim()) return

    const messageText = inputValue
    setInputValue("")

    // 웹소켓으로 메시지 전송 (백엔드에서 응답이 오면 chatMessages 배열에 추가되어 표시됨)
    onSend?.(messageText)
    
    // 메시지 전송 후 맨 아래로 스크롤 (메시지가 추가되기 전에 미리 스크롤)
    setTimeout(() => {
      scrollToBottom()
    }, 50)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div
      className="flex flex-col w-full h-full min-h-0 overflow-hidden"
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
            채팅
          </span>
        </div>
      </div>

      {/* Messages area */}
      <CustomScrollbar className="flex-1 overflow-y-auto min-h-0">
        <div 
          ref={messagesContainerRef}
          className="h-full overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar"
        >
          {/* 로딩 인디케이터를 맨 위에 표시 */}
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <span className="text-xs" style={{ color: colors.textLight }}>
                이전 메시지 불러오는 중...
              </span>
            </div>
          )}
          {/* 메시지는 state에서 이미 시간순 정렬되어 있음 (오래된 것부터) */}
          {messages.map((message, index) => (
            <div
              key={message.id || `message-${index}-${message.timestamp?.getTime() || Date.now()}`}
              className="flex items-start gap-2 w-full"
            >
              {/* 프로필 이미지 */}
              {message.userProfileUrl ? (
                <img
                  src={message.userProfileUrl}
                  alt={message.userName || "사용자"}
                  className="w-8 h-8 rounded-full border-2 border-white/80 shadow-sm object-cover flex-shrink-0"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    const fallback = target.nextElementSibling as HTMLElement
                    if (fallback) {
                      target.style.display = 'none'
                      fallback.style.display = 'flex'
                    }
                  }}
                />
              ) : null}
              <div
                className={`w-8 h-8 rounded-full border-2 border-white/80 shadow-sm flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${message.userProfileUrl ? 'hidden' : ''}`}
                style={{
                  background: "#c5d4c0",
                }}
              >
                {(message.userName || "사용자").charAt(0)}
              </div>
              
              {/* 메시지 내용 */}
              <div className="flex-1 min-w-0 flex flex-col items-start">
                {message.userName && (
                  <span
                    className="text-xs mb-1 px-1 font-sans font-bold"
                    style={{ color: "#111827" }}
                  >
                    {message.userName}
                  </span>
                )}
                <div className="flex items-end gap-2 w-full">
                  <div
                    className="max-w-[85%] px-4 py-2.5 rounded-2xl"
                    style={{
                      background: "rgba(255, 255, 255, 0.4)",
                      // 채팅 메시지 본문 텍스트는 검정색으로 표시
                      color: "#111827",
                      backdropFilter: "blur(10px)",
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    <p className="text-sm font-sans leading-relaxed">{message.text}</p>
                  </div>
                  {/* 작성일 - 메시지 오른쪽에 배치 */}
                  <span
                    className="text-[10px] font-sans flex-shrink-0"
                    style={{ color: "#111827" }}
                  >
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CustomScrollbar>

      {/* Input area */}
      <div
        className="px-4 py-4 border-t"
        style={{
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
        onMouseDown={(e) => {
          // 입력 영역 클릭 시 스크롤 위치 저장
          scrollPositionRef.current = window.scrollY
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
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onMouseDown={handleInputMouseDown}
            onFocus={handleInputFocus}
            placeholder="채팅을 입력하세요..."
            className="flex-1 bg-transparent outline-none text-sm font-sans placeholder:text-gray-400"
            style={{ color: colors.text }}
          />
          <button
            onClick={handleSend}
            className="p-2 rounded-full transition-all duration-200 hover:scale-110"
            style={{
              background: inputValue.trim()
                ? colors.main
                : "rgba(45, 74, 62, 0.25)",
              color: "white",
            }}
            disabled={!inputValue.trim()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

