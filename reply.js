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
  projectId: "chat-project-c5409"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const chatRef = ref(db, "globalChat");

// Send as admin
window.sendMessage = function () {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) return;

  push(chatRef, {
    user: "ADMIN",
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

  if (msg.user === "ADMIN") {
    div.classList.add("admin");
  }

  div.innerText = `${msg.user}: ${msg.text}`;

  const messages = document.getElementById("messages");
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});
