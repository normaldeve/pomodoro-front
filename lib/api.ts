/**
 * API 엔드포인트 관리
 * 모든 API 주소를 여기에 모아서 관리합니다.
 */

import { showErrorNotification } from './system-notification'
import { setServerStatus, isNetworkError } from './server-status'

// API 베이스 URL 설정
// - 개발 환경 (localhost): 백엔드 직접 연결 (http://localhost:8080)
// - 운영 환경: 상대 경로 사용 (Nginx를 통해 라우팅)
const getApiBaseUrl = (): string => {
  // 브라우저 환경에서 개발 환경 감지
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // localhost 또는 127.0.0.1이면 개발 환경
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080'
    }
  }
  
  // 운영 환경 또는 서버 사이드: 상대 경로 사용
  // 예: /api/... → Nginx → backend 컨테이너
  return ''
}

const API_BASE_URL = getApiBaseUrl()

// 인증 관련 API
export const API_ENDPOINTS = {
  // 회원가입
  SIGNUP: `${API_BASE_URL}/api/users/signup`,
  // 사용자 정보 업데이트
  UPDATE_USER_INFO: `${API_BASE_URL}/api/users/me`,
  // 로그인
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  // 토큰 기반 내 정보 조회
  GET_ME_FROM_TOKEN: `${API_BASE_URL}/api/auth/me`,
  // 토큰 갱신
  REFRESH: `${API_BASE_URL}/api/auth/refresh`,
  // 로그아웃
  LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  // 스터디룸 생성
  CREATE_STUDY_ROOM: `${API_BASE_URL}/api/study/create`,
  // 스터디룸 조회
  GET_STUDY_ROOMS: `${API_BASE_URL}/api/study/all`,
  // 상시 운영 방 조회
  GET_PERMANENT_ROOMS: `${API_BASE_URL}/api/study/permanent`,
  // 스터디룸 상세 조회
  GET_STUDY_ROOM: `${API_BASE_URL}/api/study`,
  // 목표 생성
  CREATE_GOAL: `${API_BASE_URL}/api/goals`,
  // 목표 조회
  GET_GOALS: `${API_BASE_URL}/api/goals`,
  // 목표 토글
  TOGGLE_GOAL: `${API_BASE_URL}/api/goals`,
  // 목표 삭제
  DELETE_GOAL: `${API_BASE_URL}/api/goals`,
  // 참여자 목록 조회
  GET_STUDY_ROOM_MEMBERS: `${API_BASE_URL}/api/study-room-members`,
  // 오늘 방 집중 시간 조회
  GET_TODAY_ROOM_FOCUS_TIME: `${API_BASE_URL}/api/study-room-members`,
  // 방장 권한 위임
  TRANSFER_HOST: `${API_BASE_URL}/api/study-room-members`,
  // 내가 마지막으로 참여한 방 정보 조회
  GET_MY_PARTICIPATE_ROOM: `${API_BASE_URL}/api/study-room-members/me/participate`,
  // 메시지 조회
  GET_MESSAGES: `${API_BASE_URL}/api/messages`,
  // 회고 이미지 업로드
  UPLOAD_REFLECTION_IMAGE: `${API_BASE_URL}/api/reflections/image`,
  // 회고 조회
  GET_ROOM_REFLECTIONS: `${API_BASE_URL}/api/reflections`,
  // 내 회고 조회
  GET_MY_REFLECTIONS: `${API_BASE_URL}/api/reflections/my`,
  // 사용자 공부 통계 (히트맵)
  GET_MY_STUDY_STATS: `${API_BASE_URL}/api/stats/me`,
  // 사용자 공부 통계 요약
  GET_STUDY_TIME_SUMMARY: `${API_BASE_URL}/api/stats/me/summary`,
  // 사용자 월별 공부 통계
  GET_MONTHLY_STUDY_STATS: `${API_BASE_URL}/api/stats/me/monthly`,
  // 계획 생성
  CREATE_PLAN: `${API_BASE_URL}/api/plans`,
  // 기간별 계획 조회
  GET_PLANS_BY_DATE_RANGE: `${API_BASE_URL}/api/plans/range`,
  // 특정 날짜의 계획 조회
  GET_PLANS_BY_DATE: `${API_BASE_URL}/api/plans/date`,
} as const

/**
 * 회고 이미지 업로드 API
 * Multipart/form-data로 이미지를 업로드하고 이미지 URL(string)을 반환합니다.
 */
export async function uploadReflectionImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  let response: Response
  try {
    response = await fetch(API_ENDPOINTS.UPLOAD_REFLECTION_IMAGE, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        // Content-Type은 브라우저가 자동으로 설정 (boundary 포함)
      },
    })
    // 요청이 성공하면 서버 연결 상태로 업데이트
    setServerStatus(true)
  } catch (error) {
    // 네트워크 에러인 경우 서버 연결 끊김으로 표시
    if (isNetworkError(error)) {
      setServerStatus(false)
    }
    throw error
  }

  if (!response.ok) {
    return handleErrorResponse<string>(response)
  }

  const text = await response.text()
  return text
}

/**
 * 백엔드 에러 응답 구조
 */
export interface ErrorResponse {
  code: number
  timestamp: string // LocalDateTime은 ISO 8601 문자열로 전송됨
  message: string
  details?: Map<string, Object> | Record<string, any>
}

/**
 * 커스텀 API 에러 클래스
 */
export class ApiError extends Error {
  public readonly code: number
  public readonly timestamp: string
  public readonly details?: Map<string, Object> | Record<string, any>
  public readonly requiresLogin: boolean // 로그인이 필요한 에러인지 여부

  constructor(errorResponse: ErrorResponse) {
    super(errorResponse.message)
    this.name = 'ApiError'
    this.code = errorResponse.code
    this.timestamp = errorResponse.timestamp
    this.details = errorResponse.details
    // "로그인이 필요합니다" 메시지인 경우 로그인 필요 플래그 설정
    this.requiresLogin = errorResponse.message?.includes('로그인이 필요') || false
  }

  /**
   * details에서 특정 필드의 에러 메시지를 가져옵니다
   */
  getFieldError(fieldName: string): string | undefined {
    if (!this.details) return undefined
    
    const details = this.details as Record<string, any>
    return details[fieldName] as string | undefined
  }

  /**
   * 모든 필드 에러를 배열로 반환합니다
   */
  getAllFieldErrors(): Array<{ field: string; message: string }> {
    if (!this.details) return []
    
    const details = this.details as Record<string, any>
    return Object.entries(details).map(([field, message]) => ({
      field,
      message: String(message),
    }))
  }
}

/**
 * 토큰 갱신 함수
 */
async function refreshAccessToken(): Promise<string> {
  let response: Response
  try {
    response = await fetch(API_ENDPOINTS.REFRESH, {
      method: 'POST',
      credentials: 'include', // refresh_token 쿠키 포함
    })
    // 요청이 성공하면 서버 연결 상태로 업데이트
    setServerStatus(true)
  } catch (error) {
    // 네트워크 에러인 경우 서버 연결 끊김으로 표시
    if (isNetworkError(error)) {
      setServerStatus(false)
    }
    throw error
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      // refresh도 401/403이면 로그아웃 처리
      await logout()
      throw new Error('토큰이 만료되었습니다. 다시 로그인해주세요.')
    }
    throw new Error('토큰 갱신에 실패했습니다.')
  }

  const newAccessToken = await response.text()
  
  // 토큰이 비어있으면 에러
  if (!newAccessToken || newAccessToken.trim() === '') {
    throw new Error('토큰 갱신 응답이 비어있습니다.')
  }
  
  // 새로운 accessToken 저장
  localStorage.setItem('accessToken', newAccessToken)
  return newAccessToken
}

/**
 * 로그아웃 처리 함수 (임시)
 */
async function logout(): Promise<void> {
  try {
    await fetch(API_ENDPOINTS.LOGOUT, {
      method: 'POST',
      credentials: 'include',
    })
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    // localStorage 정리
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    // 페이지 새로고침하여 로그인 상태로 리셋
    window.location.href = '/'
  }
}

/**
 * API 요청 헬퍼 함수
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  retryOn403: boolean = true // 403 에러 시 재시도 여부
): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // accessToken이 있으면 헤더에 추가
  const accessToken = localStorage.getItem('accessToken')
  if (accessToken) {
    defaultHeaders['Authorization'] = `Bearer ${accessToken}`
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      credentials: options.credentials || 'include', // 기본적으로 쿠키 포함
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    })
    // 요청이 성공하면 서버 연결 상태로 업데이트
    setServerStatus(true)
  } catch (error) {
    // 네트워크 에러인 경우 서버 연결 끊김으로 표시
    if (isNetworkError(error)) {
      setServerStatus(false)
    }
    throw error
  }

  // 401/403 에러이고 재시도 가능한 경우
  if ((response.status === 401 || response.status === 403) && retryOn403) {
    try {
      // 토큰 갱신 시도
      const newAccessToken = await refreshAccessToken()
      
      // 새로운 accessToken이 제대로 저장되었는지 확인
      if (!newAccessToken || newAccessToken.trim() === '') {
        throw new Error('토큰 갱신에 실패했습니다: 응답이 비어있습니다.')
      }
      
      // localStorage에 저장된 토큰도 업데이트 확인
      const savedToken = localStorage.getItem('accessToken')
      if (savedToken !== newAccessToken) {
        localStorage.setItem('accessToken', newAccessToken)
      }
      
      // 새로운 accessToken으로 원래 요청 재시도
      const retryHeaders = {
        ...defaultHeaders,
        'Authorization': `Bearer ${newAccessToken}`,
        ...options.headers,
      }
      
      let retryResponse: Response
      try {
        retryResponse = await fetch(url, {
          ...options,
          credentials: options.credentials || 'include',
          headers: retryHeaders,
        })
        // 재시도 요청이 성공하면 서버 연결 상태로 업데이트
        setServerStatus(true)
      } catch (error) {
        // 네트워크 에러인 경우 서버 연결 끊김으로 표시
        if (isNetworkError(error)) {
          setServerStatus(false)
        }
        throw error
      }

      // 재시도 후에도 403이면 더 이상 재시도하지 않음 (무한 루프 방지)
      if (retryResponse.status === 403) {
        console.error('토큰 갱신 후에도 403 에러 발생. 재시도 중단.')
        return handleErrorResponse<T>(retryResponse)
      }

      if (!retryResponse.ok) {
        // 재시도 후에도 실패하면 일반 에러 처리
        return handleErrorResponse<T>(retryResponse)
      }

      // 204 No Content 처리
      if (retryResponse.status === 204) {
        return undefined as T
      }

      // 응답 본문이 있는지 확인
      const retryContentType = retryResponse.headers.get('content-type')
      if (!retryContentType || !retryContentType.includes('application/json')) {
        const retryText = await retryResponse.text()
        if (!retryText || retryText.trim() === '') {
          return undefined as T
        }
        try {
          return JSON.parse(retryText) as T
        } catch (error) {
          console.error("재시도 응답 JSON 파싱 실패:", error, "Response text:", retryText)
          return undefined as T
        }
      }

      // JSON 응답 처리
      const retryText = await retryResponse.text()
      if (!retryText || retryText.trim() === '') {
        return undefined as T
      }

      try {
        return JSON.parse(retryText) as T
      } catch (error) {
        console.error("재시도 응답 JSON 파싱 실패:", error, "Response text:", retryText)
        return undefined as T
      }
    } catch (error) {
      // 토큰 갱신 실패 시 (refresh도 403인 경우 logout이 호출됨)
      console.error('토큰 갱신 실패:', error)
      // 에러를 그대로 throw (이미 logout이 처리됨)
      throw error
    }
  }

  if (!response.ok) {
    return handleErrorResponse<T>(response)
  }

  // 204 No Content 처리
  if (response.status === 204) {
    return undefined as T
  }

  // 응답 본문이 있는지 확인
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    // JSON이 아닌 경우 text로 읽기
    const text = await response.text()
    if (!text || text.trim() === '') {
      return undefined as T
    }
    // text가 있으면 JSON 파싱 시도
    try {
      return JSON.parse(text) as T
    } catch (error) {
      return undefined as T
    }
  }

  // JSON 응답 처리
  const text = await response.text()
  if (!text || text.trim() === '') {
    return undefined as T
  }

  // JSON 파싱
  try {
    return JSON.parse(text) as T
  } catch (error) {
    // JSON 파싱 실패 시 undefined 반환
    console.error("JSON 파싱 실패:", error, "Response text:", text)
    return undefined as T
  }
}

/**
 * 에러 응답 처리 함수
 */
async function handleErrorResponse<T>(response: Response): Promise<T> {
  // 백엔드 에러 응답 구조로 파싱 시도
  try {
    const errorResponse: ErrorResponse = await response.json()
    
    // ErrorResponse 구조인지 확인 (code, message, timestamp 필드가 있는지)
    if (errorResponse.code !== undefined && errorResponse.message !== undefined) {
      const apiError = new ApiError(errorResponse)
      
      // 로그인 필요 에러인 경우 시스템 알림을 표시하지 않음 (커스텀 다이얼로그 사용)
      if (!apiError.requiresLogin) {
        // 하나의 시스템 알림으로 통합 표시
        const fieldErrors = apiError.getAllFieldErrors()
        
        // details가 있는 경우 description으로 표시
        if (fieldErrors.length > 0) {
          const detailsMessages = fieldErrors.map(fieldError => 
            `${fieldError.field}: ${fieldError.message}`
          ).join('\n')
          
          showErrorNotification({
            title: apiError.message,
            description: detailsMessages,
          })
        } else {
          // details가 없는 경우 message만 표시
          showErrorNotification(apiError.message)
        }
      }
      
      throw apiError
    } else {
      // ErrorResponse 구조가 아닌 경우
      const apiError = new ApiError({
        code: response.status,
        timestamp: new Date().toISOString(),
        message: errorResponse.message || '요청에 실패했습니다.',
        details: {},
      })
      
      showErrorNotification(apiError.message)
      throw apiError
    }
  } catch (error) {
    // JSON 파싱 실패 또는 이미 ApiError인 경우
    if (error instanceof ApiError) {
      // 이미 시스템 알림이 표시되었으므로 그대로 throw
      throw error
    }
    
    // 파싱 실패 시 기본 에러 생성
    const apiError = new ApiError({
      code: response.status,
      timestamp: new Date().toISOString(),
      message: '요청에 실패했습니다.',
      details: {},
    })
    
    showErrorNotification(apiError.message)
    throw apiError
  }
}

/**
 * 회원가입 API
 */
export interface SignupRequest {
  nickname: string
  username: string
  password: string
  profileUrl?: string | null
}

export interface SignupResponse {
  message?: string
  // 실제 응답 구조에 맞게 수정 필요
}

export async function signup(data: SignupRequest): Promise<SignupResponse> {
  return apiRequest<SignupResponse>(API_ENDPOINTS.SIGNUP, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 로그인 API
 */
export interface LoginRequest {
  username: string
  password: string
}

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface AuthDTO {
  id: number
  username: string
  nickname: string
  profileUrl: string | null
  role: Role
  createdAt?: string // ISO 8601 형식의 날짜 문자열 (사용자 생성일)
}

export interface TokenResponse {
  accessToken: string
  user: AuthDTO
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  // credentials: 'include'를 사용하여 쿠키를 포함한 요청
  // refresh_token은 HttpOnly 쿠키로 자동 저장됨
  // 로그인은 403 재시도 불필요 (retryOn403: false)
  return apiRequest<TokenResponse>(API_ENDPOINTS.LOGIN, {
    method: 'POST',
    body: JSON.stringify(data),
    credentials: 'include', // 쿠키를 포함하여 요청
  }, false)
}

/**
 * 토큰 갱신 API
 */
export async function refresh(): Promise<string> {
  return refreshAccessToken()
}

/**
 * 액세스 토큰(Authorization 헤더)에 기반해 현재 사용자 정보 조회
 */
export async function getCurrentUser(): Promise<AuthDTO> {
  return apiRequest<AuthDTO>(API_ENDPOINTS.GET_ME_FROM_TOKEN, {
    method: 'GET',
  })
}

/**
 * 로그아웃 API (임시)
 */
export async function logoutApi(): Promise<void> {
  return logout()
}

/**
 * 스터디룸 생성 API
 */
export interface CreateStudyRoomRequest {
  title: string
  hashtags?: string[]
  breakMinutes: number
  totalSessions: number
  maxParticipants: number
  secret: boolean
  password?: string
  timerType: TimerType
}

export enum TimerType {
  POMODORO = 'POMODORO',
  FLIP = 'FLIP',
}

export enum RoomStatus {
  BEFORE_START = 'BEFORE_START',
  FOCUS = 'FOCUS',
  BREAK = 'BREAK',
  SESSION_END = 'SESSION_END',
}

export interface StudyRoomResponse {
  roomId: string
  title: string
  description: string
  hashtags: string[]
  focusMinutes: number
  breakMinutes: number
  totalSessions: number
  currentSession: number
  currentParticipants: number
  maxParticipants: number
  secret: boolean
  hostId: number
  status: RoomStatus
  timerType: TimerType
  isPermanent: boolean
  createdAt: string
}

export async function createStudyRoom(data: CreateStudyRoomRequest): Promise<StudyRoomResponse> {
  // Authorization 헤더에 accessToken이 자동으로 포함됨 (apiRequest에서 처리)
  return apiRequest<StudyRoomResponse>(API_ENDPOINTS.CREATE_STUDY_ROOM, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 스터디룸 조회 API
 */
export interface Pageable {
  pageNumber: number
  pageSize: number
  sort: {
    sorted: boolean
    unsorted: boolean
    empty: boolean
  }
  offset: number
  paged: boolean
  unpaged: boolean
}

export interface PageResponse<T> {
  content: T[]
  pageable: Pageable
  totalPages: number
  last: boolean
  totalElements: number
  first: boolean
  numberOfElements: number
  size: number
  number: number
  sort: {
    sorted: boolean
    unsorted: boolean
    empty: boolean
  }
  empty: boolean
}

export enum StudyRoomStatus {
  WAITING = 'WAITING',   // 시작 전
  FOCUS = 'FOCUS',      // 집중 중
  BREAK = 'BREAK',      // 쉬는 중
  FINISHED = 'FINISHED' // 모든 세션 종료
}

export interface StudyRoomListResponse {
  roomId: string
  title: string
  description: string
  hashtags: string[]
  focusMinutes: number
  breakMinutes: number
  totalSessions: number
  currentSession: number
  currentParticipants: number
  maxParticipants: number
  secret: boolean
  hostId: number
  status: StudyRoomStatus
  timerType: TimerType
  createdAt: string
}

export async function getStudyRooms(page: number = 0): Promise<PageResponse<StudyRoomListResponse>> {
  // 인증 헤더가 필요없는 요청이므로 retryOn403: false로 설정
  // Authorization 헤더를 포함하지 않도록 별도 fetch 사용
  let response: Response
  try {
    response = await fetch(`${API_ENDPOINTS.GET_STUDY_ROOMS}?page=${page}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    // 요청이 성공하면 서버 연결 상태로 업데이트
    setServerStatus(true)
  } catch (error) {
    // 네트워크 에러인 경우 서버 연결 끊김으로 표시
    if (isNetworkError(error)) {
      setServerStatus(false)
    }
    throw error
  }

  if (!response.ok) {
    return handleErrorResponse<PageResponse<StudyRoomListResponse>>(response)
  }

  return response.json()
}

/**
 * 상시 운영 방 조회 API
 */
export async function getPermanentRooms(): Promise<StudyRoomResponse[]> {
  // 인증 헤더가 필요없는 요청이므로 별도 fetch 사용
  let response: Response
  try {
    response = await fetch(API_ENDPOINTS.GET_PERMANENT_ROOMS, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    // 요청이 성공하면 서버 연결 상태로 업데이트
    setServerStatus(true)
  } catch (error) {
    // 네트워크 에러인 경우 서버 연결 끊김으로 표시
    if (isNetworkError(error)) {
      setServerStatus(false)
    }
    throw error
  }

  if (!response.ok) {
    return handleErrorResponse<StudyRoomResponse[]>(response)
  }

  return response.json()
}

/**
 * 스터디룸 상세 조회 API
 */
export async function getStudyRoom(roomId: string): Promise<StudyRoomResponse> {
  return apiRequest<StudyRoomResponse>(`${API_ENDPOINTS.GET_STUDY_ROOM}/${roomId}`, {
    method: 'GET',
  })
}

/**
 * 목표 관련 API
 */
export interface CreateStudyGoalRequest {
  content: string
}

export interface StudyGoalResponse {
  id: number
  content: string
  isCompleted: boolean
}

/**
 * 목표 생성 API
 */
export async function createGoal(
  roomId: string,
  data: CreateStudyGoalRequest
): Promise<StudyGoalResponse> {
  return apiRequest<StudyGoalResponse>(`${API_ENDPOINTS.CREATE_GOAL}/${roomId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 내 목표 조회 API
 */
export async function getMyGoals(roomId: string): Promise<StudyGoalResponse[]> {
  return apiRequest<StudyGoalResponse[]>(`${API_ENDPOINTS.GET_GOALS}/${roomId}`, {
    method: 'GET',
  })
}

/**
 * 목표 완료/미완료 토글 API
 */
export async function toggleGoal(goalId: number): Promise<void> {
  return apiRequest<void>(`${API_ENDPOINTS.TOGGLE_GOAL}/${goalId}/toggle`, {
    method: 'PATCH',
  })
}

/**
 * 목표 삭제 API
 */
export async function deleteGoal(goalId: number): Promise<void> {
  return apiRequest<void>(`${API_ENDPOINTS.DELETE_GOAL}/${goalId}`, {
    method: 'DELETE',
  })
}

/**
 * 참여자 관련 API
 */
export enum RoomMemberRole {
  HOST = 'HOST',
  MEMBER = 'MEMBER',
}

export interface StudyRoomMemberResponse {
  userId: number
  nickname: string
  profileUrl: string | null
  role: RoomMemberRole
}

export interface ParticipateRoomInfo {
  lastRoomId: string
  role: RoomMemberRole
  lastRoomJointAt: string
}

/**
 * 참여자 목록 조회 API
 */
export async function getStudyRoomMembers(roomId: string): Promise<StudyRoomMemberResponse[]> {
  return apiRequest<StudyRoomMemberResponse[]>(`${API_ENDPOINTS.GET_STUDY_ROOM_MEMBERS}/${roomId}`, {
    method: 'GET',
  })
}

/**
 * 방장 권한 위임 API
 */
export async function transferHost(roomId: string, targetUserId: number): Promise<void> {
  return apiRequest<void>(`${API_ENDPOINTS.TRANSFER_HOST}/${roomId}/transfer-host`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId }),
  })
}

/**
 * 내가 마지막으로 참여한 방 정보 조회 API
 */
export async function getParticipateRoomInfo(): Promise<ParticipateRoomInfo | null> {
  try {
    return await apiRequest<ParticipateRoomInfo>(API_ENDPOINTS.GET_MY_PARTICIPATE_ROOM, {
      method: 'GET',
    })
  } catch (error: any) {
    // 404 Not Found 인 경우에는 단순히 참여 방이 없는 것이므로 null 반환
    if (error instanceof ApiError && error.code === 404) {
      return null
    }
    throw error
  }
}

/**
 * 오늘 해당 방에서 내가 집중한 총 시간(분)을 조회하는 API
 * 백엔드는 분 단위(Integer)를 반환하므로, 프론트에서는 필요에 따라 변환해서 사용합니다.
 */
export async function getTodayRoomFocusTime(roomId: string): Promise<number> {
  return apiRequest<number>(`${API_ENDPOINTS.GET_TODAY_ROOM_FOCUS_TIME}/${roomId}/focus-time/total`, {
    method: 'GET',
  })
}

/**
 * 사용자 공부 히트맵 통계 API
 */
export interface StudyHeatmapDayRecord {
  date: string       // ISO 날짜 문자열 (YYYY-MM-DD)
  level: number      // 0 ~ 4
  totalMinutes: number // 해당 날짜 총 공부 시간(분)
}

export interface StudyHeatmapResponse {
  year: number
  records: StudyHeatmapDayRecord[]
}

/**
 * 특정 연도의 내 공부 히트맵 데이터를 조회
 */
export async function getStudyHeatmap(year: number): Promise<StudyHeatmapResponse> {
  return apiRequest<StudyHeatmapResponse>(`${API_ENDPOINTS.GET_MY_STUDY_STATS}?year=${year}`, {
    method: 'GET',
  })
}

/**
 * 사용자 공부 시간 요약 통계 API
 */
export interface StudyTimeSummaryResponse {
  todayMinutes: number
  thisWeekMinutes: number
  thisMonthMinutes: number
  consecutiveDays: number
}

/**
 * 내 공부 시간 요약 통계를 조회
 */
export async function getStudyTimeSummary(): Promise<StudyTimeSummaryResponse> {
  return apiRequest<StudyTimeSummaryResponse>(API_ENDPOINTS.GET_STUDY_TIME_SUMMARY, {
    method: 'GET',
  })
}

/**
 * 사용자 월별 공부 통계 API
 */
export interface MonthRecord {
  year: number
  month: number
  totalMinutes: number
}

export interface MonthlyStudyStatResponse {
  startYear: number
  startMonth: number
  endYear: number
  endMonth: number
  monthlyRecords: MonthRecord[]
}

/**
 * 월별 공부 통계를 조회 (해당 월을 포함하여 6개월 데이터)
 */
export async function getMonthlyStudyStats(
  year: number,
  month: number
): Promise<MonthlyStudyStatResponse> {
  return apiRequest<MonthlyStudyStatResponse>(
    `${API_ENDPOINTS.GET_MONTHLY_STUDY_STATS}?year=${year}&month=${month}`,
    {
      method: 'GET',
    }
  )
}

/**
 * 메시지 관련 API
 */
export interface MessageSliceResponse {
  content: MessageResponse[]
  pageable: {
    pageNumber: number
    pageSize: number
    sort: {
      sorted: boolean
      unsorted: boolean
      empty: boolean
    }
    offset: number
    paged: boolean
    unpaged: boolean
  }
  numberOfElements: number
  first: boolean
  last: boolean
  size: number
  number: number
  sort: {
    sorted: boolean
    unsorted: boolean
    empty: boolean
  }
  empty: boolean
}

export interface MessageResponse {
  messageId: number
  content: string
  senderId: number
  senderName?: string
  senderNickname?: string
  timestamp?: string  // WebSocket 메시지에서 사용
  createdAt?: string  // API 응답에서 사용
  roomId?: string
  senderProfileUrl?: string | null
}

/**
 * 메시지 조회 API
 */
export async function getMessages(
  roomId: string,
  lastMessageId?: number,
  size: number = 30
): Promise<MessageSliceResponse> {
  const params = new URLSearchParams()
  if (lastMessageId !== undefined) {
    params.append('lastMessageId', lastMessageId.toString())
  }
  params.append('size', size.toString())

  return apiRequest<MessageSliceResponse>(
    `${API_ENDPOINTS.GET_MESSAGES}/${roomId}?${params.toString()}`,
    {
      method: 'GET',
    }
  )
}

/**
 * 회고 관련 API
 */
export interface ReflectionResponse {
  reflectionId: number
  sessionId: number
  userId: number
  content: string
  nickname: string
  userProfileUrl: string | null
  focusScore: number | null
  imageUrl: string | null
  createdAt: string
}

/**
 * 방의 회고 목록 조회 API
 */
export async function getRoomReflections(roomId: string): Promise<ReflectionResponse[]> {
  return apiRequest<ReflectionResponse[]>(`${API_ENDPOINTS.GET_ROOM_REFLECTIONS}/${roomId}`, {
    method: 'GET',
  })
}

/**
 * 내 회고 조회 API 응답 타입
 */
export interface ReflectionQueryResponse {
  reflectionId: number
  sessionId: number
  content: string
  focusScore: number | null
  imageUrl: string | null
  createdAt: string // ISO 8601 형식의 날짜 문자열
  user: {
    userId: number
    nickname: string
    profileUrl: string | null
    createdAt: string
  }
  room: {
    roomId: string
    roomName: string
  }
}

/**
 * 내 회고 조회 API
 * @param date 특정 날짜 (YYYY-MM-DD 형식, optional)
 * @param year 연도 (optional)
 * @param month 월 (1-12, optional)
 */
export async function getMyReflections(
  date?: string,
  year?: number,
  month?: number
): Promise<ReflectionQueryResponse[]> {
  const params = new URLSearchParams()
  if (date) {
    params.append('date', date)
  }
  if (year !== undefined) {
    params.append('year', year.toString())
  }
  if (month !== undefined) {
    params.append('month', month.toString())
  }

  const queryString = params.toString()
  const url = queryString
    ? `${API_ENDPOINTS.GET_MY_REFLECTIONS}?${queryString}`
    : API_ENDPOINTS.GET_MY_REFLECTIONS

  return apiRequest<ReflectionQueryResponse[]>(url, {
    method: 'GET',
  })
}

/**
 * 사용자 정보 업데이트 API
 */
export interface UserInfo {
  userId: number
  nickname: string
  profileUrl: string | null
  createdAt: string // ISO 8601 형식의 날짜 문자열
}

export interface UpdateUserInfoRequest {
  file?: File | null
  nickname?: string | null
}

/**
 * 사용자 프로필 이미지와 닉네임 업데이트 API
 * Multipart/form-data 형식으로 전송합니다.
 */
export async function updateUserInfo(data: UpdateUserInfoRequest): Promise<UserInfo> {
  const formData = new FormData()
  
  // 파일이 있으면 추가
  if (data.file) {
    formData.append('file', data.file)
  }
  
  // 닉네임이 있으면 추가
  if (data.nickname !== undefined && data.nickname !== null) {
    formData.append('nickname', data.nickname)
  }

  const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  let response: Response
  try {
    response = await fetch(API_ENDPOINTS.UPDATE_USER_INFO, {
      method: 'PATCH',
      body: formData,
      credentials: 'include',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        // Content-Type은 브라우저가 자동으로 설정 (boundary 포함)
      },
    })
    // 요청이 성공하면 서버 연결 상태로 업데이트
    setServerStatus(true)
  } catch (error) {
    // 네트워크 에러인 경우 서버 연결 끊김으로 표시
    if (isNetworkError(error)) {
      setServerStatus(false)
    }
    throw error
  }

  if (!response.ok) {
    return handleErrorResponse<UserInfo>(response)
  }

  return response.json()
}

/**
 * 계획 관련 API
 */
export enum EventColor {
  RED = 'RED',
  ORANGE = 'ORANGE',
  YELLOW = 'YELLOW',
  GREEN = 'GREEN',
  BLUE = 'BLUE',
  INDIGO = 'INDIGO',
  PURPLE = 'PURPLE',
  PINK = 'PINK',
}

export interface CreatePlanRequest {
  title: string
  planDate: string // ISO 8601 형식 (YYYY-MM-DD)
  startTime: string // HH:mm 형식
  endTime: string // HH:mm 형식
  color: EventColor
}

export interface UpdatePlanRequest {
  title: string
  planDate: string // ISO 8601 형식 (YYYY-MM-DD)
  startTime: string // HH:mm 형식
  endTime: string // HH:mm 형식
  color: EventColor
}

export interface PlanResponse {
  id: number
  title: string
  planDate: string // ISO 8601 형식 (YYYY-MM-DD)
  startTime: string // HH:mm 형식
  endTime: string // HH:mm 형식
  color: EventColor
  completed: boolean
  createdAt: string // ISO 8601 형식
  updatedAt: string // ISO 8601 형식
}

/**
 * 계획 생성 API
 */
export async function createPlan(data: CreatePlanRequest): Promise<PlanResponse> {
  return apiRequest<PlanResponse>(API_ENDPOINTS.CREATE_PLAN, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 계획 수정 API
 * @param planId 계획 ID
 * @param data 수정할 계획 데이터
 */
export async function updatePlan(planId: number, data: UpdatePlanRequest): Promise<PlanResponse> {
  return apiRequest<PlanResponse>(`${API_ENDPOINTS.CREATE_PLAN}/${planId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * 기간별 계획 조회 API (월별 캘린더용)
 * @param startDate 시작 날짜 (YYYY-MM-DD 형식)
 * @param endDate 종료 날짜 (YYYY-MM-DD 형식)
 */
export async function getPlansByDateRange(
  startDate: string,
  endDate: string
): Promise<PlanResponse[]> {
  const params = new URLSearchParams()
  params.append('startDate', startDate)
  params.append('endDate', endDate)

  return apiRequest<PlanResponse[]>(
    `${API_ENDPOINTS.GET_PLANS_BY_DATE_RANGE}?${params.toString()}`,
    {
      method: 'GET',
    }
  )
}

/**
 * 특정 날짜의 계획 조회 API (모바일용)
 * @param date 날짜 (YYYY-MM-DD 형식)
 */
export async function getPlansByDate(date: string): Promise<PlanResponse[]> {
  return apiRequest<PlanResponse[]>(`${API_ENDPOINTS.GET_PLANS_BY_DATE}/${date}`, {
    method: 'GET',
  })
}

/**
 * 계획 삭제 API
 * @param planId 계획 ID
 */
export async function deletePlan(planId: number): Promise<void> {
  return apiRequest<void>(`${API_ENDPOINTS.CREATE_PLAN}/${planId}`, {
    method: 'DELETE',
  })
}

/**
 * 계획 완료 상태 토글 API
 * @param planId 계획 ID
 */
export async function togglePlanCompleted(planId: number): Promise<PlanResponse> {
  return apiRequest<PlanResponse>(`${API_ENDPOINTS.CREATE_PLAN}/${planId}/toggle/completed`, {
    method: 'PATCH',
  })
}

/**
 * 계획 미완료 상태 토글 API
 * @param planId 계획 ID
 */
export async function togglePlanUncompleted(planId: number): Promise<PlanResponse> {
  return apiRequest<PlanResponse>(`${API_ENDPOINTS.CREATE_PLAN}/${planId}/toggle/uncompleted`, {
    method: 'PATCH',
  })
}
