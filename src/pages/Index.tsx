import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { authApi, chatsApi, messagesApi } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: number;
  display_name: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  avatar_url: string | null;
  status: string;
  bio: string;
  show_online_status: boolean;
  read_receipts: boolean;
  screen_capture: boolean;
  notify_messages: boolean;
  notify_sound: boolean;
  notify_preview: boolean;
  two_factor_enabled: boolean;
}

interface ChatMember {
  id: number;
  display_name: string;
  avatar_url: string | null;
  status: string;
}

interface Chat {
  id: number;
  type: string;
  name: string | null;
  avatar_url: string | null;
  description: string | null;
  invite_code: string;
  encrypted: boolean;
  updated_at: string | null;
  is_archived: boolean;
  unread: number;
  last_msg: string | null;
  last_msg_at: string | null;
  members: ChatMember[];
}

interface Message {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar: string | null;
  text: string;
  reply_to_id: number | null;
  is_removed: boolean;
  edited_at: string | null;
  created_at: string;
  is_mine: boolean;
}

type Panel = "chats" | "profile" | "settings" | "archive" | "search";
type SettingsTab = "privacy" | "notifications" | "account";
type AuthScreen = "login" | "register";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 604800000) return d.toLocaleDateString("ru", { weekday: "short" });
  return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
}

function getChatName(chat: Chat, me: User): string {
  if (chat.type === "group" && chat.name) return chat.name;
  if (chat.type === "direct") {
    const other = chat.members.find((m) => m.id !== me.id);
    return other?.display_name || "Чат";
  }
  return chat.name || "Чат";
}

function getChatInitials(chat: Chat, me: User): string {
  return getInitials(getChatName(chat, me));
}

function getChatStatus(chat: Chat, me: User): string {
  if (chat.type === "group") return "group";
  const other = chat.members.find((m) => m.id !== me.id);
  return other?.status || "offline";
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: "bg-green-400 online-pulse",
    away: "bg-amber-400",
    offline: "bg-gray-600",
    group: "bg-[var(--cipher-encrypted)]",
  };
  return (
    <span className={`w-2.5 h-2.5 rounded-full border-2 border-[var(--cipher-surface)] absolute bottom-0 right-0 ${colors[status] ?? "bg-gray-600"}`} />
  );
}

function Avatar({ initials, size = "md", status }: { initials: string; size?: "sm" | "md" | "lg"; status?: string }) {
  const sizeMap = { sm: "w-8 h-8 text-xs", md: "w-11 h-11 text-sm", lg: "w-16 h-16 text-xl" };
  return (
    <div className={`relative flex-shrink-0 ${sizeMap[size]}`}>
      <div className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-[var(--cipher-accent-dim)] to-[var(--cipher-encrypted)] flex items-center justify-center font-semibold text-white`}>
        {initials}
      </div>
      {status && <StatusDot status={status} />}
    </div>
  );
}

function EncryptBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--cipher-encrypted)]/15 border border-[var(--cipher-encrypted)]/30 text-[var(--cipher-encrypted)]">
      <Icon name="Lock" size={9} />E2E
    </span>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 ${on ? "bg-[var(--cipher-accent)]" : "bg-[var(--cipher-surface2)] border border-[var(--cipher-border)]"}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow ${on ? "right-1" : "left-1"}`} />
    </button>
  );
}

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div className="animate-spin rounded-full border-2 border-[var(--cipher-border)] border-t-[var(--cipher-accent)]" style={{ width: size, height: size }} />
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────

function AuthPage({ onAuth }: { onAuth: (token: string, user: User) => void }) {
  const [screen, setScreen] = useState<AuthScreen>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ identity: "", email: "", phone: "", display_name: "", password: "", confirmPassword: "" });
  const [usePhone, setUsePhone] = useState(false);

  const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(""); };

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      if (screen === "login") {
        const res = await authApi.login(form.identity, form.password);
        localStorage.setItem("cipher_token", res.token);
        onAuth(res.token, res.user);
      } else {
        if (form.password !== form.confirmPassword) { setError("Пароли не совпадают"); setLoading(false); return; }
        const res = await authApi.register(form.display_name, usePhone ? "" : form.email, usePhone ? form.phone : "", form.password);
        localStorage.setItem("cipher_token", res.token);
        onAuth(res.token, res.user);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-[var(--cipher-surface2)] border border-[var(--cipher-border)] rounded-xl px-4 py-3 text-sm text-[var(--cipher-text)] outline-none focus:border-[var(--cipher-accent)] transition-colors placeholder:text-[var(--cipher-muted)]";

  return (
    <div className="min-h-screen bg-[var(--cipher-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[var(--cipher-accent)] flex items-center justify-center shadow-lg shadow-[var(--cipher-accent)]/20">
            <Icon name="ShieldCheck" size={28} className="text-[var(--cipher-bg)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--cipher-text)] font-montserrat tracking-tight">CIPHER</h1>
          <p className="text-xs text-[var(--cipher-muted)]">Зашифрованный мессенджер</p>
        </div>

        <div className="flex gap-1 bg-[var(--cipher-surface)] rounded-xl p-1 mb-6 border border-[var(--cipher-border)]">
          {(["login", "register"] as const).map((s) => (
            <button key={s} onClick={() => { setScreen(s); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${screen === s ? "bg-[var(--cipher-accent)] text-[var(--cipher-bg)]" : "text-[var(--cipher-muted)] hover:text-[var(--cipher-text)]"}`}>
              {s === "login" ? "Войти" : "Регистрация"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {screen === "register" && (
            <input className={inputCls} placeholder="Ваше имя" value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
          )}
          {screen === "register" && (
            <div className="flex gap-1 bg-[var(--cipher-surface2)] rounded-xl p-1 border border-[var(--cipher-border)]">
              {(["email", "phone"] as const).map((t) => (
                <button key={t} onClick={() => setUsePhone(t === "phone")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${(t === "phone") === usePhone ? "bg-[var(--cipher-accent)] text-[var(--cipher-bg)]" : "text-[var(--cipher-muted)]"}`}>
                  {t === "email" ? "Email" : "Телефон"}
                </button>
              ))}
            </div>
          )}
          {screen === "login" ? (
            <input className={inputCls} placeholder="Email или телефон" value={form.identity} onChange={(e) => set("identity", e.target.value)} />
          ) : usePhone ? (
            <input className={inputCls} placeholder="+7 (900) 000-00-00" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          ) : (
            <input className={inputCls} placeholder="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          )}
          <input className={inputCls} placeholder="Пароль" type="password" value={form.password}
            onChange={(e) => set("password", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && submit()} />
          {screen === "register" && (
            <input className={inputCls} placeholder="Повторите пароль" type="password" value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && submit()} />
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <Icon name="AlertCircle" size={13} />{error}
            </div>
          )}

          <button onClick={submit} disabled={loading}
            className="w-full py-3 rounded-xl bg-[var(--cipher-accent)] text-[var(--cipher-bg)] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-60 mt-1">
            {loading ? <Spinner size={18} /> : <Icon name="LogIn" size={16} />}
            {loading ? "Подождите..." : screen === "login" ? "Войти в аккаунт" : "Создать аккаунт"}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-5 text-[11px] text-[var(--cipher-muted)] justify-center">
          <Icon name="Lock" size={11} />
          Все данные защищены сквозным шифрованием
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Nav ──────────────────────────────────────────────────────────────

function SidebarNav({ active, onChange }: { active: Panel; onChange: (p: Panel) => void }) {
  const items: { id: Panel; icon: string; label: string }[] = [
    { id: "chats", icon: "MessageSquare", label: "Чаты" },
    { id: "search", icon: "Search", label: "Поиск" },
    { id: "archive", icon: "Archive", label: "Архив" },
    { id: "profile", icon: "User", label: "Профиль" },
    { id: "settings", icon: "Settings", label: "Настройки" },
  ];
  return (
    <nav className="flex flex-col items-center gap-1 py-4">
      {items.map((item) => (
        <button key={item.id} onClick={() => onChange(item.id)} title={item.label}
          className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${active === item.id ? "bg-[var(--cipher-accent)]/15 text-[var(--cipher-accent)]" : "text-[var(--cipher-muted)] hover:text-[var(--cipher-text)] hover:bg-[var(--cipher-surface2)]"}`}>
          <Icon name={item.icon} size={22} />
          {active === item.id && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[var(--cipher-accent)] rounded-r-full" />}
        </button>
      ))}
    </nav>
  );
}

// ─── Chat List ────────────────────────────────────────────────────────────────

function ChatList({ chats, activeId, me, onSelect }: { chats: Chat[]; activeId: number | null; me: User; onSelect: (id: number) => void }) {
  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-[var(--cipher-muted)]">
        <Icon name="MessageSquare" size={28} />
        <p className="text-sm">Нет чатов</p>
        <p className="text-xs text-center px-4">Найдите собеседника через поиск</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 px-2">
      {chats.map((c, i) => (
        <button key={c.id} onClick={() => onSelect(c.id)}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 animate-fade-in ${activeId === c.id ? "bg-[var(--cipher-surface2)] border border-[var(--cipher-border)]" : "hover:bg-[var(--cipher-surface2)]/60"}`}
          style={{ animationDelay: `${i * 30}ms` }}>
          <Avatar initials={getChatInitials(c, me)} status={getChatStatus(c, me)} />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-sm text-[var(--cipher-text)] truncate">{getChatName(c, me)}</span>
              <span className="text-[10px] text-[var(--cipher-muted)] ml-2 flex-shrink-0">{c.last_msg_at ? formatTime(c.last_msg_at) : ""}</span>
            </div>
            <p className="text-xs text-[var(--cipher-muted)] truncate mt-0.5">{c.last_msg || "Нет сообщений"}</p>
          </div>
          {c.unread > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1 rounded-full bg-[var(--cipher-accent)] flex items-center justify-center text-[10px] font-bold text-[var(--cipher-bg)]">
              {c.unread > 99 ? "99+" : c.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Chat Window ──────────────────────────────────────────────────────────────

function ChatWindow({ chat, me, onChatUpdate }: { chat: Chat; me: User; onChatUpdate: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = useCallback(async (initial = false) => {
    try {
      const res = await messagesApi.get(chat.id, initial ? undefined : (lastIdRef.current || undefined));
      if (res.messages && res.messages.length > 0) {
        if (initial) {
          setMessages(res.messages);
          lastIdRef.current = res.messages[res.messages.length - 1].id;
        } else {
          setMessages((prev) => {
            const ids = new Set(prev.map((m: Message) => m.id));
            const newMsgs = res.messages.filter((m: Message) => !ids.has(m.id));
            if (newMsgs.length > 0) {
              lastIdRef.current = newMsgs[newMsgs.length - 1].id;
              return [...prev, ...newMsgs];
            }
            return prev;
          });
        }
      }
    } catch { /* silent */ }
    if (initial) setLoading(false);
  }, [chat.id]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    lastIdRef.current = 0;
    loadMessages(true);
    pollRef.current = setInterval(() => loadMessages(false), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [chat.id, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await messagesApi.send(chat.id, text);
      if (res.message) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m: Message) => m.id));
          if (!ids.has(res.message.id)) {
            lastIdRef.current = res.message.id;
            return [...prev, res.message];
          }
          return prev;
        });
        onChatUpdate();
      }
    } catch { setInput(text); }
    finally { setSending(false); }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(chat.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const chatName = getChatName(chat, me);
  const chatStatus = getChatStatus(chat, me);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--cipher-border)]">
        <div className="flex items-center gap-3">
          <Avatar initials={getChatInitials(chat, me)} status={chatStatus} />
          <div>
            <div className="font-semibold text-[var(--cipher-text)]">{chatName}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs ${chatStatus === "online" ? "text-green-400" : chatStatus === "away" ? "text-amber-400" : "text-[var(--cipher-muted)]"}`}>
                {chatStatus === "online" ? "в сети" : chatStatus === "away" ? "отошёл" : chatStatus === "group" ? `${chat.members.length} участников` : "не в сети"}
              </span>
              <EncryptBadge />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setInviteOpen(true)} className="p-2 rounded-lg text-[var(--cipher-muted)] hover:text-[var(--cipher-accent)] hover:bg-[var(--cipher-surface2)] transition-all" title="Пригласить">
            <Icon name="UserPlus" size={18} />
          </button>
          <button className="p-2 rounded-lg text-[var(--cipher-muted)] hover:text-[var(--cipher-text)] hover:bg-[var(--cipher-surface2)] transition-all">
            <Icon name="MoreVertical" size={18} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 py-1.5 text-[11px] text-[var(--cipher-muted)] border-b border-[var(--cipher-border)]/50 bg-[var(--cipher-surface)]/30">
        <Icon name="ShieldCheck" size={12} />
        Сквозное шифрование активно — только вы читаете эти сообщения
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Spinner size={28} /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-[var(--cipher-muted)]">
            <Icon name="MessageCircle" size={32} />
            <p className="text-sm">Начните общение</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.is_mine ? "justify-end" : "justify-start"} animate-message-in`}>
              {!msg.is_mine && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--cipher-accent-dim)] to-[var(--cipher-encrypted)] flex items-center justify-center text-white text-[10px] font-bold mr-2 mt-1 flex-shrink-0">
                  {getInitials(msg.sender_name)}
                </div>
              )}
              <div className={`max-w-[70%] ${msg.is_mine ? "message-bubble-mine" : "message-bubble-other"} px-4 py-2.5 text-sm leading-relaxed`}>
                {!msg.is_mine && chat.type === "group" && (
                  <p className="text-[11px] font-semibold text-[var(--cipher-accent)] mb-1">{msg.sender_name}</p>
                )}
                <p>{msg.text}</p>
                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${msg.is_mine ? "text-[var(--cipher-bg)]/60" : "text-[var(--cipher-muted)]"}`}>
                  {msg.edited_at && <span>(изм.)</span>}
                  <Icon name="Lock" size={9} />
                  <span>{formatTime(msg.created_at)}</span>
                  {msg.is_mine && <Icon name="CheckCheck" size={11} />}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--cipher-border)]">
        <div className="flex items-center gap-2 bg-[var(--cipher-surface2)] rounded-2xl px-4 py-2 border border-[var(--cipher-border)]">
          <button className="text-[var(--cipher-muted)] hover:text-[var(--cipher-accent)] transition-colors flex-shrink-0">
            <Icon name="Paperclip" size={18} />
          </button>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cipher-muted)] text-[var(--cipher-text)]"
            placeholder="Сообщение зашифруется автоматически..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()} />
          <button onClick={send} disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-full bg-[var(--cipher-accent)] flex items-center justify-center text-[var(--cipher-bg)] disabled:opacity-40 hover:opacity-90 transition-all flex-shrink-0">
            {sending ? <Spinner size={14} /> : <Icon name="Send" size={15} />}
          </button>
        </div>
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setInviteOpen(false)}>
          <div className="glass-panel rounded-2xl p-6 w-80 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-1 text-[var(--cipher-text)]">Пригласить участника</h3>
            <p className="text-xs text-[var(--cipher-muted)] mb-4">Передайте код — он позволит войти в этот чат</p>
            <div className="bg-[var(--cipher-surface2)] rounded-xl px-4 py-3 text-xs text-[var(--cipher-muted)] border border-[var(--cipher-border)] font-mono break-all mb-3">{chat.invite_code}</div>
            <button onClick={copyInvite} className="w-full py-2.5 rounded-xl bg-[var(--cipher-accent)] text-[var(--cipher-bg)] font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
              <Icon name={copied ? "Check" : "Copy"} size={15} />
              {copied ? "Скопировано!" : "Скопировать код"}
            </button>
            <button onClick={() => setInviteOpen(false)} className="w-full mt-2 py-2 text-sm text-[var(--cipher-muted)] hover:text-[var(--cipher-text)] transition-colors">Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-[var(--cipher-surface2)] border border-[var(--cipher-border)] flex items-center justify-center">
        <Icon name="ShieldCheck" size={36} className="text-[var(--cipher-accent)]" />
      </div>
      <div className="text-center">
        <h2 className="font-semibold text-xl mb-1 text-[var(--cipher-text)]">Cipher</h2>
        <p className="text-sm text-[var(--cipher-muted)] max-w-xs">Выберите чат слева или начните новый разговор</p>
      </div>
      <button onClick={onSearch} className="flex items-center gap-2 text-sm bg-[var(--cipher-surface2)] border border-[var(--cipher-border)] px-4 py-2 rounded-full hover:border-[var(--cipher-accent)] transition-colors text-[var(--cipher-text)]">
        <Icon name="Search" size={14} />Найти собеседника
      </button>
    </div>
  );
}

// ─── Profile Panel ────────────────────────────────────────────────────────────

function ProfilePanel({ me, onUpdate }: { me: User; onUpdate: (u: User) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.display_name);
  const [bio, setBio] = useState(me.bio);
  const [saving, setSaving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"online" | "away" | "offline">((me.status as "online" | "away" | "offline") || "online");

  const save = async () => {
    setSaving(true);
    try {
      const res = await authApi.updateProfile({ display_name: name, bio, status: selectedStatus });
      onUpdate(res.user);
      setEditing(false);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-5 p-5 animate-fade-in">
      <div className="flex flex-col items-center gap-3 py-3">
        <div className="relative">
          <Avatar initials={getInitials(me.display_name)} size="lg" />
          <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--cipher-accent)] flex items-center justify-center">
            <Icon name="Camera" size={12} className="text-[var(--cipher-bg)]" />
          </button>
        </div>
        {editing ? (
          <div className="w-full space-y-2">
            <input className="w-full bg-[var(--cipher-surface2)] border border-[var(--cipher-accent)] rounded-xl px-3 py-2 text-sm outline-none text-[var(--cipher-text)] text-center" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea className="w-full bg-[var(--cipher-surface2)] border border-[var(--cipher-border)] rounded-xl px-3 py-2 text-sm outline-none text-[var(--cipher-text)] resize-none" rows={2} placeholder="О себе" value={bio} onChange={(e) => setBio(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-lg bg-[var(--cipher-accent)] text-[var(--cipher-bg)] text-sm font-semibold flex items-center justify-center gap-1">
                {saving ? <Spinner size={14} /> : <Icon name="Check" size={14} />} Сохранить
              </button>
              <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-lg bg-[var(--cipher-surface2)] text-[var(--cipher-muted)] text-sm">Отмена</button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h2 className="font-semibold text-xl text-[var(--cipher-text)]">{me.display_name}</h2>
            <p className="text-sm text-[var(--cipher-muted)]">{me.email || me.phone}</p>
            {me.bio && <p className="text-sm text-[var(--cipher-muted)] mt-1">{me.bio}</p>}
            <button onClick={() => setEditing(true)} className="mt-2 text-xs text-[var(--cipher-accent)] flex items-center gap-1 mx-auto">
              <Icon name="Pencil" size={11} />Редактировать
            </button>
          </div>
        )}
      </div>

      <div className="bg-[var(--cipher-surface)] rounded-xl p-4 border border-[var(--cipher-border)] space-y-1">
        <h3 className="text-xs font-semibold text-[var(--cipher-muted)] uppercase tracking-wider mb-2">Статус</h3>
        {(["online", "away", "offline"] as const).map((s) => (
          <button key={s} onClick={() => setSelectedStatus(s)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${selectedStatus === s ? "bg-[var(--cipher-surface2)] border border-[var(--cipher-border)]" : "hover:bg-[var(--cipher-surface2)]/50"}`}>
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s === "online" ? "bg-green-400" : s === "away" ? "bg-amber-400" : "bg-gray-500"}`} />
            <span className="text-sm text-[var(--cipher-text)]">{s === "online" ? "В сети" : s === "away" ? "Отошёл" : "Не в сети"}</span>
            {selectedStatus === s && <Icon name="Check" size={14} className="ml-auto text-[var(--cipher-accent)]" />}
          </button>
        ))}
        {selectedStatus !== me.status && (
          <button onClick={save} disabled={saving} className="w-full mt-2 py-2 rounded-lg bg-[var(--cipher-accent)] text-[var(--cipher-bg)] text-sm font-semibold flex items-center justify-center gap-1">
            {saving ? <Spinner size={14} /> : null} Обновить статус
          </button>
        )}
      </div>

      <div className="bg-[var(--cipher-surface)] rounded-xl p-4 border border-[var(--cipher-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="ShieldCheck" size={16} className="text-[var(--cipher-accent)]" />
          <span className="text-sm text-[var(--cipher-text)]">Сквозное шифрование</span>
        </div>
        <span className="text-xs text-green-400 font-semibold">Активно</span>
      </div>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({ me, onUpdate, onLogout }: { me: User; onUpdate: (u: User) => void; onLogout: () => void }) {
  const [tab, setTab] = useState<SettingsTab>("privacy");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    read_receipts: me.read_receipts,
    show_online_status: me.show_online_status,
    two_factor_enabled: me.two_factor_enabled,
    screen_capture: me.screen_capture,
    notify_messages: me.notify_messages,
    notify_sound: me.notify_sound,
    notify_preview: me.notify_preview,
  });

  const toggle = async (k: keyof typeof settings) => {
    const updated = { ...settings, [k]: !settings[k] };
    setSettings(updated);
    setSaving(true);
    try {
      const res = await authApi.updateProfile(updated);
      onUpdate(res.user);
    } catch { setSettings(settings); }
    finally { setSaving(false); }
  };

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: "privacy", label: "Приватность", icon: "Shield" },
    { id: "notifications", label: "Уведомления", icon: "Bell" },
    { id: "account", label: "Аккаунт", icon: "UserCog" },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-semibold text-lg text-[var(--cipher-text)]">Настройки</h2>
        {saving && <Spinner size={16} />}
      </div>
      <div className="flex gap-1 bg-[var(--cipher-surface2)] rounded-xl p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? "bg-[var(--cipher-accent)] text-[var(--cipher-bg)]" : "text-[var(--cipher-muted)] hover:text-[var(--cipher-text)]"}`}>
            <Icon name={t.icon} size={13} />{t.label}
          </button>
        ))}
      </div>

      {tab === "privacy" && (
        <div className="bg-[var(--cipher-surface)] rounded-xl border border-[var(--cipher-border)] divide-y divide-[var(--cipher-border)] animate-fade-in">
          {[
            { key: "read_receipts" as const, label: "Уведомления о прочтении", desc: "Показывать галочки прочтения" },
            { key: "show_online_status" as const, label: "Статус онлайн", desc: "Показывать другим ваш статус" },
            { key: "two_factor_enabled" as const, label: "Двухфакторная защита", desc: "Дополнительный пароль при входе" },
            { key: "screen_capture" as const, label: "Скриншоты", desc: "Разрешить снимки экрана в чатах" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between px-4 py-3.5">
              <div><div className="text-sm text-[var(--cipher-text)]">{item.label}</div><div className="text-xs text-[var(--cipher-muted)]">{item.desc}</div></div>
              <Toggle on={settings[item.key]} onToggle={() => toggle(item.key)} />
            </div>
          ))}
        </div>
      )}

      {tab === "notifications" && (
        <div className="bg-[var(--cipher-surface)] rounded-xl border border-[var(--cipher-border)] divide-y divide-[var(--cipher-border)] animate-fade-in">
          {[
            { key: "notify_messages" as const, label: "Новые сообщения", desc: "Push-уведомления при получении" },
            { key: "notify_sound" as const, label: "Звук уведомлений", desc: "Воспроизводить звук" },
            { key: "notify_preview" as const, label: "Предпросмотр текста", desc: "Показывать текст в уведомлении" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between px-4 py-3.5">
              <div><div className="text-sm text-[var(--cipher-text)]">{item.label}</div><div className="text-xs text-[var(--cipher-muted)]">{item.desc}</div></div>
              <Toggle on={settings[item.key]} onToggle={() => toggle(item.key)} />
            </div>
          ))}
        </div>
      )}

      {tab === "account" && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <div className="bg-[var(--cipher-surface)] rounded-xl border border-[var(--cipher-border)] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--cipher-border)]/50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--cipher-accent-dim)] to-[var(--cipher-encrypted)] flex items-center justify-center text-white text-xs font-bold">
                {getInitials(me.display_name)}
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--cipher-text)]">{me.display_name}</div>
                <div className="text-xs text-[var(--cipher-muted)]">{me.email || me.phone}</div>
              </div>
            </div>
            {[{ icon: "Key", label: "Сменить пароль" }, { icon: "Smartphone", label: "Связанные устройства" }, { icon: "Download", label: "Экспорт данных" }].map((item) => (
              <button key={item.label} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--cipher-surface2)]/60 transition-colors text-left border-b border-[var(--cipher-border)]/50 last:border-0">
                <Icon name={item.icon} size={16} className="text-[var(--cipher-muted)]" />
                <span className="text-sm text-[var(--cipher-text)]">{item.label}</span>
                <Icon name="ChevronRight" size={14} className="ml-auto text-[var(--cipher-muted)]" />
              </button>
            ))}
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-colors">
            <Icon name="LogOut" size={16} />
            <span className="text-sm">Выйти из аккаунта</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Search Panel ─────────────────────────────────────────────────────────────

function SearchPanel({ me, onChatOpen }: { me: User; onChatOpen: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await chatsApi.search(query);
        setResults(res.users || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }, 400);
  }, [query]);

  const openChat = async (user: ChatMember) => {
    try {
      const res = await chatsApi.create({ type: "direct", partner_id: user.id });
      onChatOpen(res.chat_id);
    } catch { /* silent */ }
  };

  const joinByCode = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError("");
    try {
      const res = await chatsApi.join(joinCode.trim());
      onChatOpen(res.chat_id);
      setJoinCode("");
    } catch (e: unknown) {
      setJoinError(e instanceof Error ? e.message : "Не найдено");
    } finally { setJoining(false); }
  };

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in">
      <h2 className="font-semibold text-lg px-1 text-[var(--cipher-text)]">Поиск</h2>

      <div className="flex items-center gap-2 bg-[var(--cipher-surface2)] rounded-xl px-3 py-2.5 border border-[var(--cipher-border)]">
        <Icon name="Search" size={16} className="text-[var(--cipher-muted)]" />
        <input autoFocus className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cipher-muted)] text-[var(--cipher-text)]"
          placeholder="Имя, email или телефон..."
          value={query} onChange={(e) => setQuery(e.target.value)} />
        {loading ? <Spinner size={14} /> : query ? <button onClick={() => setQuery("")} className="text-[var(--cipher-muted)]"><Icon name="X" size={14} /></button> : null}
      </div>

      {query && (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-[var(--cipher-muted)] px-2 mb-1">{results.length} пользователей</p>
          {results.length === 0 && !loading && (
            <div className="flex flex-col items-center gap-2 py-6 text-[var(--cipher-muted)]">
              <Icon name="SearchX" size={24} /><span className="text-sm">Никого не найдено</span>
            </div>
          )}
          {results.map((u) => (
            <button key={u.id} onClick={() => openChat(u)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--cipher-surface2)] transition-all text-left">
              <Avatar initials={getInitials(u.display_name)} status={u.status} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-[var(--cipher-text)] truncate">{u.display_name}</div>
                <p className="text-xs text-[var(--cipher-muted)]">{u.status === "online" ? "в сети" : "не в сети"}</p>
              </div>
              <Icon name="MessageCircle" size={16} className="text-[var(--cipher-accent)]" />
            </button>
          ))}
        </div>
      )}

      <div className="bg-[var(--cipher-surface)] rounded-xl p-4 border border-[var(--cipher-border)]">
        <h3 className="text-xs font-semibold text-[var(--cipher-muted)] uppercase tracking-wider mb-3">Вступить по коду</h3>
        <div className="flex gap-2">
          <input className="flex-1 bg-[var(--cipher-surface2)] border border-[var(--cipher-border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--cipher-accent)] transition-colors text-[var(--cipher-text)] placeholder:text-[var(--cipher-muted)] font-mono"
            placeholder="Код приглашения..." value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
            onKeyDown={(e) => e.key === "Enter" && joinByCode()} />
          <button onClick={joinByCode} disabled={!joinCode.trim() || joining}
            className="px-4 py-2 rounded-xl bg-[var(--cipher-accent)] text-[var(--cipher-bg)] text-sm font-semibold disabled:opacity-50 flex items-center gap-1">
            {joining ? <Spinner size={14} /> : <Icon name="ArrowRight" size={15} />}
          </button>
        </div>
        {joinError && <p className="text-xs text-red-400 mt-2">{joinError}</p>}
      </div>

      <CreateGroupButton onCreated={onChatOpen} />
    </div>
  );
}

function CreateGroupButton({ onCreated }: { onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await chatsApi.create({ type: "group", name: name.trim() });
      onCreated(res.chat_id);
      setOpen(false);
      setName("");
    } catch { /* silent */ }
    finally { setCreating(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--cipher-surface)] border border-[var(--cipher-border)] hover:border-[var(--cipher-accent)]/50 transition-colors text-[var(--cipher-text)]">
        <div className="w-8 h-8 rounded-full bg-[var(--cipher-encrypted)]/20 flex items-center justify-center"><Icon name="Users" size={15} className="text-[var(--cipher-encrypted)]" /></div>
        <div><div className="text-sm font-semibold">Создать группу</div><div className="text-xs text-[var(--cipher-muted)]">Общий чат для нескольких участников</div></div>
      </button>
    );
  }

  return (
    <div className="bg-[var(--cipher-surface)] rounded-xl p-4 border border-[var(--cipher-border)]">
      <h3 className="text-xs font-semibold text-[var(--cipher-muted)] uppercase tracking-wider mb-3">Новая группа</h3>
      <div className="flex gap-2">
        <input className="flex-1 bg-[var(--cipher-surface2)] border border-[var(--cipher-border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--cipher-accent)] transition-colors text-[var(--cipher-text)] placeholder:text-[var(--cipher-muted)]"
          placeholder="Название группы" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()} />
        <button onClick={create} disabled={!name.trim() || creating}
          className="px-4 py-2 rounded-xl bg-[var(--cipher-accent)] text-[var(--cipher-bg)] text-sm font-semibold disabled:opacity-50">
          {creating ? <Spinner size={14} /> : "Создать"}
        </button>
      </div>
      <button onClick={() => setOpen(false)} className="mt-2 text-xs text-[var(--cipher-muted)] hover:text-[var(--cipher-text)]">Отмена</button>
    </div>
  );
}

// ─── Archive Panel ────────────────────────────────────────────────────────────

function ArchivePanel({ me, onSelect, refresh }: { me: User; onSelect: (id: number) => void; refresh: number }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await chatsApi.list(true);
        setChats(res.chats || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [refresh]);

  const unarchive = async (chatId: number) => {
    await chatsApi.archive(chatId, false);
    setChats((prev) => prev.filter((c) => c.id !== chatId));
  };

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in">
      <h2 className="font-semibold text-lg px-1 text-[var(--cipher-text)]">Архив</h2>
      {loading ? (
        <div className="flex justify-center py-10"><Spinner size={24} /></div>
      ) : chats.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-[var(--cipher-muted)]">
          <Icon name="Archive" size={32} /><p className="text-sm">Архив пуст</p>
        </div>
      ) : (
        <div className="bg-[var(--cipher-surface)] rounded-xl border border-[var(--cipher-border)] overflow-hidden">
          {chats.map((c, i) => (
            <div key={c.id} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-[var(--cipher-border)]/50" : ""}`}>
              <button onClick={() => onSelect(c.id)} className="flex items-center gap-3 flex-1 text-left hover:opacity-80">
                <Avatar initials={getChatInitials(c, me)} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[var(--cipher-text)] truncate">{getChatName(c, me)}</div>
                  <p className="text-xs text-[var(--cipher-muted)] truncate">{c.last_msg || "Нет сообщений"}</p>
                </div>
              </button>
              <button onClick={() => unarchive(c.id)} title="Разархивировать" className="p-2 rounded-lg text-[var(--cipher-muted)] hover:text-[var(--cipher-accent)] hover:bg-[var(--cipher-surface2)] transition-all">
                <Icon name="ArchiveRestore" size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Index() {
  const [me, setMe] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>("chats");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatRefresh, setChatRefresh] = useState(0);
  const [archiveRefresh, setArchiveRefresh] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("cipher_token");
    if (!token) { setAuthLoading(false); return; }
    authApi.me()
      .then((res) => setMe(res.user))
      .catch(() => localStorage.removeItem("cipher_token"))
      .finally(() => setAuthLoading(false));
  }, []);

  const loadChats = useCallback(async () => {
    try {
      const res = await chatsApi.list(false);
      setChats(res.chats || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!me) return;
    setChatsLoading(true);
    loadChats().finally(() => setChatsLoading(false));
    pollRef.current = setInterval(loadChats, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [me, loadChats, chatRefresh]);

  const handleAuth = (_token: string, user: User) => setMe(user);

  const handleLogout = async () => {
    await authApi.logout();
    localStorage.removeItem("cipher_token");
    setMe(null);
    setChats([]);
    setActiveChat(null);
  };

  const handleChatOpen = (id: number) => {
    setActiveChat(id);
    setPanel("chats");
    setChatRefresh((n) => n + 1);
  };

  const handleArchiveOpen = (id: number) => {
    setActiveChat(id);
    setPanel("chats");
    setArchiveRefresh((n) => n + 1);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--cipher-bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--cipher-accent)] flex items-center justify-center">
            <Icon name="ShieldCheck" size={24} className="text-[var(--cipher-bg)]" />
          </div>
          <Spinner size={24} />
        </div>
      </div>
    );
  }

  if (!me) return <AuthPage onAuth={handleAuth} />;

  const activeChatObj = chats.find((c) => c.id === activeChat) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--cipher-bg)] font-golos">
      {/* Icon Rail */}
      <aside className="w-16 flex-shrink-0 flex flex-col items-center justify-between border-r border-[var(--cipher-border)] bg-[var(--cipher-surface)]">
        <div className="pt-4 pb-2 flex flex-col items-center gap-1">
          <div className="w-9 h-9 rounded-xl bg-[var(--cipher-accent)] flex items-center justify-center">
            <Icon name="ShieldCheck" size={18} className="text-[var(--cipher-bg)]" />
          </div>
          <span className="text-[8px] font-bold text-[var(--cipher-accent)] tracking-widest uppercase">CIPHER</span>
        </div>
        <SidebarNav active={panel} onChange={setPanel} />
        <div className="pb-4">
          <button onClick={() => setPanel("profile")} className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--cipher-accent-dim)] to-[var(--cipher-encrypted)] flex items-center justify-center text-white text-xs font-bold" title={me.display_name}>
            {getInitials(me.display_name)}
          </button>
        </div>
      </aside>

      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-[var(--cipher-border)] bg-[var(--cipher-surface)] overflow-hidden">
        {panel === "chats" && (
          <>
            <div className="px-4 pt-5 pb-3">
              <div className="flex items-center justify-between mb-4">
                <h1 className="font-semibold text-lg text-[var(--cipher-text)]">Сообщения</h1>
                <button onClick={() => setPanel("search")} className="p-1.5 rounded-lg hover:bg-[var(--cipher-surface2)] text-[var(--cipher-muted)] hover:text-[var(--cipher-accent)] transition-all" title="Новый чат">
                  <Icon name="PenSquare" size={17} />
                </button>
              </div>
              <div className="flex items-center gap-2 bg-[var(--cipher-surface2)] rounded-xl px-3 py-2 border border-[var(--cipher-border)]">
                <Icon name="Search" size={14} className="text-[var(--cipher-muted)]" />
                <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cipher-muted)] text-[var(--cipher-text)]" placeholder="Поиск..." />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pb-3">
              {chatsLoading && chats.length === 0 ? (
                <div className="flex justify-center py-10"><Spinner size={24} /></div>
              ) : (
                <ChatList chats={chats} activeId={activeChat} me={me} onSelect={setActiveChat} />
              )}
            </div>
          </>
        )}
        {panel === "profile" && <div className="flex-1 overflow-y-auto"><ProfilePanel me={me} onUpdate={setMe} /></div>}
        {panel === "settings" && <div className="flex-1 overflow-y-auto"><SettingsPanel me={me} onUpdate={setMe} onLogout={handleLogout} /></div>}
        {panel === "search" && <div className="flex-1 overflow-y-auto"><SearchPanel me={me} onChatOpen={handleChatOpen} /></div>}
        {panel === "archive" && <div className="flex-1 overflow-y-auto"><ArchivePanel me={me} onSelect={handleArchiveOpen} refresh={archiveRefresh} /></div>}
      </div>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--cipher-bg)]">
        {activeChatObj ? (
          <ChatWindow key={activeChatObj.id} chat={activeChatObj} me={me} onChatUpdate={loadChats} />
        ) : (
          <EmptyState onSearch={() => setPanel("search")} />
        )}
      </main>
    </div>
  );
}
