// 🔗 Supabase
const SUPABASE_URL = "https://kymifcsiobnukgkreckd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bWlmY3Npb2JudWtna3JlY2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTQ1NjgsImV4cCI6MjA5MTg5MDU2OH0.UVLwpoHjo8X9ansWXrQhWyzEDuhhKJ4jvZdItbfW6ok";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// 📦 State
let activeUserId = null;
let messagesByUser = new Map();

// 🎯 Elements
const el = {
  authPanel: document.getElementById("adminAuthPanel"),
  layout: document.getElementById("adminLayout"),
  form: document.getElementById("adminAuthForm"),
  email: document.getElementById("adminEmail"),
  password: document.getElementById("adminPassword"),
  status: document.getElementById("adminAuthStatus"),
  userList: document.getElementById("userList"),
  messages: document.getElementById("adminMessages"),
  input: document.getElementById("adminMessageInput"),
  sendBtn: document.getElementById("adminSendButton"),
};

// 🚀 INIT
document.addEventListener("DOMContentLoaded", () => {
  el.form.addEventListener("submit", login);
  document
    .getElementById("adminMessageForm")
    .addEventListener("submit", sendMessage);
});

// 🔑 LOGIN
async function login(e) {
  e.preventDefault();

  const email = el.email.value.trim();
  const password = el.password.value;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .eq("password", password)
    .maybeSingle();

  if (error || !data || data.role !== "admin") {
    el.status.textContent = "Invalid admin login";
    return;
  }

  el.authPanel.classList.add("hidden");
  el.layout.classList.remove("hidden");

  loadData();
  subscribe();
}

// 📥 LOAD USERS + MESSAGES
async function loadData() {
  const { data: users } = await supabase.from("users").select("*");
  const { data: messages } = await supabase.from("messages").select("*");

  messagesByUser = group(messages || []);

  activeUserId = users?.[0]?.id || null;

  renderUsers(users || []);
  renderMessages();
}

// 🧩 GROUP MESSAGES
function group(messages) {
  const map = new Map();
  messages.forEach((m) => {
    if (!map.has(m.user_id)) map.set(m.user_id, []);
    map.get(m.user_id).push(m);
  });
  return map;
}

// 👥 USER LIST
function renderUsers(users) {
  el.userList.innerHTML = "";

  users.forEach((u) => {
    const btn = document.createElement("button");
    btn.textContent = u.email;

    btn.onclick = () => {
      activeUserId = u.id;
      renderMessages();
    };

    el.userList.appendChild(btn);
  });
}

// 💬 MESSAGES
function renderMessages() {
  el.messages.innerHTML = "";

  const msgs = messagesByUser.get(activeUserId) || [];

  msgs.forEach((m) => {
    const div = document.createElement("div");
    div.textContent = `${m.sender}: ${m.text}`;
    el.messages.appendChild(div);
  });

  el.messages.scrollTop = el.messages.scrollHeight;
}

// 📤 SEND
async function sendMessage(e) {
  e.preventDefault();

  const text = el.input.value.trim();
  if (!text || !activeUserId) return;

  await supabase.from("messages").insert({
    user_id: activeUserId,
    sender: "ADMIN",
    text,
  });

  el.input.value = "";
}

// 🔄 REALTIME
function subscribe() {
  supabase
    .channel("messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      ({ new: m }) => {
        if (!messagesByUser.has(m.user_id)) {
          messagesByUser.set(m.user_id, []);
        }

        messagesByUser.get(m.user_id).push(m);

        if (m.user_id === activeUserId) {
          renderMessages();
        }
      }
    )
    .subscribe();
}
