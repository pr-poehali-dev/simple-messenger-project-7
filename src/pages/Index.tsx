import { useState } from "react";
import Icon from "@/components/ui/icon";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const CONTACTS = [
  { id: 1, name: "Алексей Громов", avatar: "АГ", status: "online", lastMsg: "Отправил документы, проверь", time: "14:32", unread: 2, archived: false },
  { id: 2, name: "Мария Соколова", avatar: "МС", status: "online", lastMsg: "Встреча в 18:00 подтверждена", time: "13:58", unread: 0, archived: false },
  { id: 3, name: "Команда Проект X", avatar: "КП", status: "group", lastMsg: "Дедлайн перенесли на пятницу", time: "12:15", unread: 7, archived: false },
  { id: 4, name: "Николай Петров", avatar: "НП", status: "away", lastMsg: "Буду после обеда", time: "11:40", unread: 0, archived: false },
  { id: 5, name: "Дизайн-студия", avatar: "ДС", status: "group", lastMsg: "Макеты готовы к ревью", time: "вчера", unread: 3, archived: false },
  { id: 6, name: "Ольга Ветрова", avatar: "ОВ", status: "offline", lastMsg: "Спасибо, всё отлично!", time: "вчера", unread: 0, archived: false },
  { id: 7, name: "Старый проект", avatar: "СП", status: "offline", lastMsg: "Архивировано", time: "3 нед", unread: 0, archived: true },
];

const MESSAGES: Record<number, { id: number; text: string; mine: boolean; time: string }[]> = {
  1: [
    { id: 1, text: "Привет! Как дела с контрактом?", mine: false, time: "14:20" },
    { id: 2, text: "Всё идёт по плану, финализируем детали", mine: true, time: "14:25" },
    { id: 3, text: "Отправил документы, проверь", mine: false, time: "14:32" },
  ],
  2: [
    { id: 1, text: "Подтверждаю встречу на 18:00", mine: true, time: "13:50" },
    { id: 2, text: "Встреча в 18:00 подтверждена", mine: false, time: "13:58" },
  ],
  3: [
    { id: 1, text: "Всем привет! Есть обновления по проекту", mine: false, time: "12:00" },
    { id: 2, text: "Дедлайн перенесли на пятницу", mine: false, time: "12:15" },
    { id: 3, text: "Хорошо, успеем", mine: true, time: "12:20" },
  ],
  4: [
    { id: 1, text: "Когда будешь доступен?", mine: true, time: "11:30" },
    { id: 2, text: "Буду после обеда", mine: false, time: "11:40" },
  ],
  5: [{ id: 1, text: "Макеты готовы к ревью", mine: false, time: "вчера" }],
  6: [{ id: 1, text: "Спасибо, всё отлично!", mine: false, time: "вчера" }],
};

type Panel = "chats" | "profile" | "settings" | "archive" | "search";
type SettingsTab = "privacy" | "notifications" | "account";

// ─── Status Dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: "bg-green-400 online-pulse",
    away: "bg-amber-400",
    offline: "bg-gray-600",
    group: "bg-[var(--cipher-encrypted)]",
  };
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full border-2 border-[var(--cipher-surface)] absolute bottom-0 right-0 ${colors[status] ?? "bg-gray-600"}`}
    />
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  initials,
  size = "md",
  status,
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  status?: string;
}) {
  const sizeMap = { sm: "w-8 h-8 text-xs", md: "w-11 h-11 text-sm", lg: "w-16 h-16 text-xl" };
  return (
    <div className={`relative flex-shrink-0 ${sizeMap[size]}`}>
      <div
        className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-[var(--cipher-accent-dim)] to-[var(--cipher-encrypted)] flex items-center justify-center font-semibold text-white`}
      >
        {initials}
      </div>
      {status && <StatusDot status={status} />}
    </div>
  );
}

// ─── Encrypt Badge ────────────────────────────────────────────────────────────

function EncryptBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--cipher-encrypted)]/15 border border-[var(--cipher-encrypted)]/30 text-[var(--cipher-encrypted)]">
      <Icon name="Lock" size={9} />
      E2E
    </span>
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
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          title={item.label}
          className={`group relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
            active === item.id
              ? "bg-[var(--cipher-accent)]/15 text-[var(--cipher-accent)]"
              : "text-[var(--cipher-muted)] hover:text-[var(--cipher-text)] hover:bg-[var(--cipher-surface2)]"
          }`}
        >
          <Icon name={item.icon} size={22} />
          {active === item.id && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[var(--cipher-accent)] rounded-r-full" />
          )}
        </button>
      ))}
    </nav>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 ${on ? "bg-[var(--cipher-accent)]" : "bg-[var(--cipher-surface2)] border border-[var(--cipher-border)]"}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow ${on ? "right-1" : "left-1"}`}
      />
    </button>
  );
}

// ─── Chat List ────────────────────────────────────────────────────────────────

function ChatList({
  chats,
  activeId,
  onSelect,
}: {
  chats: typeof CONTACTS;
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-2">
      {chats.map((c, i) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 animate-fade-in ${
            activeId === c.id
              ? "bg-[var(--cipher-surface2)] border border-[var(--cipher-border)]"
              : "hover:bg-[var(--cipher-surface2)]/60"
          }`}
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <Avatar initials={c.avatar} status={c.status} />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-sm text-[var(--cipher-text)] truncate">{c.name}</span>
              <span className="text-[10px] text-[var(--cipher-muted)] ml-2 flex-shrink-0">{c.time}</span>
            </div>
            <p className="text-xs text-[var(--cipher-muted)] truncate mt-0.5">{c.lastMsg}</p>
          </div>
          {c.unread > 0 && (
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--cipher-accent)] flex items-center justify-center text-[10px] font-bold text-[var(--cipher-bg)]">
              {c.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Chat Window ──────────────────────────────────────────────────────────────

function ChatWindow({ contact }: { contact: (typeof CONTACTS)[0] }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(MESSAGES[contact.id] ?? []);
  const [inviteOpen, setInviteOpen] = useState(false);

  const send = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: input.trim(),
        mine: true,
        time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--cipher-border)]">
        <div className="flex items-center gap-3">
          <Avatar initials={contact.avatar} status={contact.status} />
          <div>
            <div className="font-semibold text-[var(--cipher-text)]">{contact.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-xs ${
                  contact.status === "online"
                    ? "text-green-400"
                    : contact.status === "away"
                    ? "text-amber-400"
                    : "text-[var(--cipher-muted)]"
                }`}
              >
                {contact.status === "online"
                  ? "в сети"
                  : contact.status === "away"
                  ? "отошёл"
                  : contact.status === "group"
                  ? "группа"
                  : "не в сети"}
              </span>
              <EncryptBadge />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setInviteOpen(true)}
            className="p-2 rounded-lg text-[var(--cipher-muted)] hover:text-[var(--cipher-accent)] hover:bg-[var(--cipher-surface2)] transition-all"
            title="Пригласить участника"
          >
            <Icon name="UserPlus" size={18} />
          </button>
          <button className="p-2 rounded-lg text-[var(--cipher-muted)] hover:text-[var(--cipher-text)] hover:bg-[var(--cipher-surface2)] transition-all">
            <Icon name="Phone" size={18} />
          </button>
          <button className="p-2 rounded-lg text-[var(--cipher-muted)] hover:text-[var(--cipher-text)] hover:bg-[var(--cipher-surface2)] transition-all">
            <Icon name="MoreVertical" size={18} />
          </button>
        </div>
      </div>

      {/* E2E Notice */}
      <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-[var(--cipher-muted)] border-b border-[var(--cipher-border)]/50">
        <Icon name="ShieldCheck" size={12} />
        Сквозное шифрование активно — только вы читаете эти сообщения
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.mine ? "justify-end" : "justify-start"} animate-message-in`}>
            <div
              className={`max-w-[70%] px-4 py-2.5 text-sm leading-relaxed ${
                msg.mine ? "message-bubble-mine" : "message-bubble-other"
              }`}
            >
              <p>{msg.text}</p>
              <div
                className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                  msg.mine ? "text-[var(--cipher-bg)]/60" : "text-[var(--cipher-muted)]"
                }`}
              >
                <Icon name="Lock" size={9} />
                <span>{msg.time}</span>
                {msg.mine && <Icon name="CheckCheck" size={11} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--cipher-border)]">
        <div className="flex items-center gap-2 bg-[var(--cipher-surface2)] rounded-2xl px-4 py-2 border border-[var(--cipher-border)]">
          <button className="text-[var(--cipher-muted)] hover:text-[var(--cipher-accent)] transition-colors">
            <Icon name="Paperclip" size={18} />
          </button>
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cipher-muted)] text-[var(--cipher-text)]"
            placeholder="Сообщение зашифруется автоматически..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="text-[var(--cipher-muted)] hover:text-[var(--cipher-accent)] transition-colors">
            <Icon name="Smile" size={18} />
          </button>
          <button
            onClick={send}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-full bg-[var(--cipher-accent)] flex items-center justify-center text-[var(--cipher-bg)] disabled:opacity-40 hover:opacity-90 transition-all"
          >
            <Icon name="Send" size={15} />
          </button>
        </div>
      </div>

      {/* Invite Modal */}
      {inviteOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setInviteOpen(false)}
        >
          <div
            className="glass-panel rounded-2xl p-6 w-80 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-1 text-[var(--cipher-text)]">Пригласить участника</h3>
            <p className="text-xs text-[var(--cipher-muted)] mb-4">
              Отправьте ссылку для безопасного вступления в чат
            </p>
            <div className="bg-[var(--cipher-surface2)] rounded-xl px-4 py-3 text-xs text-[var(--cipher-muted)] border border-[var(--cipher-border)] font-mono break-all mb-3">
              cipher://invite/a8f2k9x3m1p7q4w5...
            </div>
            <button className="w-full py-2.5 rounded-xl bg-[var(--cipher-accent)] text-[var(--cipher-bg)] font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
              <Icon name="Copy" size={15} />
              Скопировать ссылку
            </button>
            <button
              onClick={() => setInviteOpen(false)}
              className="w-full mt-2 py-2 text-sm text-[var(--cipher-muted)] hover:text-[var(--cipher-text)] transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-[var(--cipher-surface2)] border border-[var(--cipher-border)] flex items-center justify-center">
        <Icon name="ShieldCheck" size={36} className="text-[var(--cipher-accent)]" />
      </div>
      <div className="text-center">
        <h2 className="font-semibold text-xl mb-1 text-[var(--cipher-text)]">Cipher</h2>
        <p className="text-sm text-[var(--cipher-muted)] max-w-xs">
          Выберите чат для общения.
          <br />
          Все сообщения защищены сквозным шифрованием.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--cipher-muted)] bg-[var(--cipher-surface2)] border border-[var(--cipher-border)] px-4 py-2 rounded-full">
        <Icon name="Lock" size={12} />
        <span>Конец-в-конец шифрование активно</span>
      </div>
    </div>
  );
}

// ─── Profile Panel ────────────────────────────────────────────────────────────

function ProfilePanel() {
  const [status, setStatus] = useState<"online" | "away" | "offline">("online");

  return (
    <div className="flex flex-col gap-5 p-5 animate-fade-in">
      <div className="flex flex-col items-center gap-3 py-3">
        <div className="relative">
          <Avatar initials="ВЫ" size="lg" />
          <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--cipher-accent)] flex items-center justify-center">
            <Icon name="Camera" size={12} className="text-[var(--cipher-bg)]" />
          </button>
        </div>
        <div className="text-center">
          <h2 className="font-semibold text-xl text-[var(--cipher-text)]">Мой профиль</h2>
          <p className="text-sm text-[var(--cipher-muted)]">@username</p>
        </div>
      </div>

      <div className="bg-[var(--cipher-surface)] rounded-xl p-4 border border-[var(--cipher-border)] space-y-1">
        <h3 className="text-xs font-semibold text-[var(--cipher-muted)] uppercase tracking-wider mb-2">Статус</h3>
        {(["online", "away", "offline"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              status === s
                ? "bg-[var(--cipher-surface2)] border border-[var(--cipher-border)]"
                : "hover:bg-[var(--cipher-surface2)]/50"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                s === "online" ? "bg-green-400" : s === "away" ? "bg-amber-400" : "bg-gray-500"
              }`}
            />
            <span className="text-sm text-[var(--cipher-text)]">
              {s === "online" ? "В сети" : s === "away" ? "Отошёл" : "Не в сети"}
            </span>
            {status === s && <Icon name="Check" size={14} className="ml-auto text-[var(--cipher-accent)]" />}
          </button>
        ))}
      </div>

      <div className="bg-[var(--cipher-surface)] rounded-xl p-4 border border-[var(--cipher-border)]">
        <h3 className="text-xs font-semibold text-[var(--cipher-muted)] uppercase tracking-wider mb-3">Информация</h3>
        {[
          { label: "Имя", value: "Иван Петрович" },
          { label: "Телефон", value: "+7 (900) 123-45-67" },
          { label: "О себе", value: "Использую Cipher" },
        ].map((f) => (
          <div
            key={f.label}
            className="flex justify-between items-center py-2.5 border-b border-[var(--cipher-border)]/50 last:border-0"
          >
            <span className="text-xs text-[var(--cipher-muted)]">{f.label}</span>
            <span className="text-sm text-[var(--cipher-text)]">{f.value}</span>
          </div>
        ))}
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

function SettingsPanel() {
  const [tab, setTab] = useState<SettingsTab>("privacy");
  const [s, setS] = useState({
    readReceipts: true,
    onlineStatus: true,
    twoFactor: false,
    screenCapture: true,
    msgNotify: true,
    soundNotify: true,
    previewNotify: false,
  });
  const toggle = (k: keyof typeof s) => setS((prev) => ({ ...prev, [k]: !prev[k] }));

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: "privacy", label: "Приватность", icon: "Shield" },
    { id: "notifications", label: "Уведомления", icon: "Bell" },
    { id: "account", label: "Аккаунт", icon: "UserCog" },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in">
      <h2 className="font-semibold text-lg px-1 text-[var(--cipher-text)]">Настройки</h2>

      <div className="flex gap-1 bg-[var(--cipher-surface2)] rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id
                ? "bg-[var(--cipher-accent)] text-[var(--cipher-bg)]"
                : "text-[var(--cipher-muted)] hover:text-[var(--cipher-text)]"
            }`}
          >
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "privacy" && (
        <div className="bg-[var(--cipher-surface)] rounded-xl border border-[var(--cipher-border)] divide-y divide-[var(--cipher-border)] animate-fade-in">
          {[
            { key: "readReceipts" as const, label: "Уведомления о прочтении", desc: "Показывать галочки прочтения" },
            { key: "onlineStatus" as const, label: "Статус онлайн", desc: "Показывать другим ваш статус" },
            { key: "twoFactor" as const, label: "Двухфакторная защита", desc: "Дополнительный пароль при входе" },
            { key: "screenCapture" as const, label: "Скриншоты", desc: "Разрешить снимки экрана в чатах" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between px-4 py-3.5">
              <div>
                <div className="text-sm text-[var(--cipher-text)]">{item.label}</div>
                <div className="text-xs text-[var(--cipher-muted)]">{item.desc}</div>
              </div>
              <Toggle on={s[item.key]} onToggle={() => toggle(item.key)} />
            </div>
          ))}
        </div>
      )}

      {tab === "notifications" && (
        <div className="bg-[var(--cipher-surface)] rounded-xl border border-[var(--cipher-border)] divide-y divide-[var(--cipher-border)] animate-fade-in">
          {[
            { key: "msgNotify" as const, label: "Новые сообщения", desc: "Push-уведомления при получении" },
            { key: "soundNotify" as const, label: "Звук уведомлений", desc: "Воспроизводить звук" },
            { key: "previewNotify" as const, label: "Предпросмотр текста", desc: "Показывать текст в уведомлении" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between px-4 py-3.5">
              <div>
                <div className="text-sm text-[var(--cipher-text)]">{item.label}</div>
                <div className="text-xs text-[var(--cipher-muted)]">{item.desc}</div>
              </div>
              <Toggle on={s[item.key]} onToggle={() => toggle(item.key)} />
            </div>
          ))}
        </div>
      )}

      {tab === "account" && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <div className="bg-[var(--cipher-surface)] rounded-xl border border-[var(--cipher-border)] overflow-hidden">
            {[
              { icon: "Key", label: "Сменить пароль" },
              { icon: "Smartphone", label: "Связанные устройства" },
              { icon: "Download", label: "Экспорт данных" },
            ].map((item) => (
              <button
                key={item.label}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--cipher-surface2)]/60 transition-colors text-left border-b border-[var(--cipher-border)]/50 last:border-0"
              >
                <Icon name={item.icon} size={16} className="text-[var(--cipher-muted)]" />
                <span className="text-sm text-[var(--cipher-text)]">{item.label}</span>
                <Icon name="ChevronRight" size={14} className="ml-auto text-[var(--cipher-muted)]" />
              </button>
            ))}
          </div>
          <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-colors">
            <Icon name="LogOut" size={16} />
            <span className="text-sm">Выйти из аккаунта</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Search Panel ─────────────────────────────────────────────────────────────

function SearchPanel({ onSelect }: { onSelect: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const results = CONTACTS.filter(
    (c) =>
      !c.archived &&
      (c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.lastMsg.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in">
      <h2 className="font-semibold text-lg px-1 text-[var(--cipher-text)]">Поиск</h2>
      <div className="flex items-center gap-2 bg-[var(--cipher-surface2)] rounded-xl px-3 py-2.5 border border-[var(--cipher-border)]">
        <Icon name="Search" size={16} className="text-[var(--cipher-muted)]" />
        <input
          autoFocus
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cipher-muted)] text-[var(--cipher-text)]"
          placeholder="Поиск контактов и сообщений..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="text-[var(--cipher-muted)] hover:text-[var(--cipher-text)] transition-colors"
          >
            <Icon name="X" size={14} />
          </button>
        )}
      </div>

      {query ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-[var(--cipher-muted)] px-2 mb-1">{results.length} результатов</p>
          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-[var(--cipher-muted)]">
              <Icon name="SearchX" size={28} />
              <span className="text-sm">Ничего не найдено</span>
            </div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--cipher-surface2)] transition-all text-left"
              >
                <Avatar initials={c.avatar} status={c.status} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[var(--cipher-text)] truncate">{c.name}</div>
                  <p className="text-xs text-[var(--cipher-muted)] truncate">{c.lastMsg}</p>
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-12 text-[var(--cipher-muted)] animate-fade-in">
          <Icon name="Search" size={32} />
          <p className="text-sm">Начните вводить имя или текст</p>
        </div>
      )}
    </div>
  );
}

// ─── Archive Panel ────────────────────────────────────────────────────────────

function ArchivePanel({ onSelect }: { onSelect: (id: number) => void }) {
  const archived = CONTACTS.filter((c) => c.archived);

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in">
      <h2 className="font-semibold text-lg px-1 text-[var(--cipher-text)]">Архив</h2>
      {archived.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-[var(--cipher-muted)]">
          <Icon name="Archive" size={32} />
          <p className="text-sm">Архив пуст</p>
        </div>
      ) : (
        <div className="bg-[var(--cipher-surface)] rounded-xl border border-[var(--cipher-border)] overflow-hidden">
          {archived.map((c, i) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--cipher-surface2)]/60 transition-all text-left ${
                i > 0 ? "border-t border-[var(--cipher-border)]/50" : ""
              }`}
            >
              <Avatar initials={c.avatar} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-[var(--cipher-text)]">{c.name}</div>
                <p className="text-xs text-[var(--cipher-muted)] truncate">{c.lastMsg}</p>
              </div>
              <Icon name="ArchiveRestore" size={15} className="text-[var(--cipher-muted)]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Index() {
  const [panel, setPanel] = useState<Panel>("chats");
  const [activeChat, setActiveChat] = useState<number | null>(null);

  const activeContact = CONTACTS.find((c) => c.id === activeChat);
  const visibleChats = CONTACTS.filter((c) => !c.archived);

  const handleSelect = (id: number) => {
    setActiveChat(id);
    setPanel("chats");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--cipher-bg)] font-golos">
      {/* ── Icon Rail ── */}
      <aside className="w-16 flex-shrink-0 flex flex-col items-center justify-between border-r border-[var(--cipher-border)] bg-[var(--cipher-surface)]">
        <div className="pt-4 pb-2 flex flex-col items-center gap-1">
          <div className="w-9 h-9 rounded-xl bg-[var(--cipher-accent)] flex items-center justify-center mb-1">
            <Icon name="ShieldCheck" size={18} className="text-[var(--cipher-bg)]" />
          </div>
          <span className="text-[8px] font-bold text-[var(--cipher-accent)] tracking-widest uppercase">
            CIPHER
          </span>
        </div>
        <SidebarNav active={panel} onChange={setPanel} />
        <div className="pb-4">
          <button className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--cipher-accent-dim)] to-[var(--cipher-encrypted)] flex items-center justify-center text-white text-xs font-bold shadow-lg">
            ВЫ
          </button>
        </div>
      </aside>

      {/* ── Left Panel ── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-[var(--cipher-border)] bg-[var(--cipher-surface)] overflow-hidden">
        {panel === "chats" && (
          <>
            <div className="px-4 pt-5 pb-3">
              <div className="flex items-center justify-between mb-4">
                <h1 className="font-semibold text-lg text-[var(--cipher-text)]">Сообщения</h1>
                <button className="p-1.5 rounded-lg hover:bg-[var(--cipher-surface2)] text-[var(--cipher-muted)] hover:text-[var(--cipher-text)] transition-all">
                  <Icon name="PenSquare" size={17} />
                </button>
              </div>
              <div className="flex items-center gap-2 bg-[var(--cipher-surface2)] rounded-xl px-3 py-2 border border-[var(--cipher-border)]">
                <Icon name="Search" size={14} className="text-[var(--cipher-muted)]" />
                <input
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cipher-muted)] text-[var(--cipher-text)]"
                  placeholder="Поиск..."
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pb-3">
              <ChatList chats={visibleChats} activeId={activeChat} onSelect={setActiveChat} />
            </div>
          </>
        )}
        {panel === "profile" && (
          <div className="flex-1 overflow-y-auto">
            <ProfilePanel />
          </div>
        )}
        {panel === "settings" && (
          <div className="flex-1 overflow-y-auto">
            <SettingsPanel />
          </div>
        )}
        {panel === "search" && (
          <div className="flex-1 overflow-y-auto">
            <SearchPanel onSelect={handleSelect} />
          </div>
        )}
        {panel === "archive" && (
          <div className="flex-1 overflow-y-auto">
            <ArchivePanel onSelect={handleSelect} />
          </div>
        )}
      </div>

      {/* ── Chat Area ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--cipher-bg)]">
        {activeContact ? <ChatWindow key={activeContact.id} contact={activeContact} /> : <EmptyState />}
      </main>
    </div>
  );
}
