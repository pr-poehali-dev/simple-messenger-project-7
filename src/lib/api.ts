const URLS = {
  auth: "https://functions.poehali.dev/aa4cf146-08a6-43b4-b1e2-c417a3974727",
  chats: "https://functions.poehali.dev/1d59ab28-e2af-4e2e-921a-e355bb05c4dc",
  messages: "https://functions.poehali.dev/358ad8f6-b989-4d23-ab23-3824ce234a9a",
};

function getToken(): string {
  return localStorage.getItem("cipher_token") || "";
}

async function call(fn: keyof typeof URLS, method: string, params?: object, body?: object) {
  let url = URLS[fn];
  if (params) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    url += "?" + qs;
  }
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": getToken(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.json();
  // Handle double-encoded body from cloud proxy
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!res.ok && data.error) throw new Error(data.error);
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (display_name: string, email: string, phone: string, password: string) =>
    call("auth", "POST", undefined, { action: "register", display_name, email, phone, password }),

  login: (identity: string, password: string) =>
    call("auth", "POST", undefined, { action: "login", identity, password }),

  logout: () =>
    call("auth", "POST", undefined, { action: "logout" }),

  me: () =>
    call("auth", "GET"),

  updateProfile: (data: Record<string, unknown>) =>
    call("auth", "POST", undefined, { action: "update_profile", ...data }),
};

// ── Chats ─────────────────────────────────────────────────────────────────────

export const chatsApi = {
  list: (archived = false) =>
    call("chats", "GET", { action: "list", ...(archived ? { archived: "true" } : {}) }),

  search: (q: string) =>
    call("chats", "GET", { action: "search", q }),

  create: (data: { type: string; name?: string; partner_id?: number }) =>
    call("chats", "POST", undefined, { action: "create", ...data }),

  join: (invite_code: string) =>
    call("chats", "POST", undefined, { action: "join", invite_code }),

  archive: (chat_id: number, archived: boolean) =>
    call("chats", "POST", undefined, { action: "archive", chat_id, archived }),
};

// ── Messages ──────────────────────────────────────────────────────────────────

export const messagesApi = {
  get: (chat_id: number, since_id?: number) =>
    call("messages", "GET", {
      chat_id: String(chat_id),
      ...(since_id ? { since_id: String(since_id) } : {}),
    }),

  send: (chat_id: number, text: string, reply_to_id?: number) =>
    call("messages", "POST", undefined, {
      action: "send", chat_id, text,
      ...(reply_to_id ? { reply_to_id } : {}),
    }),

  edit: (msg_id: number, text: string) =>
    call("messages", "POST", undefined, { action: "edit", msg_id, text }),
};
