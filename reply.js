// 🔒 Prevent double init
if (window.__adminInit) throw new Error("Already initialized");
window.__adminInit = true;

// 🔗 SUPABASE
const SUPABASE_URL = "https://kymifcsiobnukgkreckd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bWlmY3Npb2JudWtna3JlY2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTQ1NjgsImV4cCI6MjA5MTg5MDU2OH0.UVLwpoHjo8X9ansWXrQhWyzEDuhhKJ4jvZdItbfW6ok"; // same as user page

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ⚠️ SET YOUR ADMIN EMAIL HERE
const ADMIN_EMAIL = "admin@example.com";

// 📦 STATE
let state = {
  admin: null,
  users: [],
  activeUser: null,
  messages: [],
  channel: null,
};

// 🎯 ELEMENTS
const el = {
  authPanel: document.getElementById("adminAuthPanel"),
  layout: document.getElementById("adminLayout"),
  authForm: document.getElementById("adminAuthForm"),
  email: document.getElementById("adminEmail"),
  password: document.getElementById("adminPassword"),
  status: document.getElementById("adminAuthStatus"),

  userList: document.getElementById("userList"),
  activeUserTitle: document.getElementById("activeUserTitle"),
  messages: document.getElementById("adminMessages"),

  messageForm: document.getElementById("adminMessageForm"),
  messageInput: document.getElementById("adminMessageInput"),
  sendButton: document.getElementById("adminSendButton"),

  deleteUserButton: document.getElementById("deleteUserButton"),
  logoutButton: document.getElementById("adminLogoutButton"),

  emailChip: document.getElementById("adminEmailChip"),
};

// 🚀 INIT
document.addEventListener("DOMContentLoaded", () => {
  el.authForm.addEventListener("submit", handleLogin);
  el.messageForm.addEventListener("submit", sendMessage);
  el.deleteUserButton.addEventListener("click", deleteUser);
  el.logoutButton.addEventListener("click", logout);
});

// 🔑 LOGIN (same system as your user page)
async function handleLogin(e) {
  e.preventDefault();

  const email = el.email.value.trim().toLowerCase();
  const password = el.password.value;

  if (email !== ADMIN_EMAIL) {
    setStatus("Not an admin account", "error");
    return;
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .eq("password", password)
    .maybeSingle();

  if (error || !data) {
    setStatus("Invalid credentials", "error");
    return;
  }

  state.admin = data;

  el.emailChip.textContent = email;
  showLayout();

  await loadUsers();
}

// 👥 LOAD USERS
async function loadUsers() {
  const { data } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  state.users = data || [];
  renderUsers();
}

// 🎨 RENDER USERS
function renderUsers() {
  el.userList.innerHTML = "";

  state.users.forEach((user) => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.textContent = user.email;

    div.onclick = () => selectUser(user);

    el.userList.appendChild(div);
  });
}

// 👤 SELECT USER
async function selectUser(user) {
  state.activeUser = user;

  el.activeUserTitle.textContent = user.email;
  el.deleteUserButton.classList.remove("hidden");

  el.messageInput.disabled = false;
  el.sendButton.disabled = false;

  await loadMessages();
  subscribeToMessages(user.id);
}

// 💬 LOAD MESSAGES
async function loadMessages() {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", state.activeUser.id)
    .order("created_at", { ascending: true });

  state.messages = data || [];
  renderMessages();
}

// 🎨 RENDER MESSAGES
function renderMessages() {
  el.messages.innerHTML = "";

  state.messages.forEach((msg) => {
    const div = document.createElement("div");
    div.textContent = `${msg.sender}: ${msg.text}`;
    el.messages.appendChild(div);
  });

  el.messages.scrollTop = el.messages.scrollHeight;
}

// 📤 SEND MESSAGE (ADMIN)
async function sendMessage(e) {
  e.preventDefault();

  const text = el.messageInput.value.trim();
  if (!text || !state.activeUser) return;

  await supabase.from("messages").insert({
    user_id: state.activeUser.id,
    sender: "ADMIN",
    text,
  });

  el.messageInput.value = "";
}

// 🔄 REALTIME
function subscribeToMessages(userId) {
  if (state.channel) {
    supabase.removeChannel(state.channel);
  }

  state.channel = supabase
    .channel("admin-" + userId)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        state.messages.push(payload.new);
        renderMessages();
      }
    )
    .subscribe();
}

// 🗑️ DELETE USER
async function deleteUser() {
  if (!state.activeUser) return;

  const confirmDelete = confirm("Delete this user?");
  if (!confirmDelete) return;

  await supabase
    .from("users")
    .delete()
    .eq("id", state.activeUser.id);

  state.activeUser = null;

  el.activeUserTitle.textContent = "Select a conversation";
  el.messages.innerHTML = "";
  el.deleteUserButton.classList.add("hidden");

  await loadUsers();
}

// 🚪 LOGOUT
function logout() {
  state = {
    admin: null,
    users: [],
    activeUser: null,
    messages: [],
    channel: null,
  };

  showAuth();
}

// 🎨 UI HELPERS
function showLayout() {
  el.authPanel.classList.add("hidden");
  el.layout.classList.remove("hidden");
}

function showAuth() {
  el.authPanel.classList.remove("hidden");
  el.layout.classList.add("hidden");
}

function setStatus(msg) {
  el.status.textContent = msg;
}
