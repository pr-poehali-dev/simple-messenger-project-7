"""
Сообщения: получение истории, отправка, редактирование.
Действия: get, send, edit.
"""
import json
import os
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
        f"""SELECT u.id, u.display_name, u.avatar_url, u.status
            FROM {SCHEMA}.sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token = %s AND s.expires_at > NOW()""",
        (token,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return dict(zip(["id","display_name","avatar_url","status"], row))


def check_member(conn, chat_id: int, user_id: int) -> bool:
    cur = conn.cursor()
    cur.execute(
        f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id=%s AND user_id=%s",
        (chat_id, user_id),
    )
    return cur.fetchone() is not None


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
    conn = get_conn()

    try:
        me = get_user_by_token(conn, token) if token else None
        if not me:
            return err(401, "Нет доступа")

        cur = conn.cursor()

        # GET — история сообщений
        if method == "GET":
            chat_id = int(qs.get("chat_id", 0))
            since_id = int(qs.get("since_id", 0))
            limit = min(int(qs.get("limit", 50)), 100)

            if not chat_id:
                return err(400, "Нет chat_id")
            if not check_member(conn, chat_id, me["id"]):
                return err(403, "Нет доступа к чату")

            if since_id:
                cur.execute(
                    f"""SELECT m.id, m.sender_id, u.display_name, u.avatar_url,
                               m.text, m.reply_to_id, m.is_removed, m.edited_at, m.created_at
                        FROM {SCHEMA}.messages m
                        JOIN {SCHEMA}.users u ON u.id = m.sender_id
                        WHERE m.chat_id=%s AND m.id > %s AND m.is_removed=FALSE
                        ORDER BY m.created_at ASC LIMIT %s""",
                    (chat_id, since_id, limit),
                )
            else:
                cur.execute(
                    f"""SELECT m.id, m.sender_id, u.display_name, u.avatar_url,
                               m.text, m.reply_to_id, m.is_removed, m.edited_at, m.created_at
                        FROM {SCHEMA}.messages m
                        JOIN {SCHEMA}.users u ON u.id = m.sender_id
                        WHERE m.chat_id=%s AND m.is_removed=FALSE
                        ORDER BY m.created_at DESC LIMIT %s""",
                    (chat_id, limit),
                )
            rows = cur.fetchall()
            msgs = []
            for r in rows:
                msgs.append({
                    "id": r[0], "sender_id": r[1], "sender_name": r[2],
                    "sender_avatar": r[3], "text": r[4], "reply_to_id": r[5],
                    "is_removed": r[6], "edited_at": str(r[7]) if r[7] else None,
                    "created_at": str(r[8]), "is_mine": r[1] == me["id"],
                })
            if not since_id:
                msgs = list(reversed(msgs))

            cur.execute(
                f"UPDATE {SCHEMA}.chat_members SET last_read_at=NOW() WHERE chat_id=%s AND user_id=%s",
                (chat_id, me["id"]),
            )
            conn.commit()
            return ok({"messages": msgs})

        # POST — отправить или редактировать
        if method == "POST":
            action = body.get("action", "send")

            if action == "send":
                chat_id = body.get("chat_id")
                text = (body.get("text") or "").strip()
                reply_to = body.get("reply_to_id")

                if not chat_id or not text:
                    return err(400, "Нет текста или chat_id")
                if not check_member(conn, chat_id, me["id"]):
                    return err(403, "Нет доступа к чату")

                cur.execute(
                    f"""INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text, reply_to_id)
                        VALUES (%s,%s,%s,%s) RETURNING id, created_at""",
                    (chat_id, me["id"], text, reply_to),
                )
                msg_id, created_at = cur.fetchone()
                cur.execute(f"UPDATE {SCHEMA}.chats SET updated_at=NOW() WHERE id=%s", (chat_id,))
                cur.execute(
                    f"UPDATE {SCHEMA}.chat_members SET last_read_at=NOW() WHERE chat_id=%s AND user_id=%s",
                    (chat_id, me["id"]),
                )
                conn.commit()
                return ok({
                    "message": {
                        "id": msg_id, "sender_id": me["id"], "sender_name": me["display_name"],
                        "sender_avatar": me.get("avatar_url"), "text": text,
                        "reply_to_id": reply_to, "is_removed": False,
                        "edited_at": None, "created_at": str(created_at), "is_mine": True,
                    }
                })

            if action == "edit":
                msg_id = body.get("msg_id")
                text = (body.get("text") or "").strip()
                if not text or not msg_id:
                    return err(400, "Нет текста или msg_id")
                cur.execute(f"SELECT sender_id FROM {SCHEMA}.messages WHERE id=%s", (msg_id,))
                row = cur.fetchone()
                if not row:
                    return err(404, "Сообщение не найдено")
                if row[0] != me["id"]:
                    return err(403, "Нельзя редактировать чужое")
                cur.execute(
                    f"UPDATE {SCHEMA}.messages SET text=%s, edited_at=NOW() WHERE id=%s",
                    (text, msg_id),
                )
                conn.commit()
                return ok({"ok": True})

        return err(400, "Неизвестное действие")

    finally:
        conn.close()
