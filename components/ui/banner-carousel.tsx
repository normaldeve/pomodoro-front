"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useIsMobile } from "@/hooks/use-mobile"

interface Banner {
  src: string
  alt: string
  href?: string
}

interface BannerCarouselProps {
  desktopBanners?: Banner[]
  mobileBanners?: Banner[]
  autoPlayInterval?: number // 자동 전환 간격 (밀리초), 기본값 5000
}

const defaultDesktopBanners: Banner[] = [
  { src: "/banners/banner_mobile_info.png", alt: "모바일 앱 설치 안내", href: "/pwa-install" },
  { src: "/banners/banner_main.png", alt: "배너 2" },
  { src: "/banners/banner_new_year.png", alt: "배너 3" },
  { src: "/banners/banner_focus.png", alt: "배너 4" },
]

const defaultMobileBanners: Banner[] = [
  { src: "/banners/mobile/1.png", alt: "모바일 배너 1" },
  { src: "/banners/mobile/2.png", alt: "모바일 배너 2" },
  { src: "/banners/mobile/3.png", alt: "모바일 배너 3" },
]

export function BannerCarousel({
  desktopBanners = defaultDesktopBanners,
  mobileBanners = defaultMobileBanners,
  autoPlayInterval = 5000,
}: BannerCarouselProps) {
  const isMobile = useIsMobile()
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
  
  const banners = isMobile ? mobileBanners : desktopBanners
  const totalBanners = banners.length

  // 배너 자동 전환
  useEffect(() => {
    if (totalBanners <= 1) return

    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % totalBanners)
    }, autoPlayInterval)

    return () => clearInterval(interval)
  }, [totalBanners, autoPlayInterval])

  // 배너 개수가 변경되었을 때 인덱스 보정
  useEffect(() => {
    if (currentBannerIndex >= totalBanners) {
      setCurrentBannerIndex(0)
    }
  }, [currentBannerIndex, totalBanners])

  if (totalBanners === 0) return null

  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl ${
        isMobile ? "h-[120px]" : "h-[190px]"
      }`}
    >
      <div
        className="flex transition-transform duration-500 ease-in-out h-full"
        style={{
          transform: `translateX(-${currentBannerIndex * 100}%)`,
        }}
      >
        {banners.map((banner, index) => (
          <div key={index} className="w-full h-full flex-shrink-0">
            {banner.href ? (
              <Link href={banner.href} className="block w-full h-full">
                <Image
                  src={banner.src}
                  alt={banner.alt}
                  width={1080}
                  height={360}
                  className={isMobile ? "w-full h-full object-cover" : "w-full h-full object-contain"}
                  priority={index === 0}
                />
              </Link>
            ) : (
              <Image
                src={banner.src}
                alt={banner.alt}
                width={1080}
                height={360}
                className={isMobile ? "w-full h-full object-cover" : "w-full h-full object-contain"}
                priority={index === 0}
              />
            )}
          </div>
        ))}
      </div>

      {/* 배너 인디케이터 */}
      {totalBanners > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBannerIndex(index)}
              className={`h-2 rounded-full transition-all ${
                currentBannerIndex === index ? "bg-black w-6" : "bg-black/30 w-2"
              }`}
              aria-label={`${index + 1}번째 배너`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
