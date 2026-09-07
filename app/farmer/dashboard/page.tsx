"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TurningCountdown } from "@/components/farmer/TurningCountdown";

type ActiveBatch = {
  id: string;
  batch_code: string;
  variety: string;
  method: string;
  size_kg: number;
  start_date: string;
  status: string;
};

type Reading = {
  temperature: number | null;
  ph: number | null;
  humidity: number | null;
  recorded_at: string;
};

type Turning = {
  id: string;
  turning_number: number;
  scheduled_at: string;
};

type Alert = {
  id: string;
  alert_type: string;
  temperature_value: number;
};

export default function FarmerDashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [activeBatch, setActiveBatch] = useState<ActiveBatch | null>(null);
  const [latestReading, setLatestReading] = useState<Reading | null>(null);
  const [nextTurning, setNextTurning] = useState<Turning | null>(null);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---- Initial load ---- */
  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: batch } = await supabase
      .from("fermentation_batches")
      .select("id, batch_code, variety, method, size_kg, start_date, status")
      .eq("farmer_id", user.id)
      .eq("status", "ongoing")
      .order("start_date", { ascending: false })
      .maybeSingle();

    console.log("[dashboard] active batch:", batch);
    setActiveBatch(batch);

    if (batch) {
      const [{ data: reading }, { data: turning }, { data: alert }] = await Promise.all([
        supabase
          .from("sensor_readings")
          .select("temperature, ph, humidity, recorded_at")
          .eq("batch_id", batch.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("turning_schedules")
          .select("id, turning_number, scheduled_at")
          .eq("batch_id", batch.id)
          .eq("status", "pending")
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("alerts")
          .select("id, alert_type, temperature_value")
          .eq("batch_id", batch.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      console.log("[dashboard] initial reading:", reading);
      setLatestReading(reading);
      setNextTurning(turning);
      setActiveAlert(alert);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Realtime subscriptions (only once we know the active batch) ---- */
  useEffect(() => {
    if (!activeBatch) return;

    console.log("[dashboard] subscribing to realtime for batch:", activeBatch.id);

    const channel = supabase
      .channel(`farmer-dashboard-${activeBatch.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
          filter: `batch_id=eq.${activeBatch.id}`,
        },
        (payload) => {
          console.log("[dashboard] new reading received:", payload.new);
          const row = payload.new as Reading;
          setLatestReading(row);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
          filter: `batch_id=eq.${activeBatch.id}`,
        },
        (payload) => {
          console.log("[dashboard] alert change:", payload);
          supabase
            .from("alerts")
            .select("id, alert_type, temperature_value")
            .eq("batch_id", activeBatch.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => setActiveAlert(data));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "turning_schedules",
          filter: `batch_id=eq.${activeBatch.id}`,
        },
        (payload) => {
          console.log("[dashboard] turning change:", payload);
          supabase
            .from("turning_schedules")
            .select("id, turning_number, scheduled_at")
            .eq("batch_id", activeBatch.id)
            .eq("status", "pending")
            .order("scheduled_at", { ascending: true })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => setNextTurning(data));
        }
      )
      .subscribe((status) => {
        console.log("[dashboard] subscription status:", status);
      });

    return () => {
      console.log("[dashboard] unsubscribing");
      supabase.removeChannel(channel);
    };
  }, [activeBatch, supabase]);

  const dayNumber = activeBatch
    ? Math.max(
        1,
        Math.floor((Date.now() - new Date(activeBatch.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
      )
    : 0;

  const inRange = latestReading ? latestReading.temperature! >= 45 && latestReading.temperature! <= 50 : true;

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
            <div className="page-subtitle">Your fermentation batch at a glance</div>
          </div>
        </div>
        <div className="card">
          <p style={{ color: "var(--color-text-muted)" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="page-subtitle">Your fermentation batch at a glance</div>
        </div>
      </div>

      {activeAlert && (
        <div className="form-error" style={{ marginBottom: 20 }}>
          ⚠️ Temperature out of range: {activeAlert.temperature_value}°C (
          {activeAlert.alert_type === "high_temperature" ? "too high" : "too low"}). Please check your batch.
        </div>
      )}

      {!activeBatch ? (
        <div className="card">
          <p style={{ color: "var(--color-text-muted)" }}>
            You don't have an active fermentation batch right now. Once your admin creates one for your farm, it'll
            show up here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <div className="card">
            <div className="stat-card-label">Current batch</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{activeBatch.batch_code}</div>
            <div style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              {activeBatch.variety} · {activeBatch.method} · {activeBatch.size_kg}kg
            </div>
            <div style={{ marginTop: 10 }}>
              <span className="badge badge-info">Day {dayNumber}</span>
            </div>
          </div>

          <div className="card">
            <div className="stat-card-label">Next turning</div>
            {nextTurning ? (
              <TurningCountdown scheduledAt={nextTurning.scheduled_at} turningNumber={nextTurning.turning_number} />
            ) : (
              <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No turning scheduled.</div>
            )}
          </div>

          <div className="card">
            <div className="stat-card-label">Live temperature</div>
            {latestReading ? (
              <>
                <div className={`stat-card-value ${inRange ? "stat-green" : "stat-red"}`}>
                  {latestReading.temperature}°C
                </div>
                <span className={`badge ${inRange ? "badge-success" : "badge-danger"}`}>
                  {inRange ? "In range" : "Out of range"}
                </span>
              </>
            ) : (
              <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No reading yet.</div>
            )}
          </div>

          <div className="card">
            <div className="stat-card-label">Live pH</div>
            {latestReading?.ph != null ? (
              <div className="stat-card-value stat-blue">{latestReading.ph}</div>
            ) : (
              <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No pH reading yet.</div>
            )}
          </div>

          <div className="card">
            <div className="stat-card-label">Live humidity</div>
            {latestReading?.humidity != null ? (
              <div className="stat-card-value stat-blue">{latestReading.humidity}%</div>
            ) : (
              <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No humidity reading yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}