// firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js");

// Конфиг Firebase (тот же, что в index.html)
firebase.initializeApp({
  apiKey: "AIzaSyBTvvpJrXsP6OY0fRov1ImbFFYXUPW1c4w",
  authDomain: "messenger-3f86f.firebaseapp.com",
  projectId: "messenger-3f86f",
  storageBucket: "messenger-3f86f.appspot.com", // <-- исправил!
  messagingSenderId: "205110361755",
  appId: "1:205110361755:web:be6c1487ac041bba7f903e",
  measurementId: "G-XFRCVYP9XK"
});

const messaging = firebase.messaging();

// Обработка входящих пушей (фон)
messaging.onBackgroundMessage((payload) => {
  console.log("Получено сообщение в фоне (Messaging):", payload);

  const notificationTitle = payload.notification?.title || "Новое сообщение";
  const notificationOptions = {
    body: payload.notification?.body || "Открой сайт, чтобы прочитать!",
    icon: payload.notification?.icon || "/mesengger/icon.png"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Дополнительно — ловим push (на случай, если FCM не вызовет onBackgroundMessage)
self.addEventListener("push", (event) => {
  if (event.data) {
    const payload = event.data.json();
    console.log("Push event:", payload);

    const title = payload.notification?.title || "Новое уведомление";
    const options = {
      body: payload.notification?.body,
      icon: payload.notification?.icon || "/mesengger/icon.png"
    };

    event.waitUntil(self.registration.showNotification(title, options));
  }
});
