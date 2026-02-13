const CACHE_NAME = "pokeddor-pwa-v1";

const ASSETS_TO_CACHE = [
  "/",
  "/favicon.ico",
  "/manifest.json"
];

// FCM background notifications
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCjoyJ1Xa0QfOSWXQwlWl-mM-rQIPJpWfU",
  authDomain: "pogather-b3235.firebaseapp.com",
  projectId: "pogather-b3235",
  storageBucket: "pogather-b3235.firebasestorage.app",
  messagingSenderId: "1011606323199",
  appId: "1:1011606323199:web:f009492d376febe38931ca",
  measurementId: "G-JKKS10HSY4",
};

try {
  importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
  importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js");

  if (self.firebase && self.firebase.apps && self.firebase.apps.length === 0) {
    self.firebase.initializeApp(FIREBASE_CONFIG);
  }

  if (self.firebase && self.firebase.messaging) {
    const messaging = self.firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notificationTitle = payload.notification?.title ?? "새 알림이 있습니다";
      const notificationOptions = {
        body: payload.notification?.body ?? "",
        icon: payload.notification?.icon ?? "/images/home_icon.png",
        data: payload.data ?? {},
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (error) {
  console.error("[SW] Failed to initialize Firebase Messaging:", error);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).then(
      () => self.skipWaiting()
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // only handle GET
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => cached);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow("/");
    })
  );
});
