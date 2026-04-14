import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  get,
  child
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyCar5tl_EGeRHhvQke8IJITDi_zAArlN8c",
  authDomain: "chat-project-c5409.firebaseapp.com",
  databaseURL: "https://chat-project-c5409-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-project-c5409",
  storageBucket: "chat-project-c5409.firebasestorage.app",
  messagingSenderId: "81449624717",
  appId: "1:81449624717:web:86057269fd96be331aaec4"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let username = "";
let chatRef = null;

/* JOIN CHAT WITH DUPLICATE CHECK */
window.joinChat = async () => {
  const input = document.getElementById("usernameInput");
  username = input.value.trim();

  if (!username) {
    alert("Enter name!");
    return;
  }

  const snapshot = await get(child(ref(db), `chats/${username}`));

  if (snapshot.exists()) {
    alert("Username already taken. Try another.");
    return;
  }

  chatRef = ref(db, `chats/${username}`);

  document.getElementById("login").style.display = "none";
  document.getElementById("chat").style.display = "block";

  listenMessages();
};

/* SEND MESSAGE */
window.sendMessage = () => {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (!text) return;

  push(chatRef, {
    user: username,
    text,
    time: Date.now()
  });

  input.value = "";
};

/* LISTEN */
function listenMessages() {
  onChildAdded(chatRef, (snapshot) => {
    renderMessage(snapshot.val());
  });
}

/* RENDER */
function renderMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(msg.user === username ? "user" : "admin");

  div.innerText = msg.text;

  const messages = document.getElementById("messages");
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}
