import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  push,
  onChildAdded
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
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let chatRef = null;

/* SIGNUP */
window.signup = async () => {
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();

  if (!email || !password) return alert("Enter email & password");

  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert(err.message);
  }
};

/* LOGIN */
window.login = async () => {
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert(err.message);
  }
};

/* AUTH STATE */
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;

    chatRef = ref(db, `chats/${user.uid}`);

    document.getElementById("login").style.display = "none";
    document.getElementById("chat").style.display = "block";

    listenMessages();
  }
});

/* SEND */
window.sendMessage = () => {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (!text) return;

  push(chatRef, {
    user: currentUser.email,
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

  div.classList.add(msg.user === currentUser.email ? "user" : "admin");

  div.innerText = msg.text;

  const messages = document.getElementById("messages");
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}