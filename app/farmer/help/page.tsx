"use client";

import { useState } from "react";

export default function HelpAndSupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);

    const res = await fetch("/api/farmer/help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message }),
    });

    setSending(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Something went wrong.");
      return;
    }

    setSent(true);
    setSubject("");
    setMessage("");
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Help and support</h1>
          <div className="page-subtitle">Send a message to your admin</div>
        </div>
      </div>

      <div className="help-grid">
        <div className="card help-form-card">
          {error && <div className="form-error">{error}</div>}
          {sent && <div className="form-success">Message sent. Your admin will get back to you.</div>}

          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <label className="field-label">Subject</label>
              <input className="text-input" required value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-label">Message</label>
              <textarea
                className="text-input"
                required
                rows={5}
                style={{ resize: "vertical" }}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <button className="btn-primary" disabled={sending}>
              {sending ? "Sending..." : "Send message"}
            </button>
          </form>
        </div>

        <div className="help-sidebar">
          <div className="card">
            <h3 style={{ marginBottom: 10, fontSize: 15 }}>Other ways to reach us</h3>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              Email: support@cacaomonitor.app
              <br />
              Phone: (updated by your admin in Settings)
            </p>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 10, fontSize: 15 }}>Response time</h3>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              We typically respond within 24 hours. You'll get a notification here once your admin replies.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .help-grid {
          display: grid;
          grid-template-columns: minmax(0, 480px) minmax(260px, 320px);
          gap: 16px;
          align-items: start;
        }

        .help-form-card {
          margin: 0;
        }

        .help-sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        @media (max-width: 860px) {
          .help-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}