CREATE TABLE t_p54251854_simple_messenger_pro.chats (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) DEFAULT 'direct',
    name VARCHAR(100),
    avatar_url TEXT,
    description TEXT,
    created_by INTEGER REFERENCES t_p54251854_simple_messenger_pro.users(id),
    invite_code VARCHAR(32) UNIQUE,
    is_archived BOOLEAN DEFAULT FALSE,
    encrypted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p54251854_simple_messenger_pro.chat_members (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES t_p54251854_simple_messenger_pro.chats(id),
    user_id INTEGER NOT NULL REFERENCES t_p54251854_simple_messenger_pro.users(id),
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT FALSE,
    UNIQUE(chat_id, user_id)
);

CREATE INDEX idx_chat_members_user_id ON t_p54251854_simple_messenger_pro.chat_members(user_id)
