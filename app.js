const SUPABASE_URL = "https://kymifcsiobnukgkreckd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bWlmY3Npb2JudWtna3JlY2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTQ1NjgsImV4cCI6MjA5MTg5MDU2OH0.UVLwpoHjo8X9ansWXrQhWyzEDuhhKJ4jvZdItbfW6ok";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  session: null,
  profile: null,
  messages: [],
  channel: null,
};

const elements = {
  authPanel: document.getElementById("authPanel"),
  chatLayout: document.getElementById("chatLayout"),
  authForm: document.getElementById("authForm"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  loginButton: document.getElementById("loginButton"),
  registerButton: document.getElementById("registerButton"),
  authStatus: document.getElementById("authStatus"),
  messages: document.getElementById("messages"),
  messageForm: document.getElementById("messageForm"),
  messageInput: document.getElementById("messageInput"),
  sendButton: document.getElementById("sendButton"),
  logoutButton: document.getElementById("logoutButton"),
  userEmailChip: document.getElementById("userEmailChip"),
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindEvents();
  validateMessageInput();
  initializeSession();
}

function bindEvents() {
  elements.authForm.addEventListener("submit", handleLogin);
  elements.registerButton.addEventListener("click", handleRegister);
  elements.messageForm.addEventListener("submit", handleSendMessage);
  elements.messageInput.addEventListener("input", validateMessageInput);
  elements.logoutButton.addEventListener("click", handleLogout);
}

async function initializeSession() {
  setAuthStatus("Loading session...", "success");

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
    state.session = nextSession;

    if (nextSession?.user) {
      bootstrapChat(nextSession.user).catch(handleError);
      return;
    }

    teardownChat();
    showAuth();
  });

  state.session = session;

  if (session?.user) {
    await bootstrapChat(session.user);
  } else {
    setAuthStatus("");
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const email = elements.email.value.trim().toLowerCase();
  const password = elements.password.value;
  const validationError = validateCredentials(email, password);

  if (validationError) {
    setAuthStatus(validationError, "error");
    return;
  }

  setAuthLoading(true, "Signing you in...");

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    setAuthLoading(false);
    setAuthStatus(error.message, "error");
    return;
  }

  state.session = data.session;
  setAuthLoading(false);
  setAuthStatus("Signed in successfully.", "success");
}

async function handleRegister() {
  const email = elements.email.value.trim().toLowerCase();
  const password = elements.password.value;
  const validationError = validateCredentials(email, password);

  if (validationError) {
    setAuthStatus(validationError, "error");
    return;
  }

  setAuthLoading(true, "Creating your account...");

  const { data: duplicateUser } = await supabaseClient.from("users").select("id").eq("email", email).maybeSingle();

  if (duplicateUser) {
    setAuthLoading(false);
    setAuthStatus("An account with this email already exists.", "error");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    setAuthLoading(false);
    setAuthStatus(error.message, "error");
    return;
  }

  if (!data.user) {
    setAuthLoading(false);
    setAuthStatus("Signup completed, but no user was returned.", "error");
    return;
  }

  if (data.session) {
    await ensureUserRecord(data.user);
    setAuthStatus("Account created. You can start chatting now.", "success");
  } else {
    setAuthStatus("Account created. Confirm your email if your Supabase project requires it.", "success");
  }

  setAuthLoading(false);
}

async function bootstrapChat(user) {
  state.profile = await ensureUserRecord(user);
  elements.userEmailChip.textContent = state.profile.email;
  showChat();
  setChatLoading(true);
  await loadMessages();
  subscribeToMessages(state.profile.id);
  setChatLoading(false);
}

async function ensureUserRecord(user) {
  const email = (user.email || "").trim().toLowerCase();

  const { data: existingUser, error: existingError } = await supabaseClient
    .from("users")
    .select("id, email, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingUser) {
    return existingUser;
  }

  const { data: duplicateEmail } = await supabaseClient.from("users").select("id").eq("email", email).maybeSingle();

  if (duplicateEmail) {
    throw new Error("This email is already linked to another profile.");
  }

  const { data, error } = await supabaseClient
    .from("users")
    .insert({ id: user.id, email })
    .select("id, email, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("id, user_id, sender, text, created_at")
    .eq("user_id", state.profile.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  state.messages = data || [];
  renderMessages();
}

async function handleSendMessage(event) {
  event.preventDefault();

  const text = elements.messageInput.value.trim();

  if (!text || !state.profile?.id) {
    return;
  }

  toggleSendButton(true);

  const { error } = await supabaseClient.from("messages").insert({
    user_id: state.profile.id,
    sender: "USER",
    text,
  });

  if (error) {
    toggleSendButton(false);
    setAuthStatus(error.message, "error");
    return;
  }

  elements.messageInput.value = "";
  toggleSendButton(false);
  validateMessageInput();
}

function subscribeToMessages(userId) {
  cleanupChannel();

  state.channel = supabaseClient
    .channel(`messages:user:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `user_id=eq.${userId}`,
      },
      ({ new: nextMessage }) => {
        if (state.messages.some((message) => message.id === nextMessage.id)) {
          return;
        }

        state.messages.push(nextMessage);
        renderMessages();
      },
    )
    .subscribe();
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  teardownChat();
}

function teardownChat() {
  cleanupChannel();
  state.profile = null;
  state.messages = [];
  elements.messageInput.value = "";
  renderMessages();
  showAuth();
}

function cleanupChannel() {
  if (!state.channel) {
    return;
  }

  supabaseClient.removeChannel(state.channel);
  state.channel = null;
}

function renderMessages() {
  elements.messages.innerHTML = "";

  if (!state.messages.length) {
    elements.messages.innerHTML = `
      <div class="empty-state">
        <h3>Start conversation</h3>
        <p>Send your first message and our support team will reply here in real time.</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  state.messages.forEach((message) => {
    const row = document.createElement("div");
    row.className = `message-row ${message.sender === "USER" ? "user" : "admin"}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerHTML = `
      <div>${escapeHtml(message.text)}</div>
      <div class="message-meta">${message.sender} &bull; ${formatTimestamp(message.created_at)}</div>
    `;

    row.appendChild(bubble);
    fragment.appendChild(row);
  });

  elements.messages.appendChild(fragment);

  requestAnimationFrame(() => {
    elements.messages.scrollTop = elements.messages.scrollHeight;
  });
}

function showAuth() {
  elements.authPanel.classList.remove("hidden");
  elements.chatLayout.classList.add("hidden");
}

function showChat() {
  elements.authPanel.classList.add("hidden");
  elements.chatLayout.classList.remove("hidden");
}

function setAuthLoading(isLoading, message = "") {
  elements.loginButton.disabled = isLoading;
  elements.registerButton.disabled = isLoading;
  elements.email.disabled = isLoading;
  elements.password.disabled = isLoading;
  setAuthStatus(message, isLoading ? "success" : "");
}

function setChatLoading(isLoading) {
  elements.messageInput.disabled = isLoading;
  elements.sendButton.disabled = isLoading || !elements.messageInput.value.trim();
}

function toggleSendButton(isBusy) {
  elements.messageInput.disabled = isBusy;
  elements.sendButton.disabled = isBusy || !elements.messageInput.value.trim();
}

function validateMessageInput() {
  elements.sendButton.disabled = !elements.messageInput.value.trim() || elements.messageInput.disabled;
}

function setAuthStatus(message, type = "") {
  elements.authStatus.textContent = message;
  elements.authStatus.className = "status-message";

  if (type === "error") {
    elements.authStatus.classList.add("is-error");
  }

  if (type === "success") {
    elements.authStatus.classList.add("is-success");
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

function formatTimestamp(value) {
  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
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
