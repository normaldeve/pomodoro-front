"use client"

import React, { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./dialog"
import { Button } from "./button"
import { Label } from "./label"
import { X, Upload, Star } from "lucide-react"
import { CustomScrollbar } from "./custom-scrollbar"
import { uploadReflectionImage } from "@/lib/api"

export interface ReflectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (content: string, images: string[], rating: number | null) => void
  sessionNumber?: number
}

export function ReflectionDialog({
  open,
  onOpenChange,
  onSubmit,
  sessionNumber,
}: ReflectionDialogProps) {
  const [content, setContent] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [rating, setRating] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const uploadPromises = Array.from(files).map(async (file) => {
      if (!file.type.startsWith("image/")) return null
      try {
        const imageUrl = await uploadReflectionImage(file)
        return imageUrl
      } catch (error) {
        console.error("회고 이미지 업로드 실패:", error)
        return null
      }
    })

    const uploadedUrls = (await Promise.all(uploadPromises)).filter(
      (url): url is string => !!url
    )

    if (uploadedUrls.length > 0) {
      setImages((prev) => [...prev, ...uploadedUrls])
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!content.trim()) return
    onSubmit?.(content, images, rating)
    setContent("")
    setImages([])
    setRating(null)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setContent("")
    setImages([])
    setRating(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <img
              src="/images/home_icon.png"
              alt="좋은 일!"
              className="w-12 h-12 md:w-16 md:h-16 object-contain"
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))",
              }}
            />
            <div>
              <DialogTitle className="text-xl font-bold">회고 작성</DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-1">
                {typeof sessionNumber === "number" && sessionNumber > 0
                  ? `${sessionNumber}번째 세션 회고를 작성해보세요`
                  : "이번 세션 학습을 회고해보세요"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <CustomScrollbar className="flex-1 overflow-y-auto min-h-0 mt-4">
          <div className="flex flex-col gap-4 px-4">
            {/* 별점 입력 */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">이번 세션 만족도</Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className="p-0.5"
                    aria-label={`${value}점`}
                  >
                    <Star
                      className="w-6 h-6"
                      fill={rating !== null && value <= rating ? "#facc15" : "transparent"}
                      stroke={rating !== null && value <= rating ? "#facc15" : "#e5e7eb"}
                    />
                  </button>
                ))}
                <span className="ml-1 text-xs text-gray-600">
                  {rating !== null ? `${rating}점` : "별점을 선택해 주세요"}
                </span>
              </div>
            </div>

            {/* 텍스트 입력 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="reflection-content" className="text-sm font-medium">
                회고 내용
              </Label>
              <textarea
                id="reflection-content"
                placeholder="오늘 무엇을 배웠나요? 어떤 점이 인상 깊었나요?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-[120px] px-4 py-3 rounded-lg border border-gray-300 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={5}
              />
            </div>

            {/* 사진 업로드 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="reflection-images" className="text-sm font-medium">
                사진 추가 (선택사항)
              </Label>
              <p className="text-xs text-gray-600">
                공부하고 있는 사진을 인증해주세요
              </p>
              <input
                ref={fileInputRef}
                id="reflection-images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-white border-gray-300 hover:bg-gray-50"
              >
                <Upload className="w-4 h-4 mr-2" />
                사진 선택
              </Button>

              {/* 업로드된 사진 미리보기 */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {images.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image}
                        alt={`업로드된 이미지 ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="이미지 제거"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CustomScrollbar>

        <DialogFooter className="mt-4 flex-shrink-0">
          <Button variant="outline" onClick={handleCancel}>
            건너뛰기
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleSubmit}
            disabled={!content.trim()}
          >
            작성하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
