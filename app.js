// ---------- Конфиг Firebase ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  where, // Добавлено для поиска
  getDocs, // Добавлено для поиска
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBTvvpJrXsP6OY0fRov1ImbFFYXUPW1c4w",
  authDomain: "messenger-3f86f.firebaseapp.com",
  projectId: "messenger-3f86f",
  storageBucket: "messenger-3f86f.appspot.com",
  messagingSenderId: "205110361755",
  appId: "1:205110361755:web:be6c1487ac041bba7f903e",
  measurementId: "G-XFRCVYP9XK",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ---------- Конфиг Cloudinary ----------
const cloudName = "du5qgenm4";
const uploadPreset = "messenger_upload";

// ---------- Элементы DOM ----------
const authDiv = document.getElementById("auth");
const chatDiv = document.getElementById("chat");
const emailIn = document.getElementById("email");
const passIn = document.getElementById("password");
const nicknameIn = document.getElementById("nickname"); // Добавлен элемент nicknameIn
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const welcome = document.getElementById("welcome");
const messagesDiv = document.getElementById("messages");
const msgInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const fileInput = document.getElementById("fileInput");
const progressText = document.getElementById("progress");

// Элементы для чатов
const chatList = document.getElementById("chatList");
const currentChatName = document.getElementById("currentChatName");
const globalChatLink = document.getElementById("globalChatLink");
const callBtn = document.getElementById("callBtn");

// Элементы для поиска пользователей
const newChatBtn = document.getElementById("newChatBtn");
const searchUserModal = document.getElementById("searchUserModal");
const closeSearchModal = document.getElementById("closeSearchModal");
const searchNickname = document.getElementById("searchNickname");
const searchUserBtn = document.getElementById("searchUserBtn");
const searchResults = document.getElementById("searchResults");


let currentNick = "";
let currentUid = null;
let pendingFile = null;

let currentChatId = "global"; // ID текущего чата. 'global' для общего.
let currentChatTargetUid = null; // UID собеседника для DM

// ---------- Аутентификация ----------

loginBtn.addEventListener("click", async () => {
  const email = emailIn.value.trim();
  const password = passIn.value;
  if (!email || !password) return alert("Заполни email и пароль.");
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert(e.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUid = user.uid;
    const udoc = await getDoc(doc(db, "users", user.uid));
    
    // Получаем ник из Firestore
    currentNick = udoc.exists()
      ? udoc.data().nickname || user.email
      : user.email;
      
    welcome.innerText = "Привет, " + currentNick;
    authDiv.style.display = "none";
    chatDiv.style.display = "flex"; // Используем flex для нового макета
    
    // Переключаемся на общий чат при входе
    switchChat("global", "Общий чат"); 
    startChatsListener(); // Начинаем слушать список DM чатов

  } else {
    currentNick = "";
    currentUid = null;
    authDiv.style.display = "block";
    chatDiv.style.display = "none";
    messagesDiv.innerHTML = "";
    stopMessagesListener();
    stopChatsListener();
  }
});

const registerBtn = document.getElementById("registerBtn");

// Убедимся, что слушатель регистрации один и он корректный
registerBtn.addEventListener("click", async () => {
  const email = emailIn.value.trim();
  const password = passIn.value;
  const nickname = nicknameIn.value.trim();

  if (!email || !password || !nickname) {
    return alert("Заполни email, пароль и ник!");
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // создаём документ в коллекции users
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email: email,
      nickname: nickname,
      createdAt: serverTimestamp(),
    });

    alert("Регистрация успешна! Теперь войди.");
  } catch (e) {
    alert("Ошибка регистрации: " + e.message);
  }
});

// ---------- Логика Чатов и Сообщений ----------

let unsubscribeMessages = null;
let unsubscribeChats = null;

// Функция для запуска прослушивания сообщений для конкретного чата
function startMessagesListener(chatId) {
  stopMessagesListener(); 

  const collectionPath = chatId === "global"
    ? "messages" // Общий чат
    : `chats/${chatId}/messages`; // Личный чат (DM)

  const q = query(collection(db, collectionPath), orderBy("timestamp", "asc"));
  unsubscribeMessages = onSnapshot(q, (snap) => {
    messagesDiv.innerHTML = "";
    snap.forEach((docSnap) => {
      const m = docSnap.data();
      // Добавляем флаг isOwn для стилизации
      m.isOwn = m.uid === currentUid; 
      renderMessage(m);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

function stopMessagesListener() {
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }
}

// Функция для прослушивания списка DM чатов пользователя
function startChatsListener() {
  if (!currentUid) return;
  const q = query(
    collection(db, "chats"),
    where("participants", "array-contains", currentUid),
    orderBy("updatedAt", "desc") // Сортируем по дате последнего сообщения
  );

  unsubscribeChats = onSnapshot(q, (snap) => {
    // Очищаем все DM, оставляя только ссылку на общий чат
    chatList.querySelectorAll(".dm-item").forEach(el => el.remove()); 
    
    snap.forEach((docSnap) => {
      // Игнорируем общий чат, если он вдруг попал в DM
      if (docSnap.id === "global") return; 
      renderChatItem(docSnap.id, docSnap.data());
    });
  });
}

function stopChatsListener() {
  if (unsubscribeChats) {
    unsubscribeChats();
    unsubscribeChats = null;
  }
}

// Переключение активного чата
function switchChat(newChatId, chatName, targetUid = null) {
  // Снимаем класс active с предыдущего
  document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
  
  const newActiveElement = document.querySelector(`[data-chat-id="${newChatId}"]`);
  if (newActiveElement) {
    newActiveElement.classList.add("active");
  }

  currentChatId = newChatId;
  currentChatTargetUid = targetUid; // UID собеседника для звонка
  currentChatName.innerText = chatName;

  startMessagesListener(currentChatId);

  // Показываем кнопку звонка только в личных чатах
  callBtn.style.display = newChatId === "global" ? "none" : "inline-block";
}

// Рендер элемента в списке чатов
function renderChatItem(chatId, chatData) {
    // Определяем ник собеседника
    const otherUid = chatData.participants.find(uid => uid !== currentUid);
    const chatName = chatData.participantsNicknames[otherUid] || "Личный чат"; 

    const el = document.createElement("div");
    el.className = "chat-item dm-item";
    el.setAttribute("data-chat-id", chatId);
    el.textContent = chatName;
    el.addEventListener("click", () => switchChat(chatId, chatName, otherUid));
    chatList.appendChild(el);
}

// Обработчик для ссылки на общий чат
globalChatLink.addEventListener("click", () => switchChat("global", "Общий чат"));


function renderMessage(msg) {
  const el = document.createElement("div");
  el.className = "msg";
  // Добавляем класс 'own' для стилизации своих сообщений
  if (msg.isOwn) { 
      el.classList.add("own");
  } 

  const meta = document.createElement("div");
  meta.className = "meta";
  const timeStr =
    msg.timestamp && msg.timestamp.toDate
      ? new Date(msg.timestamp.toDate()).toLocaleString()
      : "";
  meta.textContent = (msg.sender || "Anon") + (timeStr ? " • " + timeStr : "");
  el.appendChild(meta);

  if (msg.fileUrl) {
    const url = msg.fileUrl;
    const type = msg.fileType || "";
    if (
      type.startsWith("image/") ||
      url.match(/\.(jpe?g|png|gif|webp)(\?|$)/i)
    ) {
      const i = document.createElement("img");
      i.src = url;
      i.alt = msg.fileName || "image";
      el.appendChild(i);
    } else if (
      type.startsWith("video/") ||
      url.match(/\.(mp4|webm|ogg)(\?|$)/i)
    ) {
      const v = document.createElement("video");
      v.controls = true;
      v.src = url;
      el.appendChild(v);
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.textContent = "📎 " + (msg.fileName || "Скачать файл");
      el.appendChild(a);
    }
    if (msg.text) {
      const t = document.createElement("div");
      t.className = "small";
      t.textContent = msg.text;
      el.appendChild(t);
    }
  } else {
    const p = document.createElement("div");
    p.textContent = msg.text || "";
    el.appendChild(p);
  }
  messagesDiv.appendChild(el);
}

fileInput.addEventListener("change", (e) => {
  pendingFile = e.target.files[0] || null;
  if (pendingFile) {
    progressText.innerText = "Файл выбран: " + pendingFile.name;
  } else {
    progressText.innerText = "";
  }
});

msgInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    await sendMessage();
  }
});

sendBtn.addEventListener("click", async () => {
  await sendMessage();
});

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text && !pendingFile) return;

  try {
    let fileUrl = null;
    let fileType = null;
    let fileName = null;
    if (pendingFile) {
      progressText.innerText = "Загружаю файл...";
      const fd = new FormData();
      fd.append("file", pendingFile);
      fd.append("upload_preset", uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
        {
          method: "POST",
          body: fd,
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error("Cloudinary upload failed: " + errText);
      }

      const data = await res.json();
      fileUrl = data.secure_url;
      fileType =
        pendingFile.type || (data.resource_type === "image" ? "image/*" : "");
      fileName = pendingFile.name || (data.public_id || "").split("/").pop();
      progressText.innerText = "Файл загружен";
    }

    const messageData = {
        text: text || "",
        sender: currentNick || "Anon",
        uid: currentUid, // UID для определения, кто отправил
        fileUrl: fileUrl || null,
        fileType: fileType || null,
        fileName: fileName || null,
        timestamp: serverTimestamp(),
    };

    if (currentChatId === "global") {
      // Отправка в общий чат
      await addDoc(collection(db, "messages"), messageData);
    } else {
      // Отправка в личный чат (подколлекция)
      const chatMessagesRef = collection(db, `chats/${currentChatId}/messages`);
      await addDoc(chatMessagesRef, messageData);
      
      // Обновляем метку времени чата и последнее сообщение
      await setDoc(doc(db, "chats", currentChatId), {
          updatedAt: serverTimestamp(),
          lastMessage: text || (fileName ? `[Файл: ${fileName}]` : "[Файл]"),
      }, { merge: true });
    }

    msgInput.value = "";
    fileInput.value = "";
    pendingFile = null;
    progressText.innerText = "";
  } catch (err) {
    alert("Ошибка: " + err.message);
    progressText.innerText = "";
  }
}

// ---------- Логика Поиска и DM ----------

newChatBtn.addEventListener("click", () => {
    searchUserModal.style.display = "block";
    searchResults.innerHTML = "";
    searchNickname.value = "";
});

closeSearchModal.addEventListener("click", () => {
    searchUserModal.style.display = "none";
});

// Функция для поиска пользователя по нику
searchUserBtn.addEventListener("click", async () => {
    const nickname = searchNickname.value.trim();
    if (!nickname) return (searchResults.innerHTML = "Введите ник.");
    if (nickname === currentNick) return (searchResults.innerHTML = "Нельзя начать чат с самим собой.");

    searchResults.innerHTML = "Поиск...";
    
    // Ищем пользователя в коллекции 'users'
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("nickname", "==", nickname));

    try {
        const snap = await getDocs(q);
        searchResults.innerHTML = "";

        if (snap.empty) {
            searchResults.innerHTML = `Пользователь с ником "${nickname}" не найден.`;
            return;
        }

        snap.forEach((docSnap) => {
            const userData = docSnap.data();
            const targetUid = docSnap.id;

            const startChatBtn = document.createElement("button");
            startChatBtn.textContent = `Чат с ${userData.nickname}`;
            startChatBtn.className = "primary";
            startChatBtn.style.margin = "5px 0";

            startChatBtn.addEventListener("click", async () => {
                await findOrCreateChat(targetUid, userData.nickname);
                searchUserModal.style.display = "none";
            });

            searchResults.appendChild(startChatBtn);
        });
    } catch (e) {
        searchResults.innerHTML = "Ошибка поиска: " + e.message;
    }
});


// Функция: Найти существующий или создать новый DM
async function findOrCreateChat(targetUid, targetNick) {
    // Упорядоченный массив UID для унификации ID чата
    const participants = [currentUid, targetUid].sort(); 

    // Ищем существующий чат между этими двумя пользователями
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "==", participants));

    const snap = await getDocs(q);
    let chatId;

    if (!snap.empty) {
        // Чат найден
        chatId = snap.docs[0].id;
    } else {
        // Чат не найден, создаем новый
        const newChatRef = await addDoc(chatsRef, {
            participants: participants,
            participantsNicknames: {
                [currentUid]: currentNick,
                [targetUid]: targetNick,
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        chatId = newChatRef.id;
    }

    // Переключаемся на найденный/созданный чат
    switchChat(chatId, targetNick, targetUid);
}


// ---------- Логика Звонков (Концептуальная основа) ----------

callBtn.addEventListener("click", () => {
    if (currentChatTargetUid) {
        alert(`Звонок пользователю "${currentChatName.innerText}" (UID: ${currentChatTargetUid}) инициирован.\n\nПРИМЕЧАНИЕ: Для полноценной работы звонков требуется полная реализация WebRTC (RTCPeerConnection, обмен Offer/Answer/ICE) с использованием Firebase как сервера сигнализации. Эта кнопка пока выполняет только демонстрационную функцию.`);
        
        // --- Здесь должен быть код инициализации WebRTC ---
        // 1. Создание RTCPeerConnection и получение локального медиапотока.
        // 2. Создание Call Offer и запись его в коллекцию 'calls' в Firestore.
        // 3. Прослушивание Answer от собеседника и обмен ICE-кандидатами.
        // ---------------------------------------------------
        
    } else {
        alert("Ошибка: Не удалось найти собеседника для звонка.");
    }
});