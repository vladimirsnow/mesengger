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
const nickIn = document.getElementById("nickname");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const welcome = document.getElementById("welcome");
const messagesDiv = document.getElementById("messages");
const msgInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const fileInput = document.getElementById("fileInput");
const progressText = document.getElementById("progress");

let currentNick = "";
let currentUid = null;
let pendingFile = null;

registerBtn.addEventListener("click", async () => {
    const email = emailIn.value.trim();
    const password = passIn.value;
    const nickname = nickIn.value.trim();
    if (!email || !password || !nickname) return alert("Заполни email, пароль и ник.");
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;
        await setDoc(doc(db, "users", uid), { nickname, email });
        alert("Регистрация успешна. Теперь войди.");
    } catch (e) {
        alert(e.message);
    }
});

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
        currentNick = udoc.exists() ? udoc.data().nickname || user.email : user.email;
        welcome.innerText = "Привет, " + currentNick;
        authDiv.style.display = "none";
        chatDiv.style.display = "block";
        startMessagesListener();
    } else {
        currentNick = "";
        currentUid = null;
        authDiv.style.display = "block";
        chatDiv.style.display = "none";
        messagesDiv.innerHTML = "";
        stopMessagesListener();
    }
});

let unsubscribe = null;
function startMessagesListener() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    unsubscribe = onSnapshot(q, (snap) => {
        messagesDiv.innerHTML = "";
        snap.forEach((docSnap) => {
            const m = docSnap.data();
            renderMessage(m);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

function stopMessagesListener() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
}

function renderMessage(msg) {
    const el = document.createElement("div");
    el.className = "msg";
    const meta = document.createElement("div");
    meta.className = "meta";
    const timeStr = msg.timestamp && msg.timestamp.toDate ? new Date(msg.timestamp.toDate()).toLocaleString() : "";
    meta.textContent = (msg.sender || "Anon") + (timeStr ? " • " + timeStr : "");
    el.appendChild(meta);

    if (msg.fileUrl) {
        const url = msg.fileUrl;
        const type = msg.fileType || "";
        if (type.startsWith("image/") || url.match(/\.(jpe?g|png|gif|webp)(\?|$)/i)) {
            const i = document.createElement("img");
            i.src = url;
            i.alt = msg.fileName || "image";
            el.appendChild(i);
        } else if (type.startsWith("video/") || url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
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

msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendBtn.click();
    }
});

sendBtn.addEventListener("click", async () => {
    const text = msgInput.value.trim();
    try {
        let fileUrl = null;
        let fileType = null;
        let fileName = null;
        if (pendingFile) {
            progressText.innerText = "Загружаю файл...";
            const fd = new FormData();
            fd.append("file", pendingFile);
            fd.append("upload_preset", uploadPreset);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
                method: "POST",
                body: fd,
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error("Cloudinary upload failed: " + errText);
            }

            const data = await res.json();
            fileUrl = data.secure_url;
            fileType = pendingFile.type || (data.resource_type === "image" ? "image/*" : "");
            fileName = pendingFile.name || (data.public_id || "").split("/").pop();
            progressText.innerText = "Файл загружен";
        }
        await addDoc(collection(db, "messages"), {
            text: text || "",
            sender: currentNick || "Anon",
            fileUrl: fileUrl || null,
            fileType: fileType || null,
            fileName: fileName || null,
            timestamp: serverTimestamp(),
        });
        msgInput.value = "";
        fileInput.value = "";
        pendingFile = null;
        progressText.innerText = "";
    } catch (err) {
        alert("Ошибка: " + err.message);
        progressText.innerText = "";
    }
});