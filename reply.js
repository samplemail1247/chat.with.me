import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  onChildAdded,
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ------------------ FIREBASE CONFIG ------------------ */
const firebaseConfig = {
  apiKey: "AIzaSyCar5tl_EGeRHhvQke8IJITDi_zAArlN8c",
  databaseURL: "https://chat-project-c5409-default-rtdb.asia-southeast1.firebasedatabase.app"
};

/* ------------------ INIT ------------------ */
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ------------------ STATE ------------------ */
let currentUser = "";
let currentChatRef = null;

/* ------------------ LOAD USERS ------------------ */
const usersRef = ref(db, "chats");

onValue(usersRef, (snapshot) => {
  const userList = document.getElementById("userList");
  userList.innerHTML = "";

  snapshot.forEach((child) => {
    const name = child.key;

    const div = document.createElement("div");
    div.classList.add("user-item");
    div.innerText = name;

    div.onclick = () => openChat(name);

    userList.appendChild(div);
  });
});

/* ------------------ OPEN CHAT ------------------ */
function openChat(user) {
  currentUser = user;

  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  // CLEAN OLD LISTENER
  if (currentChatRef) {
    off(currentChatRef);
  }

  currentChatRef = ref(db, `chats/${user}`);

  onChildAdded(currentChatRef, (snapshot) => {
    const msg = snapshot.val();
    renderMessage(msg);
  });
}

/* ------------------ SEND MESSAGE ------------------ */
window.sendMessage = () => {
  if (!currentUser) {
    alert("Select a user!");
    return;
  }

  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (!text) return;

  push(ref(db, `chats/${currentUser}`), {
    user: "ADMIN",
    text,
    time: Date.now()
  });

  input.value = "";
};

/* ------------------ RENDER ------------------ */
function renderMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("message");

  div.classList.add(msg.user === "ADMIN" ? "user" : "admin");
  div.innerText = msg.text;

  const messages = document.getElementById("messages");
  messages.appendChild(div);

  messages.scrollTop = messages.scrollHeight;
}
