# 인증 상태 관리 개선 가이드

## 현재 문제점

로컬 스토리지에 사용자 정보를 저장하는 방식의 문제:
- 서버 재시작/DB 초기화 후에도 프론트엔드에서 로그인된 것처럼 보임
- 실제 서버 상태와 프론트엔드 상태가 동기화되지 않음
- 토큰이 만료되었거나 무효화되어도 프론트엔드에서 감지하지 못함

## 해결 방법

### 방법 1: 페이지 로드 시 사용자 정보 재확인 (권장)

#### 백엔드 구현

**1. 현재 사용자 정보 조회 API**
```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    
    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        // JWT 토큰에서 사용자 정보 추출
        Long userId = Long.parseLong(userDetails.getUsername());
        
        // DB에서 최신 사용자 정보 조회
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new UserNotFoundException("User not found"));
        
        // 사용자가 실제로 존재하고 활성화되어 있는지 확인
        if (!user.isActive()) {
            throw new UnauthorizedException("User is not active");
        }
        
        return ResponseEntity.ok(new UserResponse(user));
    }
}
```

#### 프론트엔드 구현

**1. 앱 초기화 시 사용자 정보 확인**
```typescript
// hooks/use-auth.ts
import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/api'

export function useAuth() {
  const [user, setUser] = useState<{ id: number; nickname: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken')
      
      // 토큰이 없으면 로그인하지 않은 상태
      if (!token) {
        setIsAuthenticated(false)
        setUser(null)
        setIsLoading(false)
        return
      }

      try {
        // 서버에서 현재 사용자 정보 조회
        const currentUser = await getCurrentUser()
        
        // 사용자 정보가 있으면 로그인 상태
        if (currentUser) {
          setUser(currentUser)
          setIsAuthenticated(true)
          // 로컬 스토리지 업데이트 (최신 정보로)
          localStorage.setItem('user', JSON.stringify(currentUser))
        } else {
          // 사용자 정보가 없으면 로그아웃 처리
          setIsAuthenticated(false)
          setUser(null)
          localStorage.removeItem('accessToken')
          localStorage.removeItem('user')
        }
      } catch (error) {
        // 401 또는 403 에러인 경우 로그아웃 처리
        if (error instanceof ApiError && 
            (error.code === 401 || error.code === 403)) {
          setIsAuthenticated(false)
          setUser(null)
          localStorage.removeItem('accessToken')
          localStorage.removeItem('user')
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  return { user, isLoading, isAuthenticated }
}
```

**2. API 함수 추가**
```typescript
// lib/api.ts
export interface UserResponse {
  id: number
  username: string
  nickname: string
  profileUrl: string | null
}

/**
 * 현재 로그인한 사용자 정보 조회
 */
export async function getCurrentUser(): Promise<UserResponse> {
  return apiRequest<UserResponse>(API_ENDPOINTS.UPDATE_USER_INFO, {
    method: 'GET',
  })
}
```

**3. 앱 루트에서 인증 상태 확인**
```typescript
// app/layout.tsx 또는 app/page.tsx
'use client'

import { useAuth } from '@/hooks/use-auth'
import { useEffect } from 'react'

export default function RootLayout({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  // 로딩 중이면 스피너 표시
  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  )
}
```

---

### 방법 2: 쿠키 기반 세션 인증

#### 백엔드 구현

**1. 세션 기반 인증 설정**
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                .maximumSessions(1) // 단일 세션만 허용
                .maxSessionsPreventsLogin(false) // 새 로그인 시 기존 세션 만료
            )
            .formLogin(form -> form
                .loginProcessingUrl("/api/auth/login")
                .successHandler(authenticationSuccessHandler())
                .failureHandler(authenticationFailureHandler())
            )
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .deleteCookies("JSESSIONID")
                .invalidateHttpSession(true)
            );
        
        return http.build();
    }
    
    @Bean
    public HttpSessionEventPublisher httpSessionEventPublisher() {
        return new HttpSessionEventPublisher();
    }
}
```

**2. 로그인 처리**
```java
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
        @RequestBody LoginRequest request,
        HttpSession session
    ) {
        // 사용자 인증
        User user = authenticate(request);
        
        // 세션에 사용자 정보 저장
        session.setAttribute("userId", user.getId());
        session.setAttribute("user", user);
        
        // 세션 ID를 응답에 포함 (선택사항)
        return ResponseEntity.ok(new LoginResponse(
            session.getId(),
            user
        ));
    }
    
    @GetMapping("/session")
    public ResponseEntity<SessionResponse> getSession(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new UserNotFoundException("User not found"));
        
        return ResponseEntity.ok(new SessionResponse(user));
    }
}
```

#### 프론트엔드 구현

**1. 쿠키 기반 인증 (자동 처리)**
```typescript
// lib/api.ts
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  // 쿠키는 자동으로 브라우저가 관리
  const response = await fetch(API_ENDPOINTS.LOGIN, {
    method: 'POST',
    credentials: 'include', // 쿠키 포함
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })
  
  if (!response.ok) {
    return handleErrorResponse<LoginResponse>(response)
  }
  
  const data = await response.json()
  
  // 사용자 정보만 로컬 스토리지에 저장 (세션 ID는 쿠키에 저장됨)
  localStorage.setItem('user', JSON.stringify(data.user))
  
  return data
}

// 세션 확인
export async function checkSession(): Promise<UserResponse | null> {
  const response = await fetch(API_ENDPOINTS.SESSION, {
    method: 'GET',
    credentials: 'include', // 쿠키 포함
  })
  
  if (response.status === 401) {
    // 세션이 없거나 만료됨
    localStorage.removeItem('user')
    return null
  }
  
  if (!response.ok) {
    throw new Error('Session check failed')
  }
  
  const user = await response.json()
  localStorage.setItem('user', JSON.stringify(user))
  return user
}
```

---

### 방법 3: 주기적인 토큰 검증

#### 프론트엔드 구현

**1. 주기적으로 사용자 정보 확인**
```typescript
// hooks/use-auth-sync.ts
import { useEffect, useRef } from 'react'
import { getCurrentUser } from '@/lib/api'

export function useAuthSync() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const validateAuth = async () => {
      const token = localStorage.getItem('accessToken')
      
      if (!token) {
        // 토큰이 없으면 로그아웃 처리
        localStorage.removeItem('user')
        return
      }

      try {
        // 서버에서 사용자 정보 확인
        const user = await getCurrentUser()
        
        if (user) {
          // 최신 사용자 정보로 업데이트
          localStorage.setItem('user', JSON.stringify(user))
        } else {
          // 사용자 정보가 없으면 로그아웃 처리
          localStorage.removeItem('accessToken')
          localStorage.removeItem('user')
        }
      } catch (error) {
        // 401 또는 403 에러인 경우 로그아웃 처리
        if (error instanceof ApiError && 
            (error.code === 401 || error.code === 403)) {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('user')
          
          // 로그인 페이지로 리다이렉트
          if (window.location.pathname !== '/') {
            window.location.href = '/'
          }
        }
      }
    }

    // 초기 검증
    validateAuth()

    // 5분마다 검증
    intervalRef.current = setInterval(validateAuth, 5 * 60 * 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])
}
```

**2. 앱에서 사용**
```typescript
// app/layout.tsx
'use client'

import { useAuthSync } from '@/hooks/use-auth-sync'

export default function RootLayout({ children }) {
  // 주기적으로 인증 상태 확인
  useAuthSync()

  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  )
}
```

---

### 방법 4: API 호출 시마다 사용자 정보 재확인

#### 프론트엔드 구현

**1. API 요청 전 사용자 정보 확인**
```typescript
// lib/api.ts
let cachedUser: UserResponse | null = null
let lastUserCheck: number = 0
const USER_CHECK_INTERVAL = 5 * 60 * 1000 // 5분

async function ensureAuthenticated(): Promise<UserResponse | null> {
  const now = Date.now()
  const token = localStorage.getItem('accessToken')
  
  if (!token) {
    cachedUser = null
    return null
  }

  // 캐시된 사용자 정보가 있고 최근에 확인했다면 캐시 사용
  if (cachedUser && (now - lastUserCheck) < USER_CHECK_INTERVAL) {
    return cachedUser
  }

  try {
    // 서버에서 사용자 정보 확인
    const user = await getCurrentUser()
    cachedUser = user
    lastUserCheck = now
    
    // 로컬 스토리지 업데이트
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
    }
    
    return user
  } catch (error) {
    // 인증 실패 시 캐시 초기화
    cachedUser = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    throw error
  }
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  retryOn403: boolean = true
): Promise<T> {
  // 인증이 필요한 API인 경우 사용자 정보 확인
  const user = await ensureAuthenticated()
  
  if (!user) {
    throw new ApiError({
      code: 401,
      message: '로그인이 필요합니다.',
      timestamp: new Date().toISOString(),
    })
  }

  // 기존 로직 계속...
  const accessToken = localStorage.getItem('accessToken')
  // ...
}
```

---

### 방법 5: React Context를 사용한 전역 인증 상태 관리

#### 프론트엔드 구현

**1. 인증 Context 생성**
```typescript
// contexts/auth-context.tsx
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getCurrentUser, UserResponse } from '@/lib/api'
import { ApiError } from '@/lib/api'

interface AuthContextType {
  user: UserResponse | null
  isLoading: boolean
  isAuthenticated: boolean
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = async () => {
    const token = localStorage.getItem('accessToken')
    
    if (!token) {
      setUser(null)
      return
    }

    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      localStorage.setItem('user', JSON.stringify(currentUser))
    } catch (error) {
      if (error instanceof ApiError && 
          (error.code === 401 || error.code === 403)) {
        setUser(null)
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
      }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')
      window.location.href = '/'
    }
  }

  useEffect(() => {
    // 초기 로드 시 사용자 정보 확인
    refreshUser().finally(() => {
      setIsLoading(false)
    })

    // 주기적으로 사용자 정보 확인 (5분마다)
    const interval = setInterval(refreshUser, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

**2. 앱 루트에 Provider 추가**
```typescript
// app/layout.tsx
import { AuthProvider } from '@/contexts/auth-context'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

**3. 컴포넌트에서 사용**
```typescript
// app/page.tsx
'use client'

import { useAuth } from '@/contexts/auth-context'

export default function HomePage() {
  const { user, isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!isAuthenticated) {
    return <LoginModal />
  }

  return (
    <div>
      <h1>안녕하세요, {user?.nickname}님!</h1>
      {/* ... */}
    </div>
  )
}
```

---

## 권장 구현 방법

### 단계별 구현

1. **1단계: 페이지 로드 시 사용자 정보 확인**
   - `getCurrentUser()` API 추가
   - 앱 초기화 시 사용자 정보 확인
   - 인증 실패 시 로그아웃 처리

2. **2단계: React Context로 전역 상태 관리**
   - `AuthProvider` 생성
   - 전역 인증 상태 관리
   - 컴포넌트에서 쉽게 사용

3. **3단계: 주기적인 검증 추가**
   - 5분마다 사용자 정보 확인
   - 토큰 만료/무효화 감지

4. **4단계: API 호출 시 검증 (선택사항)**
   - 중요한 API 호출 전 사용자 정보 확인
   - 캐싱으로 성능 최적화

---

## 비교표

| 방법 | 장점 | 단점 | 권장도 |
|------|------|------|--------|
| 페이지 로드 시 확인 | 구현 간단, 서버 상태와 동기화 | 초기 로딩 시간 증가 | ⭐⭐⭐⭐⭐ |
| 쿠키 기반 세션 | 서버에서 완전 제어, 보안 강화 | 서버 부하 증가, 확장성 제한 | ⭐⭐⭐ |
| 주기적 검증 | 실시간 동기화 | 네트워크 요청 증가 | ⭐⭐⭐⭐ |
| API 호출 시 확인 | 정확한 상태 관리 | 성능 오버헤드 | ⭐⭐⭐ |
| React Context | 전역 상태 관리 용이 | 복잡도 증가 | ⭐⭐⭐⭐⭐ |

---

## 최종 권장 사항

**방법 1 (페이지 로드 시 확인) + 방법 5 (React Context) + 방법 3 (주기적 검증)** 조합:

1. 앱 초기화 시 서버에서 사용자 정보 확인
2. React Context로 전역 인증 상태 관리
3. 5분마다 사용자 정보 재확인
4. 인증 실패 시 자동 로그아웃 및 리다이렉트

이 방법으로 서버 상태와 프론트엔드 상태를 동기화하고, DB 초기화 후에도 올바르게 로그아웃 상태를 유지할 수 있습니다.
