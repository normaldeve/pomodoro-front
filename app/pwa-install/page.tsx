"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function PwaInstallPage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken")
    setIsLoggedIn(!!accessToken)
  }, [])

  return (
    <main className="min-h-screen bg-[#fff8ea] px-6 pt-3 pb-8 md:px-10 md:pt-4">
      <div className="mx-auto w-full max-w-3xl">
        <header className="relative mb-8 flex items-center justify-between gap-4 py-3 text-xs md:text-sm text-black">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 md:gap-3 cursor-pointer flex-shrink-0"
          >
            <span
              className="text-lg md:text-2xl font-black font-service-name"
              style={{
                letterSpacing: "0.05em",
                color: "#2c5f2d",
                fontWeight: 900,
              }}
            >
              POGATHER
            </span>
          </button>
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {!isLoggedIn && (
              <button
                onClick={() => router.push("/login")}
                className="px-5 py-2.5 rounded-lg bg-[#2c5f2d] text-xs md:text-sm font-bold text-white shadow-md hover:bg-[#2c5f2d]/90 transition-colors"
              >
                뽀개더 시작하기
              </button>
            )}
          </div>
        </header>

        <header className="mb-8">
          <h1 className="mt-4 text-2xl font-bold text-[#2c5f2d] md:text-3xl">
            모바일 앱 등록하는 방법
          </h1>
          <p className="mt-2 text-sm text-black/65 md:text-base">
            아래 안내대로 진행하면 홈 화면에 뽀개더 앱 아이콘을 추가해서 더 빠르게 실행할 수 있어요.
          </p>
        </header>

        <section className="mb-6 rounded-xl border border-red-300 bg-red-50 p-5">
          <p className="text-lg font-semibold text-black">⚠️ 주의</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-black/80">
            <li>안드로이드, 아이폰 모두 크롬에서 실행하는 것을 추천해요.</li>
          </ul>
        </section>

        <section className="mb-6 rounded-xl border border-black/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-black">Android (Chrome)</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-black/80">
            <li>Chrome에서 뽀개더 사이트를 연다.</li>
            <li>오른쪽 상단 메뉴(점 3개)를 누른다.</li>
            <li>`홈 화면에 추가` 또는 `앱 설치`를 선택한다.</li>
            <li>확인 버튼을 누르면 홈 화면에 아이콘이 생성된다.</li>
          </ol>
        </section>

        <section className="mb-6 rounded-xl border border-black/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-black">iPhone (Chrome)</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-black/80">
            <li>Chrome에서 뽀개더 사이트를 연다.</li>
            <li>하단 공유 버튼(사각형 + 화살표)을 누른다.</li>
            <li>`홈 화면에 추가`를 선택한다.</li>
            <li>이름을 확인하고 `추가`를 누른다.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-black/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-black">문제가 있을 때</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-black/80">
            <li>브라우저를 최신 버전으로 업데이트해 주세요.</li>
            <li>시크릿 모드에서는 설치 메뉴가 보이지 않을 수 있어요.</li>
            <li>이미 설치된 경우 메뉴 이름이 다르게 보일 수 있어요.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
