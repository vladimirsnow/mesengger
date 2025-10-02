document.addEventListener("DOMContentLoaded", () => {
// ---------- Конфиг Firebase ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

// Импорт всех функций Firestore
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
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Импорт всех функций Authentication
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
  projectId: "messenger-3f86f", // Проверяем наличие projectId
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

// ИСПРАВЛЕНИЕ ОШИБКИ 2: Использован правильный ID для поля ввода поиска
const searchNicknameInput = document.getElementById("userSearchInput"); 
const searchUserBtn = document.getElementById("searchUserBtn");
const searchResults = document.getElementById("searchResults");
const groupNameInput = document.getElementById("groupNameInput");
const groupNameLabel = document.getElementById("groupNameLabel");
const groupParticipantsDisplay = document.getElementById("groupParticipantsDisplay");
const currentNickDisplay = document.getElementById("currentNickDisplay");
const finalizeChatBtn = document.getElementById("finalizeChatBtn");

// Элементы для АДАПТИВНОГО МЕНЮ (ИСПРАВЛЕНИЕ ОШИБКИ 1: Добавлены отсутствующие элементы)
const menuToggleBtn = document.getElementById("menuToggleBtn");
const chatSidebar = document.getElementById("chatSidebar");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");


// --- Элементы для Звонков WebRTC ---
const callModal = document.getElementById("callModal");
const callStatus = document.getElementById("callStatus");
const remoteVideo = document.getElementById("remoteVideo");
const localVideo = document.getElementById("localVideo");
const answerCallBtn = document.getElementById("answerCallBtn");
const hangupCallBtn = document.getElementById("hangupCallBtn");
const callMessage = document.getElementById("callMessage");


// --- Глобальные Переменные ---
let peerConnection = null;
let unsubscribeCallListener = null;
let unsubscribeCandidateListener = null; // Для слушателей кандидатов
let localStream = null;
let remoteStream = null;
let currentCallId = null; 
let callOffer = null; // Для хранения данных входящего звонка

let currentNick = "";
let currentUid = null;
let pendingFile = null;

let currentChatId = "global";
let currentChatTargetUid = null; 

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

// ИЗМЕНЕНИЕ: Убеждаемся, что все инициализировано перед запуском слушателей
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUid = user.uid;
    const udoc = await getDoc(doc(db, "users", user.uid));
    
    currentNick = udoc.exists()
      ? udoc.data().nickname || user.email
      : user.email;
      
    welcome.innerText = "Привет, " + currentNick;
    currentNickDisplay.innerText = currentNick; 
    authDiv.style.display = "none";
    chatDiv.style.display = "flex";
    
    // Сначала переключаем, потом начинаем слушать чаты
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

function startChatsListener() {
  if (!currentUid) {
      console.log("startChatsListener: currentUid не установлен. Прерываю.");
      return;
  }

  const q = query(
    collection(db, "chats"),
    where("participants", "array-contains", currentUid),
    orderBy("updatedAt", "desc") 
  );

  console.log("startChatsListener: Подписка на список чатов активна для UID:", currentUid);

  unsubscribeChats = onSnapshot(q, (snap) => {
    // Удаляем все элементы, добавленные через renderChatItem (они имеют класс .dm-item)
    chatList.querySelectorAll(".dm-item").forEach(el => el.remove()); 
    
    let count = 0;
    snap.forEach((docSnap) => {
      if (docSnap.id === "global") return; 
      renderChatItem(docSnap.id, docSnap.data());
      count++;
    });
    console.log(`startChatsListener: Получено и отрисовано ${count} DM/групповых чатов.`);
  }, (error) => {
      console.error("startChatsListener: Ошибка Firestore:", error);
      alert("Не удалось загрузить список чатов. Проверьте консоль разработчика (F12)!");
  });
}

function stopChatsListener() {
  if (unsubscribeChats) {
    unsubscribeChats();
    unsubscribeChats = null;
  }
}

// ПЕРЕКЛЮЧЕНИЕ АКТИВНОГО ЧАТА
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

// РЕНДЕР ЭЛЕМЕНТА В СПИСКЕ ЧАТОВ
function renderChatItem(chatId, chatData) {
    let chatName;
    let targetUid = null;
    
    if (chatData.type === 'group') {
        chatName = `[ГР] ${chatData.name || 'Групповой чат'}`;
    } else {
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
      
      // Обновляем метку времени чата
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
    searchNicknameInput.value = ""; // ИСПРАВЛЕНО
    groupNameInput.value = "";
    
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
    const otherNicks = nicknames.filter(nick => nick !== currentNick);
    
    let display = `Вы`;
    if (otherNicks.length > 0) {
        display += `, ${otherNicks.join(', ')}`;
    }
    
    groupParticipantsDisplay.innerHTML = `Участники: <span style="font-weight: bold;">${display}</span>`;
    
    if (Object.keys(pendingGroupParticipants).length > 2) {
        groupNameInput.style.display = "block";
        groupNameLabel.style.display = "block";
    } else {
        groupNameInput.style.display = "none";
        groupNameLabel.style.display = "none";
        groupNameInput.value = "";
    }
}

// Обновленная функция поиска (теперь для добавления в группу/чат)
searchUserBtn.addEventListener("click", async () => {
    const nickname = searchNicknameInput.value.trim(); // ИСПРАВЛЕНО
    
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
            addBtn.style.backgroundColor = "var(--success-color)"; 

            addBtn.addEventListener("click", () => {
                pendingGroupParticipants[targetUid] = userData.nickname;
                updatePendingParticipantsDisplay();
                searchResults.innerHTML = `<span style="color: var(--success-color); font-weight: bold;">${userData.nickname} добавлен!</span>`;
                searchNicknameInput.value = ""; // ИСПРАВЛЕНИЕ: Теперь searchNicknameInput существует
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

    // Логика сортировки для DM
    let finalParticipantsArray;
    if (isGroup) {
        finalParticipantsArray = participantUids;
    } else {
        // Для DM массив должен быть отсортирован
        finalParticipantsArray = participantUids.sort(); 
    }

    // 1. Ищем существующий чат (только для DM)
    let chatId = null;
    if (!isGroup) {
        const chatsRef = collection(db, "chats");
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
            participants: finalParticipantsArray, 
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
        displayChatName = `${chatName}`;
    } else {
        targetUid = participantUids.find(uid => uid !== currentUid);
        displayChatName = participantNicks[targetUid] || "Личный чат";
    }

    // 4. Переключаемся на чат
    searchUserModal.style.display = "none";
    switchChat(chatId, displayChatName, targetUid);
});


// ----------------------------------------------------
// ---------- ЛОГИКА АДАПТИВНОГО МЕНЮ ЧАТОВ (ИСПРАВЛЕНА) ----------
// ----------------------------------------------------

// 1. Открытие/закрытие боковой панели чатов на мобильных устройствах
menuToggleBtn.addEventListener("click", () => {
    chatSidebar.classList.add("active");
});

closeSidebarBtn.addEventListener("click", () => {
    chatSidebar.classList.remove("active");
});

// 2. Добавление обработчика для глобального чата
globalChatLink.addEventListener("click", () => {
    switchChat("global", "Общий чат");
    
    // Закрываем сайдбар после выбора чата на мобильных
    if (window.innerWidth <= 768) {
        chatSidebar.classList.remove("active");
    }
});

// 3. Закрытие сайдбара при выборе DM/Группового чата
chatList.addEventListener("click", (e) => {
    // Проверяем, что кликнули именно на элемент DM/Группового чата (dm-item)
    if (e.target.classList.contains('dm-item')) {
        // Логика переключения чата уже внутри renderChatItem. Нужно только закрыть сайдбар
        if (window.innerWidth <= 768) {
            chatSidebar.classList.remove("active");
        }
    }
});


// --------------------------------------------
// --- ЛОГИКА ЗВОНКОВ (WebRTC/FIREBASE) ---
// --------------------------------------------

const callsRef = collection(db, 'calls');

/**
 * 1. Получает доступ к камере/микрофону и отображает локальное видео.
 */
async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        callMessage.innerText = 'Потоки получены. Готов к соединению.';
        return true;
    } catch (e) {
        alert("Не удалось получить доступ к камере или микрофону. Проверьте разрешения.");
        console.error("Ошибка при получении медиапотоков:", e);
        callStatus.innerText = 'Ошибка медиапотоков';
        callMessage.innerText = 'Доступ к камере/микрофону запрещен.';
        return false;
    }
}

function setupPeerConnection(isCaller) {
    peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ]
    });

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        if (remoteStream) return;
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
        callStatus.innerText = 'Соединение установлено';
        callMessage.innerText = 'Разговор начался!';
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            const candidate = event.candidate.toJSON();
            
            const candidateCollectionName = isCaller ? 'callerCandidates' : 'calleeCandidates';
            
            if (currentCallId) { 
                 const candidateRef = collection(db, `calls/${currentCallId}/${candidateCollectionName}`);
                 addDoc(candidateRef, candidate);
            }
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log("Состояние соединения:", peerConnection.connectionState);
        callMessage.innerText = `Состояние соединения: ${peerConnection.connectionState}`;
        if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
            if (callModal.style.display !== 'none') {
                endCall(false, 'Соединение разорвано.');
            }
        }
    };
}
/**
 * 3. ИНИЦИАТОР: Запускает звонок.
 */
callBtn.addEventListener("click", async () => {
    if (!(await startLocalStream())) return;

    callModal.style.display = 'flex'; 
    callStatus.innerText = `Звонок пользователю ${currentChatName.innerText}...`;
    answerCallBtn.style.display = 'none';
    
    try {
        const callDoc = await addDoc(callsRef, {
            callerUid: currentUid,
            calleeUid: currentChatTargetUid,
            offer: null, 
            status: 'ringing',
            createdAt: serverTimestamp()
        });
        currentCallId = callDoc.id;
        callMessage.innerText = 'Ожидаем ответа собеседника...';
        
        setupPeerConnection(true);

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        await updateDoc(doc(callsRef, currentCallId), {
            offer: {
                sdp: offer.sdp,
                type: offer.type,
            }
        });

        // Слушаем кандидатов от Callee
        unsubscribeCandidateListener = listenForCandidates('callee');

        // Слушаем ответ (Answer) от собеседника и его статус
        unsubscribeCallListener = onSnapshot(doc(callsRef, currentCallId), (docSnap) => {
            const data = docSnap.data();

            if (!peerConnection) {
                // Если мы завершили звонок локально (через endCall), нам больше не нужен этот слушатель.
                if (unsubscribeCandidateListener) {
                    unsubscribeCandidateListener();
                }
                return;
            }

            if (data && data.answer && !peerConnection.currentRemoteDescription) {
                console.log("Получен Answer:", data.answer);
                peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
            
            if (data && data.status === 'accepted') {
                callStatus.innerText = `Соединение...`;
            }
            
            if (data && data.status === 'rejected') {
                endCall(true, `${currentChatName.innerText} отклонил звонок.`);
            }
            
            if (data && data.status === 'ended') {
                endCall(false, "Собеседник завершил звонок.");
            }
        }); 
        
    } catch (e) { 
        console.error("Ошибка при инициации звонка:", e);
        endCall(false, "Не удалось начать звонок.");
    }
});
/**
 * 4. ВЫЗЫВАЕМЫЙ (CALLEE): Слушает входящие звонки.
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ... (инициализация пользователя) ...

        // Слушаем входящие звонки
        onSnapshot(query(callsRef, where('calleeUid', '==', user.uid), where('status', '==', 'ringing')), (snapshot) => {
            if (snapshot.docs.length > 0 && !currentCallId) {
                const incomingCallDoc = snapshot.docs[0];
                callOffer = {
                    ...incomingCallDoc.data(),
                    id: incomingCallDoc.id
                };
                currentCallId = callOffer.id;

                // Показываем модальное окно и кнопку "Принять"
                callModal.style.display = 'flex';
                callStatus.innerText = `Входящий звонок от ${callOffer.callerUid} (ник пока неизвестен)`; 
                answerCallBtn.style.display = 'inline-block';
                hangupCallBtn.textContent = 'Отклонить';
                callMessage.innerText = 'Нажмите "Ответить"';
            }
        });
    }
});


/**
 * 5. ВЫЗЫВАЕМЫЙ (CALLEE): Принимает звонок.
 */
answerCallBtn.addEventListener('click', async () => {
     if (!(await startLocalStream())) return;
    
    callStatus.innerText = `Подключение...`;
    answerCallBtn.style.display = 'none';
    hangupCallBtn.textContent = 'Завершить';


    setupPeerConnection(false);

    try {
        // Устанавливаем Offer, полученный от вызывающего
        await peerConnection.setRemoteDescription(new RTCSessionDescription(callOffer.offer));
        
        // Создаем Answer (Ответ)
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Обновляем документ звонка с Answer и статусом
        const callDocRef = doc(callsRef, currentCallId);
        await setDoc(callDocRef, {
            answer: {
                sdp: answer.sdp,
                type: answer.type
            },
            status: 'accepted'
        }, { merge: true }); 
        callStatus.innerText = 'Соединение устанавливается...';

        // Слушаем кандидатов от Caller
        unsubscribeCandidateListener = listenForCandidates('caller'); 

        // ИСПРАВЛЕНИЕ: Добавляем слушатель для отслеживания состояния вызова (для обработки hangup от вызывающего)
        unsubscribeCallListener = onSnapshot(callDocRef, (docSnap) => {
            const data = docSnap.data();
            if (data && data.status === 'ended') {
                endCall(false, "Собеседник завершил звонок."); // Сообщение, что собеседник завершил
            }
        }); 

    } catch (e) {
        console.error("Ошибка при приеме звонка:", e);
        endCall(true, "Не удалось принять звонок.");
    }
});
/**
 * 6. Общая функция для прослушивания ICE-кандидатов.
 */
function listenForCandidates(type) {
    const candidateCollectionName = (type === 'caller' ? 'callerCandidates' : 'calleeCandidates');
    const candidatesRef = collection(db, `calls/${currentCallId}/${candidateCollectionName}`);
    
    // Возвращаем функцию отписки
    return onSnapshot(candidatesRef, (snapshot) => { 
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added' && peerConnection) {
                const candidate = change.doc.data();
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log(`ICE-кандидат (${type}) успешно добавлен.`);
                } catch (e) {
                    console.error("Ошибка при добавлении ICE-кандидата:", e);
                }
            }
        });
    });
}

/**
 * 7. Завершает звонок.
 */
hangupCallBtn.addEventListener('click', async () => {
    // Если это входящий, который мы не приняли, это "отклонить"
    if (callOffer && callOffer.status === 'ringing') {
        try {
            const callDocRef = doc(callsRef, currentCallId);
            await setDoc(callDocRef, { status: 'rejected' }, { merge: true });
        } catch (e) {
             console.warn("Не удалось обновить статус звонка в Firestore:", e);
        }
        endCall(false, "Вы отклонили звонок.");
    } else {
        // Если звонок активен или инициатором был я
        await endCall(true, "Вы завершили звонок.");
    }
});

async function endCall(updateStatus, message) {
    // 1. Закрываем WebRTC
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // 2. Останавливаем локальные потоки
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // 3. Сброс видеоэлементов
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    remoteStream = null;

    // 4. Обновляем статус в Firestore
    if (updateStatus && currentCallId) {
        try {
            const callDocRef = doc(callsRef, currentCallId);
            await setDoc(callDocRef, { status: 'ended' }, { merge: true });
        } catch (e) {
             console.warn("Не удалось обновить статус звонка в Firestore:", e);
        }
    }
    
    // 5. Очищаем все слушатели
     if (unsubscribeCallListener) {
        unsubscribeCallListener();
        unsubscribeCallListener = null;
    }
     if (unsubscribeCandidateListener) {
        unsubscribeCandidateListener();
        unsubscribeCandidateListener = null;
    }

    currentCallId = null;
    callOffer = null;

    // 6. Скрываем модальное окно и показываем сообщение
    alert(message || "Звонок завершен.");
    callModal.style.display = 'none';
    callStatus.innerText = 'Ожидание звонка...';
    callMessage.innerText = '';
    
    // Возвращаем кнопку "Ответить" в исходное состояние
    answerCallBtn.style.display = 'none';
    hangupCallBtn.textContent = 'Завершить';
}

});