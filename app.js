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
  where,
  getDocs,
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
const nicknameIn = document.getElementById("nickname");
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

// Элементы для создания чата/группы
const newChatBtn = document.getElementById("newChatBtn");
const searchUserModal = document.getElementById("searchUserModal");
const closeSearchModal = document.getElementById("closeSearchModal");
const searchNickname = document.getElementById("searchNickname");
const searchUserBtn = document.getElementById("searchUserBtn");
const searchResults = document.getElementById("searchResults");
const groupNameInput = document.getElementById("groupNameInput");
const groupNameLabel = document.getElementById("groupNameLabel");
const groupParticipantsDisplay = document.getElementById("groupParticipantsDisplay");
const currentNickDisplay = document.getElementById("currentNickDisplay");
const finalizeChatBtn = document.getElementById("finalizeChatBtn");


let currentNick = "";
let currentUid = null;
let pendingFile = null;

let currentChatId = "global";
let currentChatTargetUid = null; // UID собеседника для DM

// Состояние для создания группы/чата
let pendingGroupParticipants = {}; // {uid: nickname, ...}


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
    
    currentNick = udoc.exists()
      ? udoc.data().nickname || user.email
      : user.email;
      
    welcome.innerText = "Привет, " + currentNick;
    currentNickDisplay.innerText = currentNick; // Обновляем ник в модальном окне
    authDiv.style.display = "none";
    chatDiv.style.display = "flex";
    
    switchChat("global", "Общий чат"); 
    startChatsListener();

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

registerBtn.addEventListener("click", async () => {
  const email = emailIn.value.trim();
  const password = passIn.value;
  const nickname = nicknameIn.value.trim();

  if (!email || !password || !nickname) {
    return alert("Заполни email, пароль и ник!");
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

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

function startMessagesListener(chatId) {
  stopMessagesListener(); 

  const collectionPath = chatId === "global"
    ? "messages" 
    : `chats/${chatId}/messages`; 

  const q = query(collection(db, collectionPath), orderBy("timestamp", "asc"));
  unsubscribeMessages = onSnapshot(q, (snap) => {
    messagesDiv.innerHTML = "";
    snap.forEach((docSnap) => {
      const m = docSnap.data();
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

// ФУНКЦИЯ ПРОСЛУШИВАНИЯ СПИСКА ЧАТОВ (DM и ГРУПП)
function startChatsListener() {
  if (!currentUid) return;
  // Запрос: найти все чаты, где текущий UID есть в массиве участников
  const q = query(
    collection(db, "chats"),
    where("participants", "array-contains", currentUid),
    orderBy("updatedAt", "desc") 
  );

  unsubscribeChats = onSnapshot(q, (snap) => {
    // Удаляем только DM и группы (элементы с классом .dm-item)
    chatList.querySelectorAll(".dm-item").forEach(el => el.remove()); 
    
    snap.forEach((docSnap) => {
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

// ПЕРЕКЛЮЧЕНИЕ АКТИВНОГО ЧАТА (Обновлено для групп)
function switchChat(newChatId, chatName, targetUid = null) {
  
  document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
  
  const newActiveElement = document.querySelector(`[data-chat-id="${newChatId}"]`);
  if (newActiveElement) {
    newActiveElement.classList.add("active");
  }

  currentChatId = newChatId;
  currentChatTargetUid = targetUid; 
  currentChatName.innerText = chatName;

  startMessagesListener(currentChatId);

  // Кнопка звонка видна только для 1:1 чатов (когда targetUid не null)
  callBtn.style.display = targetUid ? "inline-block" : "none";
}

// РЕНДЕР ЭЛЕМЕНТА В СПИСКЕ ЧАТОВ (Обновлено для групп)
function renderChatItem(chatId, chatData) {
    let chatName;
    let targetUid = null;
    
    if (chatData.type === 'group') {
        // Для группы используем заданное имя
        chatName = `[ГР] ${chatData.name || 'Групповой чат'}`;
    } else {
        // Для DM (private) используем имя собеседника
        // У DM-чатов массив participants всегда отсортирован
        const otherUid = chatData.participants.find(uid => uid !== currentUid);
        chatName = chatData.participantsNicknames[otherUid] || "Личный чат"; 
        targetUid = otherUid;
    }

    const el = document.createElement("div");
    el.className = "chat-item dm-item";
    el.setAttribute("data-chat-id", chatId);
    el.textContent = chatName;
    el.addEventListener("click", () => switchChat(chatId, chatName, targetUid));
    chatList.appendChild(el);
}

globalChatLink.addEventListener("click", () => switchChat("global", "Общий чат"));


function renderMessage(msg) {
  const el = document.createElement("div");
  el.className = "msg";
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

// ОБНОВЛЕННАЯ ФУНКЦИЯ ОТПРАВКИ СООБЩЕНИЯ
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
        uid: currentUid, 
        fileUrl: fileUrl || null,
        fileType: fileType || null,
        fileName: fileName || null,
        timestamp: serverTimestamp(),
    };

    if (currentChatId === "global") {
      await addDoc(collection(db, "messages"), messageData);
    } else {
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

// ---------- ЛОГИКА СОЗДАНИЯ DM/ГРУППЫ ----------

// Инициализация модального окна
newChatBtn.addEventListener("click", () => {
    searchUserModal.style.display = "block";
    searchResults.innerHTML = "";
    searchNickname.value = "";
    groupNameInput.value = "";
    
    // Сброс и установка текущего пользователя в качестве первого участника
    pendingGroupParticipants = { [currentUid]: currentNick }; 
    updatePendingParticipantsDisplay();
    
    groupNameInput.style.display = "none";
    groupNameLabel.style.display = "none";
});

closeSearchModal.addEventListener("click", () => {
    searchUserModal.style.display = "none";
});

// Обновление списка участников в модальном окне
function updatePendingParticipantsDisplay() {
    const nicknames = Object.values(pendingGroupParticipants);
    // Фильтруем ник текущего пользователя для отображения
    const otherNicks = nicknames.filter(nick => nick !== currentNick);
    
    let display = `Вы`;
    if (otherNicks.length > 0) {
        display += `, ${otherNicks.join(', ')}`;
    }
    
    groupParticipantsDisplay.innerHTML = `Участники: <span style="font-weight: bold;">${display}</span>`;
    
    // Показываем поля для имени группы, если участников > 2
    if (Object.keys(pendingGroupParticipants).length > 2) {
        groupNameInput.style.display = "block";
        groupNameLabel.style.display = "block";
    } else {
        groupNameInput.style.display = "none";
        groupNameLabel.style.display = "none";
        groupNameInput.value = ""; // Очищаем имя группы для DM
    }
}


// Обновленная функция поиска (теперь для добавления в группу/чат)
searchUserBtn.addEventListener("click", async () => {
    const nickname = searchNickname.value.trim();
    if (!nickname) return (searchResults.innerHTML = "Введите ник.");
    if (nickname === currentNick) return (searchResults.innerHTML = "Вы уже в чате.");
    if (Object.values(pendingGroupParticipants).includes(nickname)) {
        return (searchResults.innerHTML = `Пользователь "${nickname}" уже добавлен.`);
    }

    searchResults.innerHTML = "Поиск...";
    
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

            const addBtn = document.createElement("button");
            addBtn.textContent = `Добавить ${userData.nickname}`;
            addBtn.className = "primary";
            addBtn.style.margin = "5px 0";
            addBtn.style.backgroundColor = "var(--success-color)"; // Новый цвет для кнопки добавления

            addBtn.addEventListener("click", () => {
                pendingGroupParticipants[targetUid] = userData.nickname;
                updatePendingParticipantsDisplay();
                searchResults.innerHTML = `<span style="color: var(--success-color); font-weight: bold;">${userData.nickname} добавлен!</span>`;
                searchNickname.value = "";
            });

            searchResults.appendChild(addBtn);
        });
    } catch (e) {
        searchResults.innerHTML = "Ошибка поиска: " + e.message;
    }
});


// ФИНАЛИЗАЦИЯ СОЗДАНИЯ ЧАТА (DM или ГРУППА)
finalizeChatBtn.addEventListener("click", async () => {
    const participantUids = Object.keys(pendingGroupParticipants);
    const participantNicks = pendingGroupParticipants;
    const isGroup = participantUids.length > 2;
    let chatName = "";
    
    if (participantUids.length < 2) {
        return alert("Выберите хотя бы одного собеседника.");
    }
    
    if (isGroup) {
        chatName = groupNameInput.value.trim();
        if (!chatName) return alert("Введите название для группового чата.");
    }

    // --- ИСПРАВЛЕНИЕ: Гарантируем, что массив DM всегда отсортирован ---
    let finalParticipantsArray;
    if (isGroup) {
        finalParticipantsArray = participantUids; // Unsorted array for groups
    } else {
        // Для DM, массив должен быть отсортирован для надежной проверки дубликатов
        finalParticipantsArray = participantUids.sort(); 
    }
    // ------------------------------------------------------------------

    // 1. Ищем существующий чат (только для DM)
    let chatId = null;
    if (!isGroup) {
        const chatsRef = collection(db, "chats");
        // Используем отсортированный массив для поиска существующего DM
        const q = query(chatsRef, where("participants", "==", finalParticipantsArray));
        const snap = await getDocs(q);
        if (!snap.empty) {
            chatId = snap.docs[0].id;
        }
    }

    if (!chatId) {
        // 2. Создаем новый чат
        const newChatData = {
            type: isGroup ? "group" : "private",
            name: isGroup ? chatName : null, 
            participants: finalParticipantsArray, // <-- ИСПОЛЬЗУЕМ ОТСОРТИРОВАННЫЙ МАССИВ ДЛЯ DM
            participantsNicknames: participantNicks,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const newChatRef = await addDoc(collection(db, "chats"), newChatData);
        chatId = newChatRef.id;
    }

    // 3. Определяем имя для отображения в заголовке
    let displayChatName;
    let targetUid = null;

    if (isGroup) {
        displayChatName = `[ГР] ${chatName}`;
    } else {
        // Для DM: имя собеседника
        targetUid = participantUids.find(uid => uid !== currentUid);
        displayChatName = participantNicks[targetUid] || "Личный чат";
    }

    // 4. Переключаемся на чат
    searchUserModal.style.display = "none";
    switchChat(chatId, displayChatName, targetUid);
});


// ---------- ЛОГИКА ЗВОНКОВ (Без изменений) ----------

callBtn.addEventListener("click", () => {
    if (currentChatTargetUid) {
        alert(`Звонок пользователю "${currentChatName.innerText}" (UID: ${currentChatTargetUid}) инициирован.\n\nПРИМЕЧАНИЕ: Для полноценной работы звонков требуется полная реализация WebRTC (RTCPeerConnection, обмен Offer/Answer/ICE) с использованием Firebase как сервера сигнализации. Эта кнопка пока выполняет только демонстрационную функцию.`);
        
    } else {
        alert("Ошибка: Не удалось найти собеседника для звонка. Звонки доступны только в личных (1:1) чатах.");
    }
});