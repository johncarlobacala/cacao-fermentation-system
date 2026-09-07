"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TurningCountdown } from "@/components/farmer/TurningCountdown";
import { WeatherWidget } from "@/components/farmer/WeatherWidget";

interface Turning {
  id: string;
  turning_number: number;
  scheduled_at: string;
  status: string;
}

const REMINDER_KEY = "cacao_reminder_lead_minutes";

export default function TurningSchedulePage() {
  const supabase = createClient();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [farmCoords, setFarmCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [turnings, setTurnings] = useState<Turning[]>([]);
  const [reminderLead, setReminderLead] = useState(60);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(REMINDER_KEY) : null;
    if (saved) setReminderLead(Number(saved));
  }, []);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: batch } = await supabase
      .from("fermentation_batches")
      .select("id, farm_id")
      .eq("farmer_id", user!.id)
      .eq("status", "ongoing")
      .order("start_date", { ascending: false })
      .maybeSingle();

    if (batch) {
      setBatchId(batch.id);

      const [{ data: turningData }, { data: farm }] = await Promise.all([
        supabase
          .from("turning_schedules")
          .select("id, turning_number, scheduled_at, status")
          .eq("batch_id", batch.id)
          .order("scheduled_at", { ascending: true }),
        supabase.from("farms").select("latitude, longitude").eq("id", batch.farm_id).maybeSingle(),
      ]);

      setTurnings(turningData ?? []);
      if (farm?.latitude && farm?.longitude) setFarmCoords({ lat: farm.latitude, lng: farm.longitude });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function saveReminderLead(minutes: number) {
    setReminderLead(minutes);
    window.localStorage.setItem(REMINDER_KEY, String(minutes));
  }

  async function handleMarkDone(turningId: string) {
  if (!batchId) return;

  setMarkingId(turningId);

  // 1. Mark current turning as completed
  const { error } = await supabase
    .from("turning_schedules")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", turningId);

  if (error) {
    console.error(error);
    setMarkingId(null);
    return;
  }

  // 2. Check if there are still pending turnings
  const { data: pendingTurnings, error: pendingError } = await supabase
    .from("turning_schedules")
    .select("id")
    .eq("batch_id", batchId)
    .eq("status", "pending");

  if (pendingError) {
    console.error(pendingError);
  }

  // 3. If no pending turnings remain, complete the batch
  if (!pendingError && pendingTurnings && pendingTurnings.length === 0) {
    const { error: batchError } = await supabase
      .from("fermentation_batches")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    if (batchError) {
      console.error(batchError);
    }
  }

  setMarkingId(null);
  load();
}

  const nextPending = turnings.find((t) => t.status === "pending");

  if (loading) return <div className="card">Loading...</div>;

  if (!batchId) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Turning schedule</h1>
          </div>
        </div>
        <div className="card">
          <p style={{ color: "var(--color-text-muted)" }}>No active batch right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Turning schedule</h1>
          <div className="page-subtitle">Countdown, reminders, and weather to help you plan</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="stat-card-label">Next turning</div>
          {nextPending ? (
            <TurningCountdown scheduledAt={nextPending.scheduled_at} turningNumber={nextPending.turning_number} />
          ) : (
            <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No turning pending.</div>
          )}
        </div>

        <div className="card" style={{ textAlign: "center" }}>
          <div className="stat-card-label" style={{ marginBottom: 10 }}>Remind me before</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {[30, 60, 120].map((mins) => (
              <button
                key={mins}
                className={reminderLead === mins ? "btn-primary" : "btn-secondary"}
                style={{ padding: "8px 14px", fontSize: 12 }}
                onClick={() => saveReminderLead(mins)}
              >
                {mins < 60 ? `${mins} min` : `${mins / 60} hr`}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 10 }}>
            Saved on this device.
          </p>
        </div>

        <div style={{ textAlign: "center" }}>
          <WeatherWidget lat={farmCoords?.lat} lng={farmCoords?.lng} />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>All turnings for this batch</h3>
        {turnings.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Turning #{t.turning_number}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                {new Date(t.scheduled_at).toLocaleString()}
              </div>
            </div>
            {t.status === "pending" ? (
              <button className="btn-secondary" disabled={markingId === t.id} onClick={() => handleMarkDone(t.id)}>
                {markingId === t.id ? "Saving..." : "Mark turning done"}
              </button>
            ) : (
              <span className={`badge ${t.status === "completed" ? "badge-success" : "badge-danger"}`}>
                {t.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}