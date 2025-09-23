importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js");

// Конфиг
firebase.initializeApp({
  apiKey: "AIzaSyBTvvpJrXsP6OY0fRov1ImbFFYXUPW1c4w",
  authDomain: "messenger-3f86f.firebaseapp.com",
  projectId: "messenger-3f86f",
  storageBucket: "messenger-3f86f.appspot.com",
  messagingSenderId: "205110361755",
  appId: "1:205110361755:web:be6c1487ac041bba7f903e",
  measurementId: "G-XFRCVYP9XK"
});

const messaging = firebase.messaging();

// Когда пуш приходит в фоне
messaging.onBackgroundMessage((payload) => {
  console.log("Получено сообщение в SW:", payload);

  const title = payload.notification?.title || "Новое сообщение";
  const options = {
    body: payload.notification?.body || "",
    icon: payload.notification?.icon || "/icon.png"
  };

  self.registration.showNotification(title, options);
});

// Дополнительно — ловим push (на случай, если FCM не вызовет onBackgroundMessage)
self.addEventListener("push", (event) => {
  if (event.data) {
    const payload = event.data.json();
    console.log("Push event:", payload);

    const title = payload.notification?.title || "Новое уведомление";
    const options = {
      body: payload.notification?.body || "",
      icon: payload.notification?.icon || "/icon.png"
    };

    event.waitUntil(self.registration.showNotification(title, options));
  }
});
