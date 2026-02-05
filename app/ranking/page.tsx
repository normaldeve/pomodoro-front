"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function RankingPage() {
  const router = useRouter()
  const [isDevelopmentDialogOpen, setIsDevelopmentDialogOpen] = useState(false)

  // 페이지 로드 시 개발 중 다이얼로그 표시
  useEffect(() => {
    setIsDevelopmentDialogOpen(true)
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 md:p-10"
      style={{
        backgroundColor: "#fff8ea",
      }}
    >
      {/* 개발 중 안내 다이얼로그 */}
      <Dialog open={isDevelopmentDialogOpen} onOpenChange={(open) => {
        setIsDevelopmentDialogOpen(open)
        // 다이얼로그가 닫히면 홈으로 리다이렉트
        if (!open) {
          router.push("/")
        }
      }}>
        <DialogContent className="max-w-sm p-6" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4">
            <Image
              src="/images/home_icon.png"
              alt="개발 중 안내 아이콘"
              width={80}
              height={80}
              className="w-20 h-20 object-contain"
            />
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-base font-semibold">
                랭킹 기능 개발 중
              </DialogTitle>
              <DialogDescription className="text-xs text-black/70 mt-1 text-center">
                랭킹 기능은 현재 개발 중이에요.
                <br />
                곧 만나볼 수 있을 거예요!
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="w-full flex justify-center mt-2">
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => {
                  setIsDevelopmentDialogOpen(false)
                  router.push("/")
                }}
              >
                네 알겠어요!
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
