CREATE TABLE t_p54251854_simple_messenger_pro.sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p54251854_simple_messenger_pro.users(id),
    token VARCHAR(128) UNIQUE NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON t_p54251854_simple_messenger_pro.sessions(token);
CREATE INDEX idx_sessions_user_id ON t_p54251854_simple_messenger_pro.sessions(user_id)
