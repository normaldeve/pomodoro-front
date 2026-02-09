"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useRef, Suspense } from "react"
import { getStudyRoomMembers, RoomMemberRole, getStudyRoom, getCurrentUser } from "@/lib/api"
import { StudyRoomWebSocket, EnterStudyRoomRequest } from "@/lib/websocket"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function RoomPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const isProcessingRef = useRef(false) // 중복 실행 방지 플래그
  const enteredRoomIdsRef = useRef<Set<string>>(new Set()) // roomId 기준으로 이미 입장한 방 추적

  // WebSocket을 통한 방 참여 함수
  const enterRoomViaWebSocket = async (
    roomId: string,
    userId: number,
    password?: string,
    roomUrl?: string
  ): Promise<{ success: boolean; role?: RoomMemberRole }> => {
    const ws = new StudyRoomWebSocket()
    let memberInfo: { userId: number; nickname: string; profileUrl: string | null } | null = null

    try {
      await ws.connect(
        roomId,
        () => {}, // 타이머 메시지 핸들러 (사용하지 않음)
        undefined, // 채팅 메시지 핸들러 (사용하지 않음)
        (member) => {
          // 참여자 정보 수신
          memberInfo = member
        }
      )

      // 구독이 완료될 때까지 약간의 지연 (100ms)
      await new Promise(resolve => setTimeout(resolve, 100))

      // 방 참여 요청 전송
      const enterRequest: EnterStudyRoomRequest = {
        userId,
        password: password || undefined,
        roomUrl,
      }
      ws.sendEnterRoom(enterRequest)

      // 참여자 정보 수신 대기 (최대 3초)
      let waitCount = 0
      while (!memberInfo && waitCount < 30) {
        await new Promise(resolve => setTimeout(resolve, 100))
        waitCount++
      }

      // WebSocket 연결 해제
      ws.disconnect()

      if (!memberInfo) {
        console.warn("방 참여 응답을 받지 못했습니다")
        return { success: false }
      }

      // 참여 성공 후 다시 참여자 목록 조회하여 role 확인
      const updatedParticipants = await getStudyRoomMembers(roomId)
      const updatedUser = updatedParticipants.find(p => p.userId === userId)

      if (!updatedUser) {
        console.warn("방 참여 후에도 사용자를 찾을 수 없습니다")
        return { success: false }
      }

      return { success: true, role: updatedUser.role }
    } catch (error) {
      ws.disconnect()
      console.error("방 참여 실패:", error)
      return { success: false }
    }
  }

  // 페이지 로드 시 role 확인 후 적절한 페이지로 리다이렉트
  useEffect(() => {
    const checkRoleAndRedirect = async () => {
      // 이미 처리 중이면 중복 실행 방지
      if (isProcessingRef.current) {
        return
      }
      
      isProcessingRef.current = true
      const roomIdParam = searchParams.get("roomId")
      if (!roomIdParam) {
        console.warn("URL에 roomId 파라미터가 없습니다")
        router.push("/")
        return
      }

      try {
        const roomId = roomIdParam // UUID는 문자열로 처리

        // 현재 사용자 정보 가져오기 (토큰 기반)
        const accessToken = localStorage.getItem("accessToken")
        if (!accessToken) {
          console.warn("accessToken이 없습니다")
          // 홈으로 리다이렉트하되 roomId를 쿼리 파라미터로 전달
          router.push(`/?roomId=${roomId}`)
          return
        }
        const userData = await getCurrentUser()

        // 방 정보와 참여자 목록 조회
        const [roomInfo, participants] = await Promise.all([
          getStudyRoom(roomId),
          getStudyRoomMembers(roomId),
        ])

        // 참여자 목록에서 현재 사용자의 role 찾기
        const currentUser = participants.find(p => p.userId === userData.id)
        
        // 참여자가 아니면 방 참여 시도
        if (!currentUser) {
          // 비밀방인 경우 비밀번호 입력 다이얼로그 표시
          if (roomInfo.secret) {
            setCurrentRoomId(roomId)
            setIsPasswordDialogOpen(true)
            setIsLoading(false)
            return
          } else {
            // 공개방이면 바로 참여
            // roomId 기준으로 이미 입장한 방인지 확인
            if (enteredRoomIdsRef.current.has(roomId)) {
              // 이미 입장한 방이면 참여자 목록만 다시 조회하여 리다이렉트
              const updatedParticipants = await getStudyRoomMembers(roomId)
              const updatedUser = updatedParticipants.find(p => p.userId === userData.id)
              
              if (!updatedUser) {
                console.warn("방 참여 후에도 사용자를 찾을 수 없습니다")
                router.push("/")
                return
              }

              if (updatedUser.role === RoomMemberRole.HOST) {
                router.replace(`/room/host?roomId=${roomId}`)
              } else {
                router.replace(`/room/member?roomId=${roomId}`)
              }
              return
            }

            try {
              // roomId를 Set에 추가하여 중복 호출 방지
              enteredRoomIdsRef.current.add(roomId)
              
              // 현재 URL (roomId 포함)을 roomUrl로 전달
              const currentUrl = typeof window !== "undefined" ? window.location.href : undefined
              
              // WebSocket으로 방 참여
              const result = await enterRoomViaWebSocket(roomId, userData.id, undefined, currentUrl)
              
              if (!result.success || !result.role) {
                enteredRoomIdsRef.current.delete(roomId)
                router.push("/")
                return
              }

              if (result.role === RoomMemberRole.HOST) {
                router.replace(`/room/host?roomId=${roomId}`)
              } else {
                router.replace(`/room/member?roomId=${roomId}`)
              }
              return
            } catch (error) {
              // 에러 발생 시 Set에서 제거하여 재시도 가능하도록 함
              enteredRoomIdsRef.current.delete(roomId)
              console.error("방 참여 실패:", error)
              router.push("/")
              return
            }
          }
        }

        // 이미 참여자인 경우 role에 따라 적절한 페이지로 리다이렉트
        if (currentUser.role === RoomMemberRole.HOST) {
          router.replace(`/room/host?roomId=${roomId}`)
        } else {
          router.replace(`/room/member?roomId=${roomId}`)
        }
      } catch (error) {
        console.error("방 정보 조회 실패:", error)
        router.push("/")
      } finally {
        setIsLoading(false)
        isProcessingRef.current = false
      }
    }

    checkRoleAndRedirect()
    
    // cleanup 함수: 컴포넌트 언마운트 시 플래그 리셋
    return () => {
      isProcessingRef.current = false
    }
  }, [searchParams]) // router를 dependency에서 제거

  // 비밀번호 입력 후 방 참여
  const handleEnterWithPassword = async () => {
    if (!currentRoomId) return

    // roomId 기준으로 이미 입장한 방인지 확인
    if (enteredRoomIdsRef.current.has(currentRoomId)) {
      // 이미 입장한 방이면 참여자 목록만 다시 조회하여 리다이렉트
      const userData = await getCurrentUser()
      const participants = await getStudyRoomMembers(currentRoomId)
      const currentUser = participants.find(p => p.userId === userData.id)
      
      if (!currentUser) {
        console.warn("방 참여 후에도 사용자를 찾을 수 없습니다")
        router.push("/")
        return
      }

      setIsPasswordDialogOpen(false)
      setPassword("")
      
      if (currentUser.role === RoomMemberRole.HOST) {
        router.replace(`/room/host?roomId=${currentRoomId}`)
      } else {
        router.replace(`/room/member?roomId=${currentRoomId}`)
      }
      return
    }

    try {
      // roomId를 Set에 추가하여 중복 호출 방지
      enteredRoomIdsRef.current.add(currentRoomId)
      
      // 현재 사용자 정보 가져오기
      const userData = await getCurrentUser()
      
      // WebSocket으로 방 참여
      const currentUrl = typeof window !== "undefined" ? window.location.href : undefined
      const result = await enterRoomViaWebSocket(currentRoomId, userData.id, password, currentUrl)
      
      if (!result.success || !result.role) {
        enteredRoomIdsRef.current.delete(currentRoomId)
        setIsPasswordDialogOpen(false)
        setPassword("")
        return
      }

      setIsPasswordDialogOpen(false)
      setPassword("")
      
      // role에 따라 적절한 페이지로 리다이렉트
      if (result.role === RoomMemberRole.HOST) {
        router.replace(`/room/host?roomId=${currentRoomId}`)
      } else {
        router.replace(`/room/member?roomId=${currentRoomId}`)
      }
    } catch (error) {
      // 에러 발생 시 Set에서 제거하여 재시도 가능하도록 함
      enteredRoomIdsRef.current.delete(currentRoomId)
      console.error("방 참여 실패:", error)
      setIsPasswordDialogOpen(false)
      setPassword("")
    }
  }

  // 로딩 중 표시
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 md:p-10"
        style={{
          backgroundColor: "#fff8ea",
        }}
      >
        <div className="text-center">
          <p className="text-base text-black/70">방 정보를 확인하는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 비밀번호 입력 다이얼로그 */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-sm p-6" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4">
            <img
              src="/images/home_icon.png"
              alt="비밀번호 입력"
              className="w-20 h-20 object-contain"
            />
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-base font-semibold">
                비밀번호를 입력해주세요
              </DialogTitle>
              <DialogDescription className="text-xs text-black/70 mt-1 text-center">
                이 방은 비밀방입니다.
                <br />
                비밀번호를 입력하여 참여하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="w-full space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleEnterWithPassword()
                  }
                }}
                placeholder="비밀번호를 입력하세요"
                className="w-full"
              />
            </div>
            <DialogFooter className="w-full flex justify-center gap-2 mt-2">
              <Button
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800"
                onClick={() => {
                  setIsPasswordDialogOpen(false)
                  setPassword("")
                  router.push("/")
                }}
              >
                취소
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={handleEnterWithPassword}
                disabled={!password.trim()}
              >
                참여하기
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function RoomPage() {
  return (
    <Suspense fallback={null}>
      <RoomPageInner />
    </Suspense>
  )
}

