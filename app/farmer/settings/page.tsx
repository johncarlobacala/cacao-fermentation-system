"use client";

import { useEffect, useState } from "react";

const PREFS_KEY = "cacao_farmer_notification_prefs";
const REMINDER_KEY = "cacao_reminder_lead_minutes";

interface Prefs {
  turning_reminders: boolean;
  temperature_alerts: boolean;
  batch_updates: boolean;
}

const DEFAULT_PREFS: Prefs = { turning_reminders: true, temperature_alerts: true, batch_updates: true };

export default function FarmerSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [reminderLead, setReminderLead] = useState(60);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedPrefs = window.localStorage.getItem(PREFS_KEY);
    const savedLead = window.localStorage.getItem(REMINDER_KEY);
    if (savedPrefs) setPrefs(JSON.parse(savedPrefs));
    if (savedLead) setReminderLead(Number(savedLead));
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    window.localStorage.setItem(REMINDER_KEY, String(reminderLead));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="page-subtitle">Notification preferences and reminder lead time</div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="settings-grid">
          <div className="card settings-card">
            <h3 style={{ marginBottom: 16, fontSize: 15 }}>Notify me about</h3>

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={prefs.turning_reminders}
                onChange={(e) => setPrefs({ ...prefs, turning_reminders: e.target.checked })}
              />
              Turning reminders
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={prefs.temperature_alerts}
                onChange={(e) => setPrefs({ ...prefs, temperature_alerts: e.target.checked })}
              />
              Temperature alerts
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={prefs.batch_updates}
                onChange={(e) => setPrefs({ ...prefs, batch_updates: e.target.checked })}
              />
              Batch status updates
            </label>
          </div>

          <div className="card settings-card">
            <h3 style={{ marginBottom: 16, fontSize: 15 }}>Reminder lead time</h3>
            <div className="reminder-lead-options">
              {[30, 60, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`reminder-lead-btn ${reminderLead === mins ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setReminderLead(mins)}
                >
                  {mins < 60 ? `${mins} min` : `${mins / 60} hr`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {saved && <div className="form-success settings-success">Saved.</div>}
        <button className="btn-primary settings-save-btn">Save settings</button>
      </form>

      <style jsx>{`
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
          align-items: start;
        }

        .settings-card {
          margin-bottom: 0;
        }

        .reminder-lead-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .reminder-lead-btn {
          padding: 8px 16px;
          font-size: 12px;
          white-space: nowrap;
          flex: 0 0 auto;
        }

        .settings-success {
          margin-bottom: 12px;
        }

        .settings-save-btn {
          width: 100%;
          max-width: 320px;
        }

        @media (max-width: 480px) {
          .settings-grid {
            grid-template-columns: 1fr;
          }

          .reminder-lead-options {
            width: 100%;
          }

          .reminder-lead-btn {
            flex: 1 1 auto;
          }

          .settings-save-btn {
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}

/* NOTE: these preferences are saved per-browser via localStorage, not in
   Supabase — the schema doesn't have a per-farmer notification-preferences
   column. If you want these synced across devices, add a jsonb column
   (e.g. `notification_prefs`) to public.profiles and swap the
   localStorage calls above for supabase.from('profiles').update(...). */