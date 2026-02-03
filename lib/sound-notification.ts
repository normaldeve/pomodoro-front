/**
 * 소리 알림 관리
 * 웹소켓 메시지 수신 시 브라우저에서 소리 재생
 */

// 소리 파일 경로 설정
// 사용자가 원하는 소리 파일을 public/sounds 폴더에 추가하고 경로를 변경할 수 있습니다
const DEFAULT_SOUND_PATH = '/sounds/Pling-Sound.mp3'

// 환경 변수에서 소리 파일 경로를 가져올 수 있도록 설정
// .env.local 파일에 NEXT_PUBLIC_NOTIFICATION_SOUND=/sounds/your-sound.mp3 형태로 설정 가능
const SOUND_PATH = process.env.NEXT_PUBLIC_NOTIFICATION_SOUND || DEFAULT_SOUND_PATH

// Audio 객체를 재사용하기 위해 전역으로 관리
let audioInstance: HTMLAudioElement | null = null

// 소리 on/off 설정을 localStorage에서 관리
const SOUND_ENABLED_KEY = 'soundNotificationEnabled'

/**
 * 소리 알림 활성화 여부 가져오기
 * @returns 소리 알림이 활성화되어 있으면 true, 기본값은 true
 */
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  
  const stored = localStorage.getItem(SOUND_ENABLED_KEY)
  // 저장된 값이 없으면 기본값 true 반환
  if (stored === null) {
    return true
  }
  
  return stored === 'true'
}

/**
 * 소리 알림 활성화/비활성화 설정
 * @param enabled true면 소리 재생, false면 재생하지 않음
 */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return
  }
  
  localStorage.setItem(SOUND_ENABLED_KEY, enabled.toString())
}

/**
 * 소리 알림 재생
 * @param soundPath 재생할 소리 파일 경로 (선택사항, 기본값은 설정된 경로 사용)
 * @param checkSoundEnabled 소리 설정을 확인할지 여부 (기본값: false, tick.mov 재생 시에만 true)
 */
export function playNotificationSound(soundPath?: string, checkSoundEnabled: boolean = false): void {
  // 브라우저 환경이 아니면 실행하지 않음
  if (typeof window === 'undefined') {
    return
  }

  // checkSoundEnabled가 true이고 소리 알림이 비활성화되어 있으면 재생하지 않음
  if (checkSoundEnabled && !isSoundEnabled()) {
    return
  }

  try {
    const path = soundPath || SOUND_PATH
    // 파일명에 공백이나 특수문자가 있을 수 있으므로 encodeURI로 처리
    const encodedPath = encodeURI(path)
    
    // 기존 Audio 객체가 있으면 재사용, 없으면 새로 생성
    if (!audioInstance || audioInstance.src !== `${window.location.origin}${encodedPath}`) {
      // 기존 인스턴스가 있으면 해제
      if (audioInstance) {
        audioInstance.pause()
        audioInstance = null
      }
      
      // 새 Audio 객체 생성 (경로는 encodeURI로 처리된 경로 사용)
      audioInstance = new Audio(encodedPath)
      audioInstance.volume = 0.5 // 볼륨 50%로 설정 (0.0 ~ 1.0)
      
      // 에러 핸들러 추가 (파일을 찾을 수 없는 경우)
      audioInstance.addEventListener('error', (e) => {
        console.warn(`소리 파일을 찾을 수 없습니다: ${path}. public/sounds 폴더에 소리 파일을 추가해주세요.`)
        audioInstance = null
      })
    }

    // 소리 재생
    audioInstance.play().catch((error) => {
      // 사용자가 아직 페이지와 상호작용하지 않아서 재생이 차단된 경우
      if (error.name === 'NotAllowedError') {
        // 자동 재생 정책으로 인한 차단은 조용히 무시
        return
      }
      // play() 요청이 pause()에 의해 중단된 경우 (정상적인 동작일 수 있음)
      if (error.name === 'AbortError') {
        // 이전 재생이 중단되고 새로 재생되는 경우이므로 조용히 무시
        return
      }
      // 그 외의 에러만 콘솔에 표시
      console.warn('소리 재생 실패:', error)
    })
  } catch (error) {
    console.error('소리 알림 오류:', error)
  }
}

/**
 * 소리 알림 설정
 * @param volume 볼륨 (0.0 ~ 1.0)
 * @param soundPath 소리 파일 경로
 */
export function setNotificationSoundSettings(volume?: number, soundPath?: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const path = soundPath || SOUND_PATH
    // 파일명에 공백이나 특수문자가 있을 수 있으므로 encodeURI로 처리
    const encodedPath = encodeURI(path)
    
    // Audio 객체가 없거나 경로가 다르면 새로 생성
    if (!audioInstance || audioInstance.src !== `${window.location.origin}${encodedPath}`) {
      if (audioInstance) {
        audioInstance.pause()
        audioInstance = null
      }
      
      audioInstance = new Audio(encodedPath)
    }

    // 볼륨 설정
    if (volume !== undefined) {
      audioInstance.volume = Math.max(0, Math.min(1, volume))
    }
  } catch (error) {
    console.error('소리 설정 오류:', error)
  }
}
