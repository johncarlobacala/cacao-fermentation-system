"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const FIXED_ADMIN_ID = "a3506775-faf3-412f-90aa-8d4504a1de63";

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  support_message_id: string | null;
  support_messages: { farmer_id: string; subject: string; message: string; created_at: string } | null;
}

interface ThreadMsg {
  id: string;
  sender_role: "admin" | "farmer";
  message: string;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  turning_reminder: "⏰",
  turning_due: "🔄",
  turning_overdue: "⚠️",
  temperature_alert: "🌡️",
  batch_completed: "✅",
  system: "🔔",
};

export function NotificationsList({ role = "farmer" }: { role?: "admin" | "farmer" }) {
  const supabase = createClient();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMsg[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setNotifs([]);
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data } = await supabase
      .from("notifications")
      .select(
        "id, type, title, message, is_read, created_at, support_message_id, support_messages(farmer_id, subject, message, created_at)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    setNotifs((data as unknown as Notif[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Notif;
          setNotifs((prev) => prev.map((n) => (n.id === row.id ? { ...n, ...row } : n)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function markRead(id: string) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAllRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  }

  async function openReply(n: Notif) {
    setReplyError(null);
    setReplyText("");
    setOpenReplyId(n.id);

    if (!n.support_message_id) return;

    setThreadLoading(true);
    const { data } = await supabase
      .from("support_message_replies")
      .select("id, sender_role, message, created_at")
      .eq("support_message_id", n.support_message_id)
      .order("created_at", { ascending: true });

    const original: ThreadMsg[] = n.support_messages
      ? [
          {
            id: `original-${n.support_message_id}`,
            sender_role: "farmer",
            message: n.support_messages.message,
            created_at: n.support_messages.created_at,
          },
        ]
      : [];

    setThreadMessages([...original, ...((data as ThreadMsg[]) ?? [])]);
    setThreadLoading(false);
  }

  function closeReply() {
    if (sending) return;
    setOpenReplyId(null);
    setReplyText("");
    setReplyError(null);
    setThreadMessages([]);
  }

  async function submitReply(n: Notif) {
    if (!n.support_message_id || !n.support_messages) return;
    const text = replyText.trim();
    if (!text) return;

    setSending(true);
    setReplyError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSending(false);
      return;
    }

    const now = new Date().toISOString();
    const recipientId = role === "admin" ? n.support_messages.farmer_id : FIXED_ADMIN_ID;

    // 1. Save the message in the thread (full history)
    const { error: threadError } = await supabase.from("support_message_replies").insert([
      {
        support_message_id: n.support_message_id,
        sender_role: role,
        sender_id: user.id,
        message: text,
      },
    ]);

    if (threadError) {
      setReplyError(threadError.message);
      setSending(false);
      return;
    }

    // 2. Keep the ticket status / legacy columns in sync
    if (role === "admin") {
      const { error: supportError } = await supabase
        .from("support_messages")
        .update({ admin_reply: text, replied_by: user.id, replied_at: now, status: "replied" })
        .eq("id", n.support_message_id);
      if (supportError) {
        setReplyError(supportError.message);
        setSending(false);
        return;
      }
    } else {
      const { error: supportError } = await supabase
        .from("support_messages")
        .update({ status: "open" })
        .eq("id", n.support_message_id);
      if (supportError) {
        setReplyError(supportError.message);
        setSending(false);
        return;
      }
    }

    // 3. Create a notification for the other person
    const { error: notifError } = await supabase.from("notifications").insert([
      {
        user_id: recipientId,
        type: "system",
        title:
          role === "admin"
            ? `Reply to: ${n.support_messages.subject || "your message"}`
            : `📩 New reply: ${n.support_messages.subject || "support message"}`,
        message: text,
        is_read: false,
        support_message_id: n.support_message_id,
      },
    ]);

    if (notifError) {
      setReplyError(notifError.message);
      setSending(false);
      return;
    }

    // 4. Show new message immediately
    setThreadMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, sender_role: role, message: text, created_at: now },
    ]);

    // 5. Mark current notification as read
    await markRead(n.id);
    setSending(false);
    setReplyText("");
  }

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  return (
    <div className="card">
      <div className="notif-header">
        <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>{unreadCount} unread</span>
        <button className="btn-secondary" onClick={markAllRead} disabled={unreadCount === 0}>
          Mark all as read
        </button>
      </div>

      {loading && <div style={{ color: "var(--color-text-muted)" }}>Loading...</div>}
      {!loading && notifs.length === 0 && (
        <div style={{ color: "var(--color-text-muted)", padding: "20px 0" }}>No notifications yet.</div>
      )}

      {notifs.map((n) => {
        const showReplyButton = !!n.support_message_id && !!n.support_messages;
        const isOpen = openReplyId === n.id;

        return (
          <div key={n.id} className="notif-wrap">
            <div
              className={`notif-item ${!n.is_read ? "notif-unread" : ""}`}
              onClick={() => {
                if (!n.is_read) markRead(n.id);
              }}
            >
              <div className="notif-content">
                <div className="notif-title-row">
                  <div className="notif-title">
                    {!n.is_read && <span className="unread-dot" />}
                    {n.title}
                  </div>
                  {!n.is_read && <span className="notif-new">New</span>}
                </div>

                <div className="notif-message">{n.message}</div>

                <div className="notif-meta">
                  <span>{new Date(n.created_at).toLocaleString()}</span>

                  {showReplyButton && (
                    <button
                      className="reply-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        isOpen ? closeReply() : openReply(n);
                      }}
                    >
                      {isOpen ? "Close" : "Reply"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {isOpen && (
              <div className="inline-reply">
                {threadLoading && <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Loading conversation...</div>}

                {!threadLoading && threadMessages.length > 0 && (
                  <div className="thread">
                    {threadMessages.map((m) => (
                      <div key={m.id} className={`thread-msg ${m.sender_role === "admin" ? "thread-msg-admin" : "thread-msg-farmer"}`}>
                        <div className="thread-msg-role">{m.sender_role === "admin" ? "Admin" : "Farmer"}</div>
                        <div className="thread-msg-text">{m.message}</div>
                        <div className="thread-msg-time">{new Date(m.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}

                {replyError && <div className="form-error">{replyError}</div>}

                <textarea
                  className="text-input"
                  rows={3}
                  placeholder="Type your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{ width: "100%", resize: "vertical" }}
                  autoFocus
                />

                <div className="reply-actions">
                  <button className="btn-secondary" onClick={closeReply} disabled={sending}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={() => submitReply(n)} disabled={sending || !replyText.trim()}>
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <style jsx>{`
        .notif-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
          gap: 12px;
          flex-wrap: wrap;
        }

        .notif-wrap {
          margin-bottom: 8px;
        }

        .notif-item {
          position: relative;
          background: #ffffff;
          border: 1px solid #e5ede3;
          border-radius: 12px;
          padding: 18px 20px;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .notif-item:hover {
          background: #fbfdf9;
          border-color: #d8e5d4;
          box-shadow: 0 3px 12px rgba(47, 125, 50, 0.06);
        }

        .notif-unread {
          background: #f4faf1;
          border-left: 4px solid #68b84f;
        }

        .notif-content {
          width: 100%;
        }

        .notif-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .notif-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #18221a;
          font-size: 15px;
          font-weight: 600;
          line-height: 1.4;
        }

        .unread-dot {
          width: 7px;
          height: 7px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #68b84f;
        }

        .notif-new {
          flex-shrink: 0;
          padding: 4px 9px;
          border-radius: 999px;
          background: #eaf6e5;
          color: #2f7d32;
          font-size: 11px;
          font-weight: 600;
        }

        .notif-message {
          margin-top: 7px;
          color: #4f5b51;
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
        }

        .notif-meta {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 10px;
          color: #8a948c;
          font-size: 12px;
        }

        .reply-link {
          padding: 0;
          border: none;
          background: none;
          color: #2f7d32;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .reply-link:hover {
          text-decoration: underline;
        }

        .inline-reply {
          margin-top: 6px;
          padding: 16px;
          background: #f7fbf5;
          border: 1px solid #e5ede3;
          border-radius: 10px;
        }

        .thread {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
          max-height: 260px;
          overflow-y: auto;
        }

        .thread-msg {
          max-width: 80%;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 13px;
        }

        .thread-msg-farmer {
          align-self: flex-start;
          background: #ffffff;
          border: 1px solid #e5ede3;
        }

        .thread-msg-admin {
          align-self: flex-end;
          background: #eaf6e5;
          border: 1px solid #d5ecce;
        }

        .thread-msg-role {
          font-weight: 600;
          font-size: 11px;
          color: #2f7d32;
          margin-bottom: 2px;
        }

        .thread-msg-text {
          color: #29332a;
          word-break: break-word;
        }

        .thread-msg-time {
          margin-top: 4px;
          font-size: 10px;
          color: #8a948c;
        }

        .reply-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 10px;
        }

        @media (max-width: 480px) {
          .notif-header {
            justify-content: flex-start;
          }
          .notif-header button {
            width: 100%;
          }
          .notif-item {
            padding: 15px;
          }
          .notif-title-row {
            align-items: flex-start;
          }
          .notif-meta {
            flex-wrap: wrap;
          }
          .inline-reply {
            padding: 12px;
          }
        }
      `}</style>
    </div>
  );
}