/* 
 * Firebase Cloud Messaging Service Worker
 *
 * 이 파일은 브라우저가 백그라운드에서 푸시 알림을 수신하기 위해 사용됩니다.
 * .env.local의 환경변수는 여기서 바로 사용할 수 없으므로,
 * Firebase 콘솔에서 확인한 값을 아래 firebaseConfig에 직접 입력해 주세요.
 */

// Firebase v8 CDN 스크립트 사용 (Service Worker에서는 ES Module import가 제한적이기 때문)
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js")
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js")

const firebaseConfig = {
  apiKey: "AIzaSyCjoyJ1Xa0QfOSWXQwlWl-mM-rQIPJpWfU",
  authDomain: "pogather-b3235.firebaseapp.com",
  projectId: "pogather-b3235",
  storageBucket: "pogather-b3235.firebasestorage.app",
  messagingSenderId: "1011606323199",
  appId: "1:1011606323199:web:f009492d376febe38931ca",
  measurementId: "G-JKKS10HSY4"
};

firebase.initializeApp(firebaseConfig)

const messaging = firebase.messaging()

// 앱이 백그라운드 상태일 때 수신하는 메시지 처리
messaging.onBackgroundMessage(function (payload) {
  console.log("[firebase-messaging-sw.js] Background message received:", payload)

  const notificationTitle = payload.notification?.title ?? "새 알림이 있습니다"
  const notificationOptions = {
    body: payload.notification?.body ?? "",
    icon: payload.notification?.icon ?? "/images/home_icon.png",
    data: payload.data ?? {},
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

