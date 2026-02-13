import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import { getMessaging, isSupported, type Messaging } from "firebase/messaging"

let firebaseApp: FirebaseApp | null = null

function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp

  if (!getApps().length) {
    firebaseApp = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    })
  } else {
    firebaseApp = getApp()
  }

  return firebaseApp
}

let messagingPromise: Promise<Messaging | null> | null = null

export function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messagingPromise) return messagingPromise

  messagingPromise = (async () => {
    if (typeof window === "undefined") return null

    const supported = await isSupported().catch(() => false)
    if (!supported) {
      console.warn("[FCM] 이 브라우저에서는 Firebase Messaging이 지원되지 않습니다.")
      return null
    }

    const app = getFirebaseApp()
    return getMessaging(app)
  })()

  return messagingPromise
}

