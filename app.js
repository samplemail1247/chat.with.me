import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

const chatRef = ref(db, "globalChat");

let username = "";

// Join chat
window.joinChat = function () {
  username = document.getElementById("usernameInput").value.trim();
  if (!username) return alert("Enter your name!");

  document.getElementById("login").style.display = "none";
  document.getElementById("chat").style.display = "block";
};

// Send message
window.sendMessage = function () {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) return;

  push(chatRef, {
    user: username,
    text: text,
    time: Date.now()
  });

  input.value = "";
};

// Receive messages
onChildAdded(chatRef, (snapshot) => {
  const msg = snapshot.val();

  const div = document.createElement("div");
  div.classList.add("message");
  div.innerText = `${msg.user}: ${msg.text}`;

  const messages = document.getElementById("messages");
  messages.appendChild(div);

  // Auto scroll
  messages.scrollTop = messages.scrollHeight;
});
