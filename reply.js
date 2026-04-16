const SUPABASE_URL = "https://kymifcsiobnukgkreckd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bWlmY3Npb2JudWtna3JlY2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTQ1NjgsImV4cCI6MjA5MTg5MDU2OH0.UVLwpoHjo8X9ansWXrQhWyzEDuhhKJ4jvZdItbfW6ok";
const ADMIN_EMAIL = "admin@example.com";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  session: null,
  users: [],
  messagesByUser: new Map(),
  activeUserId: null,
  inboxChannel: null,
};

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

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindEvents();
  validateSendState();
  initializeAdminSession();
}

function bindEvents() {
  elements.adminAuthForm.addEventListener("submit", handleAdminLogin);
  elements.adminMessageForm.addEventListener("submit", handleAdminSendMessage);
  elements.adminMessageInput.addEventListener("input", validateSendState);
  elements.deleteUserButton.addEventListener("click", handleDeleteUser);
  elements.adminLogoutButton.addEventListener("click", handleLogout);
  elements.openSidebarButton.addEventListener("click", () => toggleSidebar(true));
  elements.closeSidebarButton.addEventListener("click", () => toggleSidebar(false));
}

async function initializeAdminSession() {
  setAuthStatus("Loading admin session...", "success");

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
    state.session = nextSession;

    if (nextSession?.user) {
      bootstrapAdmin(nextSession.user).catch(handleError);
      return;
    }

    teardownAdmin();
  });

  state.session = session;

  if (session?.user) {
    await bootstrapAdmin(session.user);
  } else {
    setAuthStatus("");
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();

  const email = elements.adminEmail.value.trim().toLowerCase();
  const password = elements.adminPassword.value;
  const validationError = validateCredentials(email, password);

  if (validationError) {
    setAuthStatus(validationError, "error");
    return;
  }

  setLoginLoading(true, "Signing in...");

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    setLoginLoading(false);
    setAuthStatus(error.message, "error");
    return;
  }

  if ((data.user?.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    await supabaseClient.auth.signOut();
    setLoginLoading(false);
    setAuthStatus(`Access denied. Update ADMIN_EMAIL in reply.js to "${email}" if this should be the admin account.`, "error");
    return;
  }

  setLoginLoading(false);
  setAuthStatus("Welcome back.", "success");
}

async function bootstrapAdmin(user) {
  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    await supabaseClient.auth.signOut();
    throw new Error(`Only ${ADMIN_EMAIL} can access the admin panel. Update ADMIN_EMAIL if needed.`);
  }

  elements.adminEmailChip.textContent = user.email;
  showAdminLayout();
  await loadUsersAndMessages();
  subscribeToInbox();
}

async function loadUsersAndMessages() {
  setUserListLoading();
  const [{ data: users, error: userError }, { data: messages, error: messageError }] = await Promise.all([
    supabaseClient.from("users").select("id, email, created_at").order("created_at", { ascending: false }),
    supabaseClient.from("messages").select("id, user_id, sender, text, created_at").order("created_at", { ascending: true }),
  ]);

  if (userError) {
    throw userError;
  }

  if (messageError) {
    throw messageError;
  }

  state.users = users || [];
  state.messagesByUser = groupMessagesByUser(messages || []);
  sortUsersByLatestMessage();

  if (state.activeUserId && state.users.some((user) => user.id === state.activeUserId)) {
    renderUserList();
    renderActiveConversation();
    return;
  }

  state.activeUserId = state.users[0]?.id || null;
  renderUserList();
  renderActiveConversation();
}

function groupMessagesByUser(messages) {
  const grouped = new Map();

  messages.forEach((message) => {
    if (!grouped.has(message.user_id)) {
      grouped.set(message.user_id, []);
    }

    grouped.get(message.user_id).push(message);
  });

  return grouped;
}

function sortUsersByLatestMessage() {
  state.users.sort((left, right) => {
    const leftLatest = getLatestMessage(left.id);
    const rightLatest = getLatestMessage(right.id);

    if (!leftLatest && !rightLatest) {
      return new Date(right.created_at) - new Date(left.created_at);
    }

    if (!leftLatest) {
      return 1;
    }

    if (!rightLatest) {
      return -1;
    }

    return new Date(rightLatest.created_at) - new Date(leftLatest.created_at);
  });
}

function renderUserList() {
  elements.userList.innerHTML = "";

  if (!state.users.length) {
    elements.userList.innerHTML = `
      <div class="empty-state">
        <h3>No users yet</h3>
        <p>New customer accounts will appear here once they sign in.</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  state.users.forEach((user) => {
    const button = document.createElement("button");
    const latestMessage = getLatestMessage(user.id);

    button.type = "button";
    button.className = `user-item ${state.activeUserId === user.id ? "is-active" : ""}`;
    button.innerHTML = `
      <div class="user-item-main">
        <div class="user-email">${escapeHtml(user.email)}</div>
        <div class="user-preview">${escapeHtml(latestMessage?.text || "Start conversation")}</div>
      </div>
      <div class="user-time">${latestMessage ? formatListTime(latestMessage.created_at) : "New"}</div>
    `;

    button.addEventListener("click", () => {
      state.activeUserId = user.id;
      renderUserList();
      renderActiveConversation();
      toggleSidebar(false);
    });

    fragment.appendChild(button);
  });

  elements.userList.appendChild(fragment);
}

function renderActiveConversation() {
  elements.adminMessages.innerHTML = "";

  const activeUser = state.users.find((user) => user.id === state.activeUserId);
  elements.activeUserTitle.textContent = activeUser ? activeUser.email : "Select a conversation";
  elements.deleteUserButton.classList.toggle("hidden", !activeUser);
  setComposerState(!activeUser);

  if (!activeUser) {
    elements.adminMessages.innerHTML = `
      <div class="empty-state">
        <h3>Select a conversation</h3>
        <p>Choose a customer from the sidebar to read and reply in real time.</p>
      </div>
    `;
    return;
  }

  const messages = state.messagesByUser.get(state.activeUserId) || [];

  if (!messages.length) {
    elements.adminMessages.innerHTML = `
      <div class="empty-state">
        <h3>Start conversation</h3>
        <p>This user has not sent a message yet. Your first reply will appear here.</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  messages.forEach((message) => {
    const row = document.createElement("div");
    row.className = `message-row ${message.sender === "ADMIN" ? "admin" : "user"}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerHTML = `
      <div>${escapeHtml(message.text)}</div>
      <div class="message-meta">${message.sender} &bull; ${formatTimestamp(message.created_at)}</div>
    `;

    row.appendChild(bubble);
    fragment.appendChild(row);
  });

  elements.adminMessages.appendChild(fragment);

  requestAnimationFrame(() => {
    elements.adminMessages.scrollTop = elements.adminMessages.scrollHeight;
  });
}

function subscribeToInbox() {
  if (state.inboxChannel) {
    return;
  }

  state.inboxChannel = supabaseClient
    .channel("admin-inbox")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "users",
      },
      ({ new: nextUser }) => {
        if (state.users.some((user) => user.id === nextUser.id)) {
          return;
        }

        state.users.push(nextUser);
        sortUsersByLatestMessage();
        renderUserList();

        if (!state.activeUserId) {
          state.activeUserId = nextUser.id;
          renderUserList();
          renderActiveConversation();
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      ({ new: nextMessage }) => {
        appendMessage(nextMessage);
        sortUsersByLatestMessage();
        renderUserList();

        if (state.activeUserId === nextMessage.user_id) {
          renderActiveConversation();
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "users",
      },
      ({ old }) => {
        state.users = state.users.filter((user) => user.id !== old.id);
        state.messagesByUser.delete(old.id);

        if (state.activeUserId === old.id) {
          state.activeUserId = state.users[0]?.id || null;
        }

        renderUserList();
        renderActiveConversation();
      },
    )
    .subscribe();
}

function appendMessage(message) {
  const existingMessages = state.messagesByUser.get(message.user_id) || [];

  if (existingMessages.some((entry) => entry.id === message.id)) {
    return;
  }

  existingMessages.push(message);
  state.messagesByUser.set(message.user_id, existingMessages);
}

async function handleAdminSendMessage(event) {
  event.preventDefault();

  const text = elements.adminMessageInput.value.trim();

  if (!text || !state.activeUserId) {
    return;
  }

  setComposerBusy(true);

  const { error } = await supabaseClient.from("messages").insert({
    user_id: state.activeUserId,
    sender: "ADMIN",
    text,
  });

  if (error) {
    setComposerBusy(false);
    setAuthStatus(error.message, "error");
    return;
  }

  elements.adminMessageInput.value = "";
  setComposerBusy(false);
  validateSendState();
}

async function handleDeleteUser() {
  if (!state.activeUserId) {
    return;
  }

  const user = state.users.find((entry) => entry.id === state.activeUserId);
  const confirmed = window.confirm(`Delete ${user?.email || "this user"} and all their messages?`);

  if (!confirmed) {
    return;
  }

  elements.deleteUserButton.disabled = true;

  const { error } = await supabaseClient.from("users").delete().eq("id", state.activeUserId);

  if (error) {
    elements.deleteUserButton.disabled = false;
    setAuthStatus(error.message, "error");
    return;
  }

  state.users = state.users.filter((entry) => entry.id !== state.activeUserId);
  state.messagesByUser.delete(state.activeUserId);
  state.activeUserId = state.users[0]?.id || null;
  renderUserList();
  renderActiveConversation();
  elements.deleteUserButton.disabled = false;
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  teardownAdmin();
}

function teardownAdmin() {
  if (state.inboxChannel) {
    supabaseClient.removeChannel(state.inboxChannel);
    state.inboxChannel = null;
  }

  state.users = [];
  state.messagesByUser = new Map();
  state.activeUserId = null;
  elements.adminMessageInput.value = "";
  elements.activeUserTitle.textContent = "Select a conversation";
  renderUserList();
  renderActiveConversation();
  showAuthPanel();
}

function showAdminLayout() {
  elements.adminAuthPanel.classList.add("hidden");
  elements.adminLayout.classList.remove("hidden");
}

function showAuthPanel() {
  elements.adminAuthPanel.classList.remove("hidden");
  elements.adminLayout.classList.add("hidden");
  toggleSidebar(false);
}

function setUserListLoading() {
  elements.userList.innerHTML = `
    <div class="empty-state">
      <h3>Loading users</h3>
      <p>Fetching conversations from Supabase.</p>
    </div>
  `;
}

function setLoginLoading(isLoading, message = "") {
  elements.adminEmail.disabled = isLoading;
  elements.adminPassword.disabled = isLoading;
  elements.adminLoginButton.disabled = isLoading;
  setAuthStatus(message, isLoading ? "success" : "");
}

function setComposerState(disabled) {
  elements.adminMessageInput.disabled = disabled;
  elements.adminSendButton.disabled = disabled || !elements.adminMessageInput.value.trim();
}

function setComposerBusy(isBusy) {
  elements.adminMessageInput.disabled = isBusy;
  elements.adminSendButton.disabled = isBusy || !elements.adminMessageInput.value.trim();
}

function validateSendState() {
  elements.adminSendButton.disabled = !state.activeUserId || !elements.adminMessageInput.value.trim() || elements.adminMessageInput.disabled;
}

function toggleSidebar(forceOpen) {
  elements.sidebar.classList.toggle("is-open", forceOpen);
}

function setAuthStatus(message, type = "") {
  elements.adminAuthStatus.textContent = message;
  elements.adminAuthStatus.className = "status-message";

  if (type === "error") {
    elements.adminAuthStatus.classList.add("is-error");
  }

  if (type === "success") {
    elements.adminAuthStatus.classList.add("is-success");
  }
}

function validateCredentials(email, password) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    return "Please enter a valid email address.";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }

  return "";
}

function getLatestMessage(userId) {
  const messages = state.messagesByUser.get(userId) || [];
  return messages[messages.length - 1] || null;
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatListTime(value) {
  return new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function handleError(error) {
  console.error(error);
  setAuthStatus(error.message || "Something went wrong.", "error");
}
