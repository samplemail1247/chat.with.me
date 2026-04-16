// 🔒 Prevent double init
if (window.__adminAppInitialized) {
  throw new Error("Admin already initialized");
}
window.__adminAppInitialized = true;

// 🔗 Supabase
const SUPABASE_URL = "https://kymifcsiobnukgkreckd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bWlmY3Npb2JudWtna3JlY2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTQ1NjgsImV4cCI6MjA5MTg5MDU2OH0.UVLwpoHjo8X9ansWXrQhWyzEDuhhKJ4jvZdItbfW6ok";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// 📦 State
const state = {
  users: [],
  messagesByUser: new Map(),
  activeUserId: null,
  inboxChannel: null,
};

// 🎯 Elements
const elements = {
  adminAuthPanel: document.getElementById("adminAuthPanel"),
  adminLayout: document.getElementById("adminLayout"),
  adminAuthForm: document.getElementById("adminAuthForm"),
  adminEmail: document.getElementById("adminEmail"),
  adminPassword: document.getElementById("adminPassword"),
  adminLoginButton: document.getElementById("adminLoginButton"),
  adminAuthStatus: document.getElementById("adminAuthStatus"),
  adminEmailChip: document.getElementById("adminEmailChip"),
  userList: document.getElementById("userList"),
  activeUserTitle: document.getElementById("activeUserTitle"),
  adminMessages: document.getElementById("adminMessages"),
  adminMessageForm: document.getElementById("adminMessageForm"),
  adminMessageInput: document.getElementById("adminMessageInput"),
  adminSendButton: document.getElementById("adminSendButton"),
  deleteUserButton: document.getElementById("deleteUserButton"),
  adminLogoutButton: document.getElementById("adminLogoutButton"),
  sidebar: document.getElementById("sidebar"),
  openSidebarButton: document.getElementById("openSidebarButton"),
  closeSidebarButton: document.getElementById("closeSidebarButton"),
};

// 🚀 Init
document.addEventListener("DOMContentLoaded", init);

function init() {
  bindEvents();
  validateSendState();
  showAuthPanel();
}

// 🔗 Events
function bindEvents() {
  elements.adminAuthForm.addEventListener("submit", handleAdminLogin);
  elements.adminMessageForm.addEventListener("submit", handleAdminSendMessage);
  elements.adminMessageInput.addEventListener("input", validateSendState);
  elements.deleteUserButton.addEventListener("click", handleDeleteUser);
  elements.adminLogoutButton.addEventListener("click", handleLogout);
  elements.openSidebarButton.addEventListener("click", () => toggleSidebar(true));
  elements.closeSidebarButton.addEventListener("click", () => toggleSidebar(false));
}

// 🔑 LOGIN (DB BASED)
async function handleAdminLogin(event) {
  event.preventDefault();

  const email = elements.adminEmail.value.trim().toLowerCase();
  const password = elements.adminPassword.value;

  const validationError = validateCredentials(email, password);
  if (validationError) {
    setAuthStatus(validationError, "error");
    return;
  }

  setLoginLoading(true, "Logging in...");

  const { data, error } = await supabaseClient
    .from("users")
    .select("*")
    .eq("email", email)
    .eq("password", password)
    .maybeSingle();

  if (error || !data) {
    setLoginLoading(false);
    setAuthStatus("Invalid credentials", "error");
    return;
  }

  // 🔥 ROLE CHECK (THIS IS THE KEY)
  if (data.role !== "admin") {
    setLoginLoading(false);
    setAuthStatus("Access denied: Not an admin", "error");
    return;
  }

  setLoginLoading(false);
  setAuthStatus("Welcome admin", "success");

  await bootstrapAdmin(data);
}

// 🧠 BOOTSTRAP
async function bootstrapAdmin(user) {
  elements.adminEmailChip.textContent = user.email;
  showAdminLayout();
  await loadUsersAndMessages();
  subscribeToInbox();
}

// 📥 LOAD DATA
async function loadUsersAndMessages() {
  const [{ data: users }, { data: messages }] = await Promise.all([
    supabaseClient.from("users").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("messages").select("*").order("created_at", { ascending: true }),
  ]);

  state.users = users || [];
  state.messagesByUser = groupMessagesByUser(messages || []);

  if (state.users.length > 0) {
  state.activeUserId = state.users[0].id;
} else {
  state.activeUserId = null;
}

  renderUserList();
  renderActiveConversation();
  validateSendState();
}

// 🧩 GROUP
function groupMessagesByUser(messages) {
  const map = new Map();
  messages.forEach((m) => {
    if (!map.has(m.user_id)) map.set(m.user_id, []);
    map.get(m.user_id).push(m);
  });
  return map;
}

// 👥 USERS LIST
function renderUserList() {
  elements.userList.innerHTML = "";

  state.users.forEach((user) => {
    const btn = document.createElement("button");
    btn.textContent = user.email;

    btn.onclick = () => {
      state.activeUserId = user.id;
      renderUserList();
      renderActiveConversation();
      toggleSidebar(false);
    };

    elements.userList.appendChild(btn);
  });
}

// 💬 CHAT
function renderActiveConversation() {
  elements.adminMessages.innerHTML = "";

  const messages = state.messagesByUser.get(state.activeUserId) || [];

  messages.forEach((m) => {
    const div = document.createElement("div");
    div.textContent = `${m.sender}: ${m.text}`;
    elements.adminMessages.appendChild(div);
  });

  elements.adminMessages.scrollTop = elements.adminMessages.scrollHeight;
}

// 📤 SEND
async function handleAdminSendMessage(e) {
  e.preventDefault();

  const text = elements.adminMessageInput.value.trim();
  if (!text || !state.activeUserId) return;

  setComposerBusy(true);

  const { error } = await supabaseClient.from("messages").insert({
    user_id: state.activeUserId,
    sender: "ADMIN",
    text,
  });

  setComposerBusy(false); // ✅ ALWAYS reset

  if (error) {
    setAuthStatus(error.message);
    return;
  }

  elements.adminMessageInput.value = "";
  validateSendState();
}

// 🗑 DELETE USER
async function handleDeleteUser() {
  if (!state.activeUserId) return;

  if (!confirm("Delete user and messages?")) return;

  // delete messages first
  await supabaseClient
    .from("messages")
    .delete()
    .eq("user_id", state.activeUserId);

  await supabaseClient
    .from("users")
    .delete()
    .eq("id", state.activeUserId);

  state.users = state.users.filter((u) => u.id !== state.activeUserId);
  state.messagesByUser.delete(state.activeUserId);
  state.activeUserId = state.users[0]?.id || null;

  renderUserList();
  renderActiveConversation();
}

// 🔄 REALTIME
function subscribeToInbox() {
  if (state.inboxChannel) return;

  state.inboxChannel = supabaseClient
    .channel("admin")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, ({ new: m }) => {
      if (!state.messagesByUser.has(m.user_id)) {
        state.messagesByUser.set(m.user_id, []);
      }
      state.messagesByUser.get(m.user_id).push(m);

      renderUserList();
      if (state.activeUserId === m.user_id) {
        renderActiveConversation();
        btn.style.background =
  state.activeUserId === user.id ? "#ddd" : "transparent";
      }
    })
    .subscribe();
}

// 🚪 LOGOUT
function handleLogout() {
  teardownAdmin();
}

// 🧹 CLEAN
function teardownAdmin() {
  if (state.inboxChannel) {
    supabaseClient.removeChannel(state.inboxChannel);
    state.inboxChannel = null;
  }

  state.users = [];
  state.messagesByUser = new Map();
  state.activeUserId = null;

  elements.adminMessageInput.value = "";
  renderUserList();
  renderActiveConversation();

  showAuthPanel();
}

// 🎨 UI
function showAdminLayout() {
  elements.adminAuthPanel.classList.add("hidden");
  elements.adminLayout.classList.remove("hidden");
}

function showAuthPanel() {
  elements.adminAuthPanel.classList.remove("hidden");
  elements.adminLayout.classList.add("hidden");
}

function toggleSidebar(open) {
  elements.sidebar.classList.toggle("is-open", open);
}

// ⚙️ HELPERS
function setLoginLoading(loading, msg = "") {
  elements.adminEmail.disabled = loading;
  elements.adminPassword.disabled = loading;
  elements.adminLoginButton.disabled = loading;
  setAuthStatus(msg);
}

function setComposerBusy(busy) {
  elements.adminMessageInput.disabled = busy;
  elements.adminSendButton.disabled = busy || !elements.adminMessageInput.value.trim();
}

function validateSendState() {
  elements.adminSendButton.disabled =
    !state.activeUserId ||
    !elements.adminMessageInput.value.trim();
}

function setAuthStatus(msg) {
  elements.adminAuthStatus.textContent = msg;
}

function validateCredentials(email, password) {
  if (!email.includes("@")) return "Invalid email";
  if (password.length < 6) return "Password too short";
  return "";
}

