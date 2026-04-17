"""
Аутентификация: регистрация, вход, выход, профиль.
Поддерживает вход через email или номер телефона.
Все действия через поле action в теле запроса.
"""
import json
import os
import hashlib
import secrets
import re
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p54251854_simple_messenger_pro")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-User-Id",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()


def make_token() -> str:
    return secrets.token_hex(48)


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    return "+" + digits


def get_user_by_token(conn, token: str):
    cur = conn.cursor()
    cur.execute(
        f"""
        SELECT u.id, u.display_name, u.email, u.phone, u.username,
               u.avatar_url, u.status, u.bio,
               u.show_online_status, u.read_receipts, u.screen_capture,
               u.notify_messages, u.notify_sound, u.notify_preview,
               u.two_factor_enabled
        FROM {SCHEMA}.sessions s
        JOIN {SCHEMA}.users u ON u.id = s.user_id
        WHERE s.token = %s AND s.expires_at > NOW()
        """,
        (token,),
    )
    row = cur.fetchone()
    if not row:
        return None
    cols = ["id","display_name","email","phone","username","avatar_url","status","bio",
            "show_online_status","read_receipts","screen_capture",
            "notify_messages","notify_sound","notify_preview","two_factor_enabled"]
    return dict(zip(cols, row))


def ok(data: dict) -> dict:
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(data)}


def err(code: int, msg: str) -> dict:
    return {"statusCode": code, "headers": CORS, "body": json.dumps({"error": msg})}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    token = (event.get("headers") or {}).get("X-Auth-Token") or (event.get("headers") or {}).get("x-auth-token")
    action = body.get("action", "")
    conn = get_conn()

    try:
        # GET — проверка сессии
        if method == "GET":
            if not token:
                return err(401, "Нет токена")
            user = get_user_by_token(conn, token)
            if not user:
                return err(401, "Сессия истекла")
            cur = conn.cursor()
            cur.execute(f"UPDATE {SCHEMA}.sessions SET last_active_at=NOW() WHERE token=%s", (token,))
            conn.commit()
            return ok({"user": user})

        if method != "POST":
            return err(405, "Method not allowed")

        # register
        if action == "register":
            email = (body.get("email") or "").strip().lower()
            phone = (body.get("phone") or "").strip()
            name = (body.get("display_name") or "").strip()
            pwd = body.get("password", "")

            if not name:
                return err(400, "Укажите имя")
            if not pwd or len(pwd) < 6:
                return err(400, "Пароль минимум 6 символов")
            if not email and not phone:
                return err(400, "Укажите email или телефон")
            if phone:
                phone = normalize_phone(phone)

            cur = conn.cursor()
            if email:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
                if cur.fetchone():
                    return err(409, "Email уже занят")
            if phone:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE phone = %s", (phone,))
                if cur.fetchone():
                    return err(409, "Телефон уже занят")

            h = hash_password(pwd)
            cur.execute(
                f"INSERT INTO {SCHEMA}.users (email, phone, display_name, password_hash) VALUES (%s,%s,%s,%s) RETURNING id",
                (email or None, phone or None, name, h),
            )
            user_id = cur.fetchone()[0]
            tok = make_token()
            ip = ((event.get("requestContext") or {}).get("identity") or {}).get("sourceIp", "")
            ua = (event.get("headers") or {}).get("User-Agent", "")
            cur.execute(
                f"INSERT INTO {SCHEMA}.sessions (user_id, token, ip_address, user_agent) VALUES (%s,%s,%s,%s)",
                (user_id, tok, ip, ua),
            )
            cur.execute(f"UPDATE {SCHEMA}.users SET status='online', last_seen_at=NOW() WHERE id=%s", (user_id,))
            conn.commit()
            user = get_user_by_token(conn, tok)
            return ok({"token": tok, "user": user})

        # login
        if action == "login":
            identity = (body.get("identity") or "").strip()
            pwd = body.get("password", "")
            if not identity or not pwd:
                return err(400, "Введите логин и пароль")

            h = hash_password(pwd)
            cur = conn.cursor()
            if "@" in identity:
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.users WHERE email=%s AND password_hash=%s",
                    (identity.lower(), h),
                )
            else:
                phone = normalize_phone(identity)
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.users WHERE phone=%s AND password_hash=%s",
                    (phone, h),
                )
            row = cur.fetchone()
            if not row:
                return err(401, "Неверный логин или пароль")

            user_id = row[0]
            tok = make_token()
            ip = ((event.get("requestContext") or {}).get("identity") or {}).get("sourceIp", "")
            ua = (event.get("headers") or {}).get("User-Agent", "")
            cur.execute(
                f"INSERT INTO {SCHEMA}.sessions (user_id, token, ip_address, user_agent) VALUES (%s,%s,%s,%s)",
                (user_id, tok, ip, ua),
            )
            cur.execute(f"UPDATE {SCHEMA}.users SET status='online', last_seen_at=NOW() WHERE id=%s", (user_id,))
            conn.commit()
            user = get_user_by_token(conn, tok)
            return ok({"token": tok, "user": user})

        # logout
        if action == "logout":
            if token:
                cur = conn.cursor()
                cur.execute(f"SELECT user_id FROM {SCHEMA}.sessions WHERE token=%s", (token,))
                row = cur.fetchone()
                if row:
                    cur.execute(f"UPDATE {SCHEMA}.users SET status='offline', last_seen_at=NOW() WHERE id=%s", (row[0],))
                    cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at=NOW() WHERE token=%s", (token,))
                    conn.commit()
            return ok({"ok": True})

        # update_profile
        if action == "update_profile":
            if not token:
                return err(401, "Нет токена")
            user = get_user_by_token(conn, token)
            if not user:
                return err(401, "Сессия истекла")
            allowed = ["display_name","bio","status","show_online_status","read_receipts",
                       "screen_capture","notify_messages","notify_sound","notify_preview"]
            updates = {k: v for k, v in body.items() if k in allowed}
            if updates:
                cur = conn.cursor()
                sets = ", ".join(f"{k}=%s" for k in updates)
                vals = list(updates.values()) + [user["id"]]
                cur.execute(f"UPDATE {SCHEMA}.users SET {sets} WHERE id=%s", vals)
                conn.commit()
            updated = get_user_by_token(conn, token)
            return ok({"user": updated})

        return err(400, "Неизвестное действие")

    finally:
        conn.close()
