"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"
import { Input } from "./input"
import { Label } from "./label"
import { Button } from "./button"
import { Switch } from "./switch"
import { CustomScrollbar } from "./custom-scrollbar"
import { User, Bell, Camera } from "lucide-react"
import { updateUserInfo } from "@/lib/api"
import { showSuccessNotification } from "@/lib/system-notification"

export interface UserInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const colors = {
  // 시스템 primary 그린 팔레트
  main: "#2c5f2d",
  text: "rgba(45, 74, 62, 0.95)",
  textLight: "rgba(45, 74, 62, 0.7)",
  shadow: "rgba(45, 74, 62, 0.35)",
}

export function UserInfoDialog({ open, onOpenChange }: UserInfoDialogProps) {
  const [userId, setUserId] = useState<string>("")
  const [nickname, setNickname] = useState("사용자")
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null) // 실제 업로드할 파일 객체
  const [pushNotifications, setPushNotifications] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // 로컬 스토리지에서 사용자 ID(username) 불러오기 (읽기 전용)
  useEffect(() => {
    // 다이얼로그가 열릴 때마다 최신 사용자 정보를 가져오기 위해 open을 의존성으로 사용
    if (!open) return
    if (typeof window === "undefined") return
    const userStr = window.localStorage.getItem("user")
    if (!userStr) return
    try {
      const user = JSON.parse(userStr)
      if (user?.username) {
        setUserId(user.username)
      }
      if (user?.nickname) {
        setNickname(user.nickname)
      }
      if (user?.profileUrl) {
        setProfileImage(user.profileUrl)
      }
    } catch (e) {
      console.error("Failed to parse user info in UserInfoDialog:", e)
    }
  }, [open])


  // 프로필 이미지 변경 핸들러
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 이미지 파일인지 확인
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.')
        return
      }
      // 파일 크기 제한 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB 이하여야 합니다.')
        return
      }
      // 실제 파일 객체 저장 (API 호출 시 사용)
      setSelectedFile(file)
      // 미리보기용 URL 생성
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfileImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // 프로필 정보 저장 핸들러
  const handleSaveProfile = async () => {
    if (isSaving) return

    setIsSaving(true)
    try {
      const updateData: { file?: File | null; nickname?: string | null } = {}
      
      // 파일이 선택되었으면 추가
      if (selectedFile) {
        updateData.file = selectedFile
      }
      
      // 닉네임이 변경되었으면 추가
      if (nickname.trim()) {
        updateData.nickname = nickname.trim()
      }

      // API 호출
      const updatedUserInfo = await updateUserInfo(updateData)

      // localStorage의 user 정보 업데이트
      const userStr = localStorage.getItem("user")
      if (userStr) {
        try {
          const user = JSON.parse(userStr)
          user.nickname = updatedUserInfo.nickname
          user.profileUrl = updatedUserInfo.profileUrl
          localStorage.setItem("user", JSON.stringify(user))
        } catch (error) {
          console.error("Failed to update user in localStorage:", error)
        }
      }

      // 성공 알림
      showSuccessNotification("프로필이 업데이트되었습니다.")
      
      // 선택된 파일 초기화 (다음 변경을 위해)
      setSelectedFile(null)
      
      // 다이얼로그 닫기
      onOpenChange(false)
    } catch (error) {
      console.error("프로필 업데이트 실패:", error)
      // 에러는 apiRequest에서 이미 시스템 알림으로 표시됨
    } finally {
      setIsSaving(false)
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
            내 정보
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="flex-1 flex flex-col min-h-0 mt-4">
          <TabsList
            className="grid w-full grid-cols-3 mb-4 p-1"
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            <TabsTrigger
              value="profile"
              className="flex items-center gap-2 rounded-lg transition-all data-[state=active]:bg-white/40 data-[state=active]:backdrop-blur-[10px] data-[state=active]:shadow-sm"
              style={{
                color: colors.text,
              }}
            >
              <User className="w-4 h-4" />
              <span>내 정보</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex items-center gap-2 rounded-lg transition-all data-[state=active]:bg-white/40 data-[state=active]:backdrop-blur-[10px] data-[state=active]:shadow-sm"
              style={{
                color: colors.text,
              }}
            >
              <Bell className="w-4 h-4" />
              <span>알림 설정</span>
            </TabsTrigger>
          </TabsList>

          <CustomScrollbar className="flex-1 overflow-y-auto min-h-0">
            <TabsContent value="profile" className="mt-0">
              <div className="flex flex-col gap-4 px-2">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div
                      className="w-24 h-24 rounded-full border-4 border-white shadow-lg flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: "#c5d4c0" }}
                    >
                      {profileImage ? (
                        <img
                          src={profileImage}
                          alt="프로필"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-12 h-12" style={{ color: colors.text }} />
                      )}
                    </div>
                    <label
                      htmlFor="profile-image-input"
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary border-2 border-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors"
                    >
                      <Camera className="w-4 h-4 text-white" />
                    </label>
                    <input
                      id="profile-image-input"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-id" className="text-sm font-medium">
                    ID
                  </Label>
                  <Input
                    id="profile-id"
                    type="text"
                    value={userId}
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-nickname" className="text-sm font-medium">
                    닉네임
                  </Label>
                  <Input
                    id="profile-nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="bg-white"
                  />
                </div>

                <div className="flex justify-end mt-4">
                  <Button
                  className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                  >
                    {isSaving ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <div className="flex flex-col gap-4 px-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-white/50">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="push-notifications" className="text-sm font-medium cursor-pointer">
                        푸시 알림
                      </Label>
                      <p className="text-xs text-gray-500">
                        브라우저 푸시 알림을 받습니다
                      </p>
                    </div>
                    <Switch
                      id="push-notifications"
                      checked={pushNotifications}
                      onCheckedChange={setPushNotifications}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <Button
                  className="bg-primary hover:bg-primary/90"
                    onClick={() => {
                      // 설정 저장 로직
                      console.log("설정 저장:", {
                        pushNotifications,
                      })
                      onOpenChange(false)
                    }}
                  >
                    저장
                  </Button>
                </div>
              </div>
            </TabsContent>
          </CustomScrollbar>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
