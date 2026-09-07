"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ThresholdValue {
  min: number;
  max: number;
}
interface IntervalsValue {
  first: number;
  second: number;
  optional_interval: number;
}
interface NotifPrefsValue {
  email: boolean;
  in_app: boolean;
}

export function SettingsForm() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [threshold, setThreshold] = useState<ThresholdValue>({ min: 45, max: 50 });
  const [intervals, setIntervals] = useState<IntervalsValue>({ first: 48, second: 96, optional_interval: 24 });
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefsValue>({ email: true, in_app: true });

  useEffect(() => {
    (async () => {
      const { data, error: fetchError } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", [
          "temperature_threshold",
          "turning_intervals_hours",
          "reminder_lead_time_minutes",
          "admin_notification_preferences",
        ]);

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      data?.forEach((row) => {
        if (row.key === "temperature_threshold") setThreshold(row.value as ThresholdValue);
        if (row.key === "turning_intervals_hours") setIntervals(row.value as IntervalsValue);
        if (row.key === "admin_notification_preferences") setNotifPrefs(row.value as NotifPrefsValue);
      });

      setLoading(false);
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const upserts = [
      { key: "temperature_threshold", value: threshold, updated_by: user?.id },
      { key: "turning_intervals_hours", value: intervals, updated_by: user?.id },
      { key: "admin_notification_preferences", value: notifPrefs, updated_by: user?.id },
    ];

    const { error: upsertError } = await supabase.from("settings").upsert(upserts, { onConflict: "key" });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setSuccess("Settings saved.");
  }

  if (loading) return <div className="card">Loading settings...</div>;

  return (
    <form onSubmit={handleSave}>
      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Temperature thresholds</h3>
          <div className="field-group">
            <label className="field-label">Min °C</label>
            <input
              type="number"
              step="0.1"
              className="text-input"
              value={threshold.min}
              onChange={(e) => setThreshold({ ...threshold, min: Number(e.target.value) })}
            />
          </div>
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Max °C</label>
            <input
              type="number"
              step="0.1"
              className="text-input"
              value={threshold.max}
              onChange={(e) => setThreshold({ ...threshold, max: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Turning intervals (hours)</h3>
          <div className="field-group">
            <label className="field-label">1st turning</label>
            <input
              type="number"
              className="text-input"
              value={intervals.first}
              onChange={(e) => setIntervals({ ...intervals, first: Number(e.target.value) })}
            />
          </div>
          <div className="field-group">
            <label className="field-label">2nd turning</label>
            <input
              type="number"
              className="text-input"
              value={intervals.second}
              onChange={(e) => setIntervals({ ...intervals, second: Number(e.target.value) })}
            />
          </div>
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Optional interval</label>
            <input
              type="number"
              className="text-input"
              value={intervals.optional_interval}
              onChange={(e) => setIntervals({ ...intervals, optional_interval: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Notification preferences</h3>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={notifPrefs.email}
              onChange={(e) => setNotifPrefs({ ...notifPrefs, email: e.target.checked })}
            />
            Email alerts
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={notifPrefs.in_app}
              onChange={(e) => setNotifPrefs({ ...notifPrefs, in_app: e.target.checked })}
            />
            In-app alerts
          </label>
        </div>
      </div>

      <button className="btn-primary" style={{ marginTop: 20 }} disabled={saving}>
        {saving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
