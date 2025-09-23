// Импортируем скрипт Firebase Messaging для Service Worker. 
// Важно использовать этот скрипт, а не импортировать отдельные модули вручную.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-sw.js');

// Настройки приложения Firebase.
// Это должен быть тот же объект, который вы используете для инициализации основного приложения.
const firebaseConfig = {
    apiKey: "AIzaSyBTvvpJrXsP6OY0fRov1ImbFFYXUPW1c4w",
    authDomain: "messenger-3f86f.firebaseapp.com",
    projectId: "messenger-3f86f",
    storageBucket: "messenger-3f86f.appspot.com",
    messagingSenderId: "205110361755",
    appId: "1:205110361755:web:be6c1487ac041bba7f903e",
    measurementId: "G-XFRCVYP9XK",
};

// Инициализируем Firebase
firebase.initializeApp(firebaseConfig);

// Получаем сервис-воркер Firebase Messaging
const messaging = firebase.messaging();

// Обработка фоновых сообщений
messaging.onBackgroundMessage((payload) => {
    console.log('[Service Worker] Push Received.');

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || '/mesengger/icon.png' // Убедитесь, что путь правильный
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});