<script>
const SUPABASE_URL = "https://kymifcsiobnukgkreckd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bWlmY3Npb2JudWtna3JlY2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTQ1NjgsImV4cCI6MjA5MTg5MDU2OH0.UVLwpoHjo8X9ansWXrQhWyzEDuhhKJ4jvZdItbfW6ok";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let activeUserId = null;

// LOAD USERS
async function loadUsers() {
  const { data } = await supabase.from("users").select("*");

  const list = document.getElementById("userList");
  list.innerHTML = "";

  data.forEach(user => {
    const div = document.createElement("div");

    const btn = document.createElement("button");
    btn.textContent = user.email;
    btn.onclick = () => selectUser(user.id);

    const del = document.createElement("button");
    del.textContent = "❌";
    del.onclick = () => deleteUser(user.id);

    div.appendChild(btn);
    div.appendChild(del);
    list.appendChild(div);
  });
}

// SELECT USER
async function selectUser(userId) {
  activeUserId = userId;
  loadMessages();
}

// LOAD MESSAGES
async function loadMessages() {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", activeUserId)
    .order("created_at", { ascending: true });

  const box = document.getElementById("messages");
  box.innerHTML = "";

  data.forEach(m => {
    const div = document.createElement("div");
    div.textContent = m.sender + ": " + m.text;
    box.appendChild(div);
  });
}

// SEND MESSAGE
async function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (!text || !activeUserId) return;

  const { error } = await supabase.from("messages").insert({
    user_id: activeUserId,
    sender: "ADMIN",
    text: text
  });

  if (error) {
    alert(error.message);
    return;
  }

  input.value = "";
  loadMessages();
}

// DELETE USER
async function deleteUser(userId) {
  if (!confirm("Delete user?")) return;

  await supabase.from("messages").delete().eq("user_id", userId);
  await supabase.from("users").delete().eq("id", userId);

  activeUserId = null;
  loadUsers();
  document.getElementById("messages").innerHTML = "";
}

// INIT
loadUsers();
</script>
