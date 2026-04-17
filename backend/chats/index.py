"""
Управление чатами: список чатов пользователя, создание чата,
получение участников, архивирование, поиск пользователей, система приглашений.
Все действия через поле action в теле POST-запроса, или GET с параметром action.
"""
import json
import os
import secrets
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p54251854_simple_messenger_pro")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-User-Id",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_user_by_token(conn, token: str):
    cur = conn.cursor()
    cur.execute(
        f"""SELECT u.id, u.display_name, u.email, u.phone, u.username, u.avatar_url, u.status
            FROM {SCHEMA}.sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token = %s AND s.expires_at > NOW()""",
        (token,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return dict(zip(["id","display_name","email","phone","username","avatar_url","status"], row))


def ok(data: dict) -> dict:
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(data)}


def err(code: int, msg: str) -> dict:
    return {"statusCode": code, "headers": CORS, "body": json.dumps({"error": msg})}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    token = (event.get("headers") or {}).get("X-Auth-Token") or (event.get("headers") or {}).get("x-auth-token")
    action = body.get("action") or qs.get("action", "")
    conn = get_conn()

    try:
        me = get_user_by_token(conn, token) if token else None
        if not me:
            return err(401, "Нет доступа")

        cur = conn.cursor()

        # GET list — список чатов
        if method == "GET" and action == "list":
            archived_only = qs.get("archived") == "true"
            cur.execute(
                f"""
                SELECT c.id, c.type, c.name, c.avatar_url, c.description,
                       c.invite_code, c.encrypted, c.updated_at, cm.is_archived,
                       (SELECT COUNT(*) FROM {SCHEMA}.messages m
                        WHERE m.chat_id = c.id AND m.is_removed = FALSE
                          AND m.created_at > cm.last_read_at) AS unread,
                       (SELECT m2.text FROM {SCHEMA}.messages m2
                        WHERE m2.chat_id = c.id AND m2.is_removed = FALSE
                        ORDER BY m2.created_at DESC LIMIT 1) AS last_msg,
                       (SELECT m2.created_at FROM {SCHEMA}.messages m2
                        WHERE m2.chat_id = c.id AND m2.is_removed = FALSE
                        ORDER BY m2.created_at DESC LIMIT 1) AS last_msg_at
                FROM {SCHEMA}.chats c
                JOIN {SCHEMA}.chat_members cm ON cm.chat_id = c.id AND cm.user_id = %s
                WHERE cm.is_archived = %s
                ORDER BY COALESCE(last_msg_at, c.updated_at) DESC
                """,
                (me["id"], archived_only),
            )
            rows = cur.fetchall()
            chats = []
            for r in rows:
                chat_id = r[0]
                cur.execute(
                    f"""SELECT u.id, u.display_name, u.avatar_url, u.status
                        FROM {SCHEMA}.chat_members cm
                        JOIN {SCHEMA}.users u ON u.id = cm.user_id
                        WHERE cm.chat_id = %s""",
                    (chat_id,),
                )
                members = [dict(zip(["id","display_name","avatar_url","status"], m)) for m in cur.fetchall()]
                chats.append({
                    "id": r[0], "type": r[1], "name": r[2], "avatar_url": r[3],
                    "description": r[4], "invite_code": r[5], "encrypted": r[6],
                    "updated_at": str(r[7]) if r[7] else None,
                    "is_archived": r[8], "unread": int(r[9] or 0),
                    "last_msg": r[10], "last_msg_at": str(r[11]) if r[11] else None,
                    "members": members,
                })
            return ok({"chats": chats})

        # GET search — поиск пользователей
        if method == "GET" and action == "search":
            q = qs.get("q", "").strip()
            if not q:
                return ok({"users": []})
            like = f"%{q}%"
            cur.execute(
                f"""SELECT id, display_name, email, phone, username, avatar_url, status
                    FROM {SCHEMA}.users
                    WHERE id != %s AND (
                        display_name ILIKE %s OR email ILIKE %s OR phone ILIKE %s OR username ILIKE %s
                    ) LIMIT 20""",
                (me["id"], like, like, like, like),
            )
            users = [dict(zip(["id","display_name","email","phone","username","avatar_url","status"], r)) for r in cur.fetchall()]
            return ok({"users": users})

        # POST create — создать чат
        if method == "POST" and action == "create":
            chat_type = body.get("type", "direct")
            name = body.get("name", "").strip()
            partner_id = body.get("partner_id")

            if chat_type == "direct" and partner_id:
                cur.execute(
                    f"""SELECT c.id FROM {SCHEMA}.chats c
                        JOIN {SCHEMA}.chat_members cm1 ON cm1.chat_id=c.id AND cm1.user_id=%s
                        JOIN {SCHEMA}.chat_members cm2 ON cm2.chat_id=c.id AND cm2.user_id=%s
                        WHERE c.type='direct'""",
                    (me["id"], partner_id),
                )
                existing = cur.fetchone()
                if existing:
                    return ok({"chat_id": existing[0], "existing": True})

            invite = secrets.token_hex(16)
            cur.execute(
                f"INSERT INTO {SCHEMA}.chats (type, name, created_by, invite_code) VALUES (%s,%s,%s,%s) RETURNING id",
                (chat_type, name or None, me["id"], invite),
            )
            chat_id = cur.fetchone()[0]
            cur.execute(
                f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id, role) VALUES (%s,%s,'admin')",
                (chat_id, me["id"]),
            )
            if partner_id:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                    (chat_id, int(partner_id)),
                )
            conn.commit()
            return ok({"chat_id": chat_id, "invite_code": invite})

        # POST join — вступить по коду приглашения
        if method == "POST" and action == "join":
            invite_code = body.get("invite_code", "").strip()
            cur.execute(f"SELECT id FROM {SCHEMA}.chats WHERE invite_code=%s", (invite_code,))
            row = cur.fetchone()
            if not row:
                return err(404, "Чат не найден")
            chat_id = row[0]
            cur.execute(
                f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                (chat_id, me["id"]),
            )
            conn.commit()
            return ok({"chat_id": chat_id})

        # POST archive — архивировать/разархивировать
        if method == "POST" and action == "archive":
            chat_id = body.get("chat_id")
            archived = body.get("archived", True)
            cur.execute(
                f"UPDATE {SCHEMA}.chat_members SET is_archived=%s WHERE chat_id=%s AND user_id=%s",
                (archived, chat_id, me["id"]),
            )
            conn.commit()
            return ok({"ok": True})

        return err(400, "Неизвестное действие")

    finally:
        conn.close()
