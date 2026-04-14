import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCar5tl_EGeRHhvQke8IJITDi_zAArlN8c",
  databaseURL: "https://chat-project-c5409-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = "";
let chatRef = null;

// Load users list
const usersRef = ref(db, "chats");

onValue(usersRef, (snapshot) => {
  const userList = document.getElementById("userList");
  userList.innerHTML = "";

  snapshot.forEach((child) => {
    const username = child.key;

    const div = document.createElement("div");
    div.innerText = username;
    div.classList.add("user-item");

    div.onclick = () => openChat(username);

    userList.appendChild(div);
  });
});

// Open selected chat
function openChat(user) {
  currentUser = user;
  chatRef = ref(db, "chats/" + user);

  document.getElementById("messages").innerHTML = "";

  onChildAdded(chatRef, (snapshot) => {
    const msg = snapshot.val();

    const div = document.createElement("div");
    div.classList.add("message");

    if (msg.user === "ADMIN") {
      div.style.textAlign = "right";
      div.style.color = "#38bdf8";
    }

    div.innerText = msg.text;

    const messages = document.getElementById("messages");
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  });
}

// Send reply
window.sendMessage = function () {
  if (!chatRef) return alert("Select a user!");

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
