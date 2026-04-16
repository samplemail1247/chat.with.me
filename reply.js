// 🔗 Supabase setup
const SUPABASE_URL = "https://kymifcsiobnukgkreckd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bWlmY3Npb2JudWtna3JlY2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTQ1NjgsImV4cCI6MjA5MTg5MDU2OH0.UVLwpoHjo8X9ansWXrQhWyzEDuhhKJ4jvZdItbfW6ok";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// 📦 State
let activeUserId = null;
let messagesByUser = new Map();
let usersList = [];

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

  await loadData();
  subscribe();
}

// 📥 LOAD DATA
async function loadData() {
  const { data: users } = await supabase.from("users").select("*");

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  usersList = users || [];
  messagesByUser = groupMessages(messages || []);

  sortUsersByRecent();

  activeUserId = usersList[0]?.id || null;

  renderUsers();
  renderMessages();
}

// 🧩 GROUP MESSAGES
function groupMessages(messages) {
  const map = new Map();

  messages.forEach((m) => {
    if (!map.has(m.user_id)) map.set(m.user_id, []);
    map.get(m.user_id).push(m);
  });

  return map;
}

// 🔥 SORT USERS BY LATEST MESSAGE
function sortUsersByRecent() {
  usersList.sort((a, b) => {
    const aMsgs = messagesByUser.get(a.id) || [];
    const bMsgs = messagesByUser.get(b.id) || [];

    const aLast = aMsgs[aMsgs.length - 1]?.created_at || 0;
    const bLast = bMsgs[bMsgs.length - 1]?.created_at || 0;

    return new Date(bLast) - new Date(aLast);
  });
}

// 👥 RENDER USERS
function renderUsers() {
  el.userList.innerHTML = "";

  usersList.forEach((u) => {
    const btn = document.createElement("button");
    btn.textContent = u.email;

    if (u.id === activeUserId) {
      btn.style.background = "#ddd";
    }

    btn.onclick = () => {
      activeUserId = u.id;
      renderUsers();
      renderMessages();
    };

    el.userList.appendChild(btn);
  });
}

// 💬 RENDER MESSAGES
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

// 📤 SEND MESSAGE
async function sendMessage(e) {
  e.preventDefault();

  const text = el.input.value.trim();
  if (!text || !activeUserId) return;

  const newMsg = {
    user_id: activeUserId,
    sender: "ADMIN",
    text,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("messages").insert(newMsg);

  if (error) {
    console.error("Send failed:", error);
    return;
  }

  // instant UI update
  if (!messagesByUser.has(activeUserId)) {
    messagesByUser.set(activeUserId, []);
  }

  messagesByUser.get(activeUserId).push(newMsg);

  sortUsersByRecent();
  renderUsers();
  renderMessages();

  el.input.value = "";
}

// 🔄 REALTIME SUBSCRIBE
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

        sortUsersByRecent();
        renderUsers();

        if (m.user_id === activeUserId) {
          renderMessages();
        }
      }
    )
    .subscribe();
}
