'use client'

import { useEffect, useState } from 'react'
import { subscribeServerStatus } from '@/lib/server-status'
import { AlertCircle } from 'lucide-react'

export function ServerStatusOverlay() {
  const [isServerConnected, setIsServerConnected] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeServerStatus((connected) => {
      setIsServerConnected(connected)
    })

    return unsubscribe
  }, [])

  if (isServerConnected) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#fff8ea]/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 px-6 py-8 bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md mx-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">서버 점검 중</h2>
          <p className="text-gray-600 leading-relaxed">
            현재 서버와 연결할 수 없습니다.
            <br />
            잠시 후 다시 시도해주세요.
          </p>
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span>연결 대기 중...</span>
          </div>
        </div>
      </div>
    </div>
  )
}
