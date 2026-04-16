import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  onChildAdded,
  off,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyCar5tl_EGeRHhvQke8IJITDi_zAArlN8c",
  databaseURL: "https://chat-project-c5409-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = "";
let currentRef = null;

/* TOGGLE USERS (MOBILE) */
window.toggleUsers = () => {
  document.getElementById("userList").classList.toggle("active");
};

/* LOAD USERS (SORTED) */
const usersRef = ref(db, "chats");

onValue(usersRef, (snapshot) => {
  const userList = document.getElementById("userList");
  userList.innerHTML = "";

  const users = [];

  snapshot.forEach((child) => {
    let lastTime = 0;

    child.forEach(msg => {
      lastTime = Math.max(lastTime, msg.val().time || 0);
    });

    users.push({ name: child.key, lastTime });
  });

  users.sort((a, b) => b.lastTime - a.lastTime);

  users.forEach(({ name }) => {
    userList.appendChild(createUserItem(name));
  });
});

/* CREATE USER ITEM WITH DELETE */
function createUserItem(name) {
  const div = document.createElement("div");
  div.classList.add("user-item");

  const span = document.createElement("span");
  span.innerText = name;
  span.onclick = () => openChat(name);

  const del = document.createElement("button");
  del.innerText = "✕";
  del.classList.add("delete-btn");

  del.onclick = (e) => {
    e.stopPropagation();
    deleteUser(name);
  };

  div.appendChild(span);
  div.appendChild(del);

  return div;
}

/* OPEN CHAT */
function openChat(user) {
  currentUser = user;

  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  if (currentRef) off(currentRef);

  currentRef = ref(db, `chats/${user}`);

  onChildAdded(currentRef, (snapshot) => {
    renderMessage(snapshot.val());
  });

  // close menu on mobile after click
  document.getElementById("userList").classList.remove("active");
}

/* SEND */
window.sendMessage = () => {
  if (!currentUser) return alert("Select a user!");

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

/* DELETE USER */
function deleteUser(name) {
  if (!confirm(`Delete ${name}?`)) return;

  remove(ref(db, `chats/${name}`));
}

/* RENDER */
function renderMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(msg.user === "ADMIN" ? "user" : "admin");

  div.innerText = msg.text;

  const messages = document.getElementById("messages");
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}
