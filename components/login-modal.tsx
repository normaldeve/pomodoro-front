"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { signup, login, ApiError } from "@/lib/api"
import { showSuccessNotification, showErrorNotification } from "@/lib/system-notification"

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoginSuccess?: () => void
}

const colors = {
  // 시스템 primary 그린 팔레트
  main: "#2c5f2d",
  text: "rgba(45, 74, 62, 0.95)",
  textLight: "rgba(45, 74, 62, 0.7)",
  shadow: "rgba(45, 74, 62, 0.35)",
}

export function LoginModal({ open, onOpenChange, onLoginSuccess }: LoginModalProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [nickname, setNickname] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordMatch, setPasswordMatch] = useState<boolean | null>(null) // null: 초기, true: 일치, false: 불일치
  const [userIdError, setUserIdError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  // 아이디 유효성 검사 (영어 소문자와 숫자만)
  const validateUserId = (value: string): boolean => {
    const userIdRegex = /^[a-z0-9]+$/
    if (value && !userIdRegex.test(value)) {
      setUserIdError("아이디는 영어 소문자와 숫자만 사용할 수 있습니다.")
      return false
    } else {
      setUserIdError("")
      return true
    }
  }

  const handleUserIdChange = (value: string) => {
    // 입력 시 자동으로 소문자로 변환
    const lowerValue = value.toLowerCase()
    setUserId(lowerValue)
    if (lowerValue) {
      validateUserId(lowerValue)
    } else {
      setUserIdError("")
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await login({
        username: userId,
        password: password,
      })

      // 로그인 성공 처리
      console.log("Login success:", response)
      
      // accessToken을 localStorage에 저장
      if (response.accessToken) {
        localStorage.setItem("accessToken", response.accessToken)
      }

      // 사용자 정보 저장
      if (response.user) {
        localStorage.setItem("user", JSON.stringify(response.user))
      }

      // refresh_token은 HttpOnly 쿠키로 자동 저장됨 (브라우저가 자동 처리)

      // 시스템 알림 표시
      showSuccessNotification("로그인에 성공했습니다.")

      onLoginSuccess?.()
      onOpenChange(false)
      setUserId("")
      setPassword("")
    } catch (error) {
      console.error("Login error:", error)
      // apiRequest에서 이미 시스템 알림이 표시되므로 여기서는 추가 처리 불필요
    } finally {
      setIsLoading(false)
    }
  }

  const validatePassword = () => {
    if (confirmPassword && password !== confirmPassword) {
      setPasswordMatch(false)
      return false
    } else if (confirmPassword && password === confirmPassword) {
      setPasswordMatch(true)
      return true
    } else {
      setPasswordMatch(null)
      return true
    }
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (confirmPassword) {
      if (value === confirmPassword) {
        setPasswordMatch(true)
      } else {
        setPasswordMatch(false)
      }
    } else {
      setPasswordMatch(null)
    }
  }

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value)
    if (value && password) {
      if (value === password) {
        setPasswordMatch(true)
      } else {
        setPasswordMatch(false)
      }
    } else {
      setPasswordMatch(null)
    }
  }

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateUserId(userId)) {
      showErrorNotification("아이디는 영어 소문자와 숫자만 사용할 수 있습니다.")
      return
    }
    if (password !== confirmPassword) {
      setPasswordMatch(false)
      showErrorNotification("비밀번호가 일치하지 않습니다.")
      return
    }

    setIsLoading(true)

    try {
      const response = await signup({
        username: userId,
        nickname: nickname,
        password: password,
        profileUrl: null,
      })

      // 회원가입 성공 처리
      console.log("SignUp success:", response)
      
      // 시스템 알림 표시
      showSuccessNotification("회원가입에 성공했습니다.")
      
      // 회원가입 성공 후 로그인 모드로 전환
      setIsSignUp(false)
      setUserId("")
      setPassword("")
      setNickname("")
      setConfirmPassword("")
      setPasswordMatch(null)
      setUserIdError("")
    } catch (error) {
      console.error("SignUp error:", error)
      
      // apiRequest에서 이미 시스템 알림이 표시됨
      // 필드별 에러가 있는 경우 UI에 표시 (예: username 필드 에러)
      if (error instanceof ApiError) {
        const fieldErrors = error.getAllFieldErrors()
        fieldErrors.forEach(fieldError => {
          if (fieldError.field === 'username') {
            setUserIdError(fieldError.message)
          }
          // 다른 필드 에러도 필요시 여기에 추가
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleModeSwitch = () => {
    setIsSignUp(!isSignUp)
    setUserId("")
    setPassword("")
    setNickname("")
    setConfirmPassword("")
    setPasswordMatch(null)
    setUserIdError("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md rounded-3xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.45), rgba(255,255,255,0.25))",
          backdropFilter: "blur(30px) saturate(180%)",
          boxShadow:
            "0 20px 60px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
          border: "1px solid rgba(255, 255, 255, 0.6)",
        }}
      >
        <DialogHeader>
          {/* 환영 캐릭터 */}
          <div className="flex justify-center mb-4">
            <img
              src="/images/home_icon.png"
              alt={isSignUp ? "회원가입" : "안녕하세요!"}
              className="w-24 h-24 md:w-28 md:h-28 object-contain"
              style={{
                filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1))",
              }}
            />
          </div>
          <DialogTitle
            className="text-2xl font-semibold text-center"
            style={{ color: colors.text }}
          >
            {isSignUp ? "회원가입" : "로그인"}
          </DialogTitle>
          <DialogDescription className="text-center" style={{ color: colors.textLight }}>
            {isSignUp ? (
              <>
                <span className="font-service-name">뽀모뽀모</span>에 가입하고 함께해요
              </>
            ) : (
              <>
                <span className="font-service-name">뽀모뽀모</span>에 오신 것을 환영합니다
              </>
            )}
          </DialogDescription>
        </DialogHeader>


        {isSignUp ? (
          <form onSubmit={handleSignUpSubmit} className="space-y-4 mt-4 [&_input::placeholder]:text-[rgba(45,74,62,0.5)]">
            <div className="space-y-2">
              <label
                htmlFor="signup-userId"
                className="text-sm font-medium"
                style={{ color: colors.text }}
              >
                아이디
              </label>
              <Input
                id="signup-userId"
                type="text"
                placeholder="영어 소문자와 숫자만 입력하세요"
                value={userId}
                onChange={(e) => handleUserIdChange(e.target.value)}
                onBlur={() => validateUserId(userId)}
                required
                className="w-full rounded-xl font-medium"
                style={{
                  borderColor: userIdError ? "#ef4444" : "rgba(255, 255, 255, 0.4)",
                  background: "rgba(255, 255, 255, 0.3)",
                  backdropFilter: "blur(10px)",
                  color: colors.text,
                  fontWeight: 500,
                }}
              />
              {userIdError && (
                <p className="text-sm text-red-500 mt-1">{userIdError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="nickname"
                className="text-sm font-medium"
                style={{ color: colors.text }}
              >
                닉네임
              </label>
              <Input
                id="nickname"
                type="text"
                placeholder="닉네임을 입력하세요"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                className="w-full rounded-xl font-medium"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.4)",
                  background: "rgba(255, 255, 255, 0.3)",
                  backdropFilter: "blur(10px)",
                  color: colors.text,
                  fontWeight: 500,
                }}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="signup-password"
                className="text-sm font-medium"
                style={{ color: colors.text }}
              >
                비밀번호
              </label>
              <Input
                id="signup-password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                className="w-full rounded-xl font-medium"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.4)",
                  background: "rgba(255, 255, 255, 0.3)",
                  backdropFilter: "blur(10px)",
                  color: colors.text,
                  fontWeight: 500,
                }}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-medium"
                style={{ color: colors.text }}
              >
                비밀번호 확인
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                onBlur={validatePassword}
                required
                className="w-full rounded-xl font-medium"
                style={{
                  borderColor: 
                    passwordMatch === true ? "#22c55e" : 
                    passwordMatch === false ? "#ef4444" : 
                    "rgba(255, 255, 255, 0.4)",
                  background: "rgba(255, 255, 255, 0.3)",
                  backdropFilter: "blur(10px)",
                  color: colors.text,
                  fontWeight: 500,
                }}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full font-medium"
              style={{
                background: colors.main,
                color: "white",
                boxShadow: `0 8px 32px ${colors.shadow}`,
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? "처리 중..." : "회원가입"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit} className="space-y-4 mt-4 [&_input::placeholder]:text-[rgba(45,74,62,0.5)]">
            <div className="space-y-2">
              <label
                htmlFor="userId"
                className="text-sm font-medium"
                style={{ color: colors.text }}
              >
                아이디
              </label>
              <Input
                id="userId"
                type="text"
                placeholder="아이디를 입력하세요"
                value={userId}
                onChange={(e) => handleUserIdChange(e.target.value)}
                required
                className="w-full rounded-xl font-medium"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.4)",
                  background: "rgba(255, 255, 255, 0.3)",
                  backdropFilter: "blur(10px)",
                  color: colors.text,
                  fontWeight: 500,
                }}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium"
                style={{ color: colors.text }}
              >
                비밀번호
              </label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl font-medium"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.4)",
                  background: "rgba(255, 255, 255, 0.3)",
                  backdropFilter: "blur(10px)",
                  color: colors.text,
                  fontWeight: 500,
                }}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full font-medium"
              style={{
                background: colors.main,
                color: "white",
                boxShadow: `0 8px 32px ${colors.shadow}`,
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        )}

        <div className="text-center mt-4 space-y-2">
          {!isSignUp && (
            <button
              type="button"
              className="text-sm hover:underline"
              style={{ color: colors.textLight }}
            >
              비밀번호를 잊으셨나요?
            </button>
          )}
          <div>
            <button
              type="button"
              onClick={handleModeSwitch}
              className="text-sm hover:underline font-medium"
              style={{ color: colors.text }}
            >
              {isSignUp ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 회원가입"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
