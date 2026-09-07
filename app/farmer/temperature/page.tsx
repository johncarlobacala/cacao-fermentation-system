"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SimpleLineChart } from "@/components/ui/SimpleLineChart";

interface Reading {
  temperature: number;
  ph: number;
  humidity: number;
  recorded_at: string;
}

export default function TemperatureMonitoringPage() {
  const supabase = createClient();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchCode, setBatchCode] = useState<string>("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [range, setRange] = useState<"24h" | "7d">("24h");
  const [loading, setLoading] = useState(true);
  const [heatingStatus, setHeatingStatus] = useState("OFF");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: batch } = await supabase
        .from("fermentation_batches")
        .select("id, batch_code")
        .eq("farmer_id", user!.id)
        .eq("status", "ongoing")
        .order("start_date", { ascending: false })
        .maybeSingle();

      if (batch) {
        setBatchId(batch.id);
        setBatchCode(batch.batch_code);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
  if (!batchId) return;

  (async () => {
    const hoursBack = range === "24h" ? 24 : 24 * 7;

    // Load sensor readings
    const { data } = await supabase
      .from("sensor_readings")
      .select("temperature, ph, humidity, recorded_at")
      .eq("batch_id", batchId)
      .gte(
        "recorded_at",
        new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()
      )
      .order("recorded_at", { ascending: true });

    setReadings(data ?? []);

    // Load latest heating element status
    const { data: actuatorData } = await supabase
      .from("actuator_logs")
      .select("action")
      .eq("batch_id", batchId)
      .order("activated_at", { ascending: false })
      .limit(1);

    if (actuatorData && actuatorData.length > 0) {
      setHeatingStatus(actuatorData[0].action);
    } else {
      setHeatingStatus("OFF");
    }
  })();
}, [batchId, range]);

  // Realtime: listen for brand-new readings for this batch and append
  // them live, without needing a manual page refresh.
  useEffect(() => {
    if (!batchId) return;

    const channel = supabase
      .channel(`sensor_readings${batchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
          filter: `batch_id=eq.${batchId}`,
        },
        (payload) => {
          const newReading = payload.new as Reading;
          setReadings((prev) => [...prev, newReading]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [batchId]);

  const latest = readings[readings.length - 1];
  const inRange = latest ? latest.temperature >= 45 && latest.temperature <= 50 : null;

  function toChartPoints(key: "temperature" | "ph" | "humidity") {
    return readings.map((r) => ({
      label:
        range === "24h"
          ? new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : new Date(r.recorded_at).toLocaleDateString([], { month: "short", day: "numeric" }),
      value: Number(r[key]),
    }));
  }

  const temperaturePoints = toChartPoints("temperature");
  const phPoints = toChartPoints("ph");
  const humidityPoints = toChartPoints("humidity");

  if (loading) return <div className="card">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Temperature monitoring</h1>
          <div className="page-subtitle">{batchCode ? `Batch ${batchCode}` : "No active batch"}</div>
        </div>
      </div>

      {!batchId ? (
        <div className="card">
          <p style={{ color: "var(--color-text-muted)" }}>
            You don't have an active batch right now, so there's no sensor data to show.
          </p>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="card">
              <div className="stat-card-label">Live temperature</div>
              <div className={`stat-card-value ${inRange ? "stat-green" : "stat-red"}`}>
                {latest ? `${latest.temperature}°C` : "—"}
              </div>
              {latest && (
                <span className={`badge ${inRange ? "badge-success" : "badge-danger"}`}>
                  {inRange ? "In range" : "Out of range"}
                </span>
              )}
            </div>

            <div className="card">
              <div className="stat-card-label">Live pH</div>
              <div className="stat-card-value stat-amber">
                {latest ? latest.ph : "—"}
              </div>
            </div>

            <div className="card">
              <div className="stat-card-label">Live humidity</div>
              <div className="stat-card-value stat-blue">
                {latest ? `${latest.humidity}%` : "—"}
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15 }}>Temperature history</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={range === "24h" ? "btn-primary" : "btn-secondary"}
                  style={{ padding: "6px 14px", fontSize: 12 }}
                  onClick={() => setRange("24h")}
                >
                  Last 24h
                </button>
                <button
                  className={range === "7d" ? "btn-primary" : "btn-secondary"}
                  style={{ padding: "6px 14px", fontSize: 12 }}
                  onClick={() => setRange("7d")}
                >
                  Last 7 days
                </button>
              </div>
            </div>
            <SimpleLineChart points={temperaturePoints} minY={30} maxY={60} />
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>pH history</h3>
            <SimpleLineChart points={phPoints} minY={0} maxY={14} />
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Humidity history</h3>
            <SimpleLineChart points={humidityPoints} minY={0} maxY={100} />
          </div>
          <div className="card">
  <div className="stat-card-label">Heating Element</div>

  <div
    className={`stat-card-value ${
      heatingStatus === "ON" ? "stat-amber" : "stat-blue"
    }`}
  >
    {heatingStatus === "ON" ? "🔥 Active" : "⚪ Inactive"}
  </div>

  <span
    className={`badge ${
      heatingStatus === "ON"
        ? "badge-success"
        : "badge-secondary"
    }`}
  >
    {heatingStatus}
  </span>
</div>
        </>
      )}
    </div>
  );
}