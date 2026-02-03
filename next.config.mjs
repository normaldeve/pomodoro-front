/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // 이미지 최적화 활성화 (WebP, AVIF 자동 변환)
    formats: ['image/avif', 'image/webp'],
    // 이미지 도메인 설정 (필요시 추가)
    remotePatterns: [],
    // 이미지 최적화 품질 (1-100, 기본값 75)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // 프로덕션 빌드 최적화
  swcMinify: true,
  compress: true,
  // 프로덕션에서 소스맵 비활성화 (번들 크기 감소)
  productionBrowserSourceMaps: false,
  // 번들 최적화
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      'date-fns',
      'recharts',
    ],
  },
  // 웹팩 최적화
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // 프로덕션 빌드에서 최적화
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        usedExports: true, // tree-shaking 활성화
        sideEffects: false, // side effects 없는 모듈 최적화
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 25,
          minSize: 20000,
          cacheGroups: {
            default: false,
            vendors: false,
            // 공통 라이브러리 분리
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
              reuseExistingChunk: true,
            },
            // Radix UI 컴포넌트 분리
            radix: {
              name: 'radix',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]@radix-ui/,
              priority: 30,
              reuseExistingChunk: true,
            },
            // lucide-react 아이콘 분리
            lucide: {
              name: 'lucide',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]lucide-react/,
              priority: 25,
              reuseExistingChunk: true,
            },
            // 공통 코드 분리
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      }
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Link',
            value: [
              '<https://cdn.jsdelivr.net>; rel=preconnect; crossorigin=anonymous',
            ].join(', '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
