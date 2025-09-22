importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js");

firebase.initializeApp({
  apiKey: "AIzaSyBTvvpJrXsP6OY0fRov1ImbFFYXUPW1c4w",
  authDomain: "messenger-3f86f.firebaseapp.com",
  projectId: "messenger-3f86f",
  storageBucket: "messenger-3f86f.firebasestorage.app",
  messagingSenderId: "205110361755",
  appId: "1:205110361755:web:be6c1487ac041bba7f903e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: payload.notification.icon
  });
});
