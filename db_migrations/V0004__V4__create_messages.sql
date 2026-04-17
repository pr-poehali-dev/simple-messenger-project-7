CREATE TABLE t_p54251854_simple_messenger_pro.messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES t_p54251854_simple_messenger_pro.chats(id),
    sender_id INTEGER NOT NULL REFERENCES t_p54251854_simple_messenger_pro.users(id),
    text TEXT NOT NULL,
    reply_to_id INTEGER REFERENCES t_p54251854_simple_messenger_pro.messages(id),
    is_removed BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_chat_id ON t_p54251854_simple_messenger_pro.messages(chat_id);
CREATE INDEX idx_messages_created_at ON t_p54251854_simple_messenger_pro.messages(created_at)
