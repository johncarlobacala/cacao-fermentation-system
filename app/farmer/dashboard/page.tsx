"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TurningCountdown } from "@/components/farmer/TurningCountdown";

/* ============================================================
   TYPES — match the real schema exactly (no invented columns)
   ============================================================ */

type Batch = {
  id: string;
  batch_code: string;
  farm_id: string;
  variety: string;
  method: string;
  size_kg: number;
  start_date: string;
  status: string;
  completed_at: string | null;
};

type Reading = {
  temperature: number | null;
  ph: number | null;
  humidity: number | null;
  recorded_at: string;
};

type Turning = {
  id: string;
  batch_id: string;
  turning_number: number;
  scheduled_at: string;
  status: string;
};

type Alert = {
  id: string;
  batch_id: string;
  alert_type: string;
  status: string;
  temperature_value: number | null;
  ph_value: number | null;
  humidity_value: number | null;
  created_at: string;
};

type ActivityLog = {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type SensorRow = {
  id: string;
  sensor_code: string;
  status: string;
  last_reading_at: string | null;
};

/* ============================================================
   HELPERS
   ============================================================ */

function fermentationDay(startDate: string) {
  const start = new Date(startDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function alertColor(alertType: string) {
  const t = alertType.toLowerCase();
  if (t.includes("normal") || t.includes("resolved")) return { dot: "#22c55e", label: "badge-success" };
  if (t.includes("high") || t.includes("critical")) return { dot: "#ef4444", label: "badge-danger" };
  if (t.includes("low")) return { dot: "#f97316", label: "badge-warning" };
  return { dot: "#94a3b8", label: "badge-info" };
}

function formatAlertType(alertType: string) {
  return alertType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatAction(action: string) {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ============================================================
   COMPONENT
   ============================================================ */

export default function FarmerDashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const [farmerName, setFarmerName] = useState<string>("");
  const [farmName, setFarmName] = useState<string | null>(null);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchReadings, setBatchReadings] = useState<Record<string, Reading | null>>({});
  const [batchHeaterState, setBatchHeaterState] = useState<Record<string, string | null>>({});

  const [nextTurning, setNextTurning] = useState<Turning | null>(null);
  const [todaysTurnings, setTodaysTurnings] = useState<Turning[]>([]);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);

  const [sensor, setSensor] = useState<SensorRow | null>(null);
  const [phRange, setPhRange] = useState<{ min: number | null; max: number | null }>({
    min: null,
    max: null,
  });

  const mainBatch = batches[0] ?? null;

  /* ---- Load everything ---- */
  async function loadData() {
    setLoading(true);
    setDbError(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Farmer profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      setFarmerName(profile?.full_name ?? "");

      // pH thresholds (single-row config tables)
      const [{ data: minPhRow }, { data: maxPhRow }] = await Promise.all([
        supabase.from("min_ph").select("numeric").limit(1).maybeSingle(),
        supabase.from("max_ph").select("numeric").limit(1).maybeSingle(),
      ]);
      setPhRange({
        min: minPhRow?.numeric ?? null,
        max: maxPhRow?.numeric ?? null,
      });

      // All ongoing batches for this farmer, most recent first
      const { data: batchRows } = await supabase
        .from("fermentation_batches")
        .select("id, batch_code, farm_id, variety, method, size_kg, start_date, status, completed_at")
        .eq("farmer_id", user.id)
        .eq("status", "ongoing")
        .order("start_date", { ascending: false });

      const activeBatches = batchRows ?? [];
      setBatches(activeBatches);

      if (activeBatches.length > 0) {
        const primary = activeBatches[0];
        const batchIds = activeBatches.map((b) => b.id);

        // Farm name for the primary batch
        const { data: farm } = await supabase
          .from("farms")
          .select("name")
          .eq("id", primary.farm_id)
          .maybeSingle();
        setFarmName(farm?.name ?? null);

        // Sensor status (farm-level device)
        const { data: sensorRow } = await supabase
          .from("sensors")
          .select("id, sensor_code, status, last_reading_at")
          .eq("farm_id", primary.farm_id)
          .order("last_reading_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setSensor(sensorRow ?? null);

        // Latest reading + latest heater log per batch
        const readingEntries: Record<string, Reading | null> = {};
        const heaterEntries: Record<string, string | null> = {};

        await Promise.all(
          activeBatches.map(async (b) => {
            const [{ data: reading }, { data: actuatorLog }] = await Promise.all([
              supabase
                .from("sensor_readings")
                .select("temperature, ph, humidity, recorded_at")
                .eq("batch_id", b.id)
                .order("recorded_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
              supabase
                .from("actuator_logs")
                .select("action")
                .eq("batch_id", b.id)
                .order("activated_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
            ]);
            readingEntries[b.id] = reading ?? null;
            heaterEntries[b.id] = actuatorLog?.action ?? null;
          })
        );
        setBatchReadings(readingEntries);
        setBatchHeaterState(heaterEntries);

        // Next pending turning for the primary batch
        const { data: turning } = await supabase
          .from("turning_schedules")
          .select("id, batch_id, turning_number, scheduled_at, status")
          .eq("batch_id", primary.id)
          .eq("status", "pending")
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        setNextTurning(turning ?? null);

        // Today's turnings across all of the farmer's active batches
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const { data: todays } = await supabase
          .from("turning_schedules")
          .select("id, batch_id, turning_number, scheduled_at, status")
          .in("batch_id", batchIds)
          .gte("scheduled_at", startOfDay.toISOString())
          .lte("scheduled_at", endOfDay.toISOString())
          .order("scheduled_at", { ascending: true });
        setTodaysTurnings(todays ?? []);

        // Recent alerts across all of the farmer's active batches
        const { data: alertRows } = await supabase
          .from("alerts")
          .select("id, batch_id, alert_type, status, temperature_value, ph_value, humidity_value, created_at")
          .in("batch_id", batchIds)
          .order("created_at", { ascending: false })
          .limit(5);
        setAlerts(alertRows ?? []);
      }

      // Recent activity for this farmer
      const { data: activityRows } = await supabase
        .from("activity_logs")
        .select("id, action, details, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setActivity(activityRows ?? []);
    } catch (err) {
      console.error("[dashboard] load error:", err);
      setDbError(true);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Realtime subscriptions for the primary batch ---- */
  useEffect(() => {
    if (!mainBatch) return;

    const channel = supabase
      .channel(`farmer-dashboard-${mainBatch.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sensor_readings", filter: `batch_id=eq.${mainBatch.id}` },
        (payload) => {
          const row = payload.new as Reading;
          setBatchReadings((prev) => ({ ...prev, [mainBatch.id]: row }));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts", filter: `batch_id=eq.${mainBatch.id}` },
        () => {
          supabase
            .from("alerts")
            .select("id, batch_id, alert_type, status, temperature_value, ph_value, humidity_value, created_at")
            .in(
              "batch_id",
              batches.map((b) => b.id)
            )
            .order("created_at", { ascending: false })
            .limit(5)
            .then(({ data }) => setAlerts(data ?? []));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "turning_schedules", filter: `batch_id=eq.${mainBatch.id}` },
        () => {
          supabase
            .from("turning_schedules")
            .select("id, batch_id, turning_number, scheduled_at, status")
            .eq("batch_id", mainBatch.id)
            .eq("status", "pending")
            .order("scheduled_at", { ascending: true })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => setNextTurning(data ?? null));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainBatch?.id, supabase]);

  const batchLabel = (batchId: string) => batches.find((b) => b.id === batchId)?.batch_code ?? "Unknown batch";

  const primaryReading = mainBatch ? batchReadings[mainBatch.id] ?? null : null;
  const primaryHeater = mainBatch ? batchHeaterState[mainBatch.id] ?? null : null;

  const tempInRange =
    primaryReading?.temperature != null ? primaryReading.temperature >= 45 && primaryReading.temperature <= 50 : null;

  const phInRange =
    primaryReading?.ph != null && phRange.min != null && phRange.max != null
      ? primaryReading.ph >= phRange.min && primaryReading.ph <= phRange.max
      : null;

  const lastUpdatedLabel = primaryReading?.recorded_at
    ? new Date(primaryReading.recorded_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "—";

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
      {/* ---------- HEADER ---------- */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Good morning, {farmerName || "Farmer"}! 👋</h1>
          <div className="page-subtitle">Here's the current status of your cacao fermentation batch.</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                display: "inline-block",
                background: dbError ? "#ef4444" : "#22c55e",
              }}
            />
            <span>{dbError ? "Connection issue" : "System Operational"}</span>
          </div>
          <div style={{ color: "var(--color-text-muted)", marginTop: 2 }}>
            Last updated: {lastUpdatedLabel}
          </div>
        </div>
      </div>

      {/* ---------- EMPTY STATE ---------- */}
      {!mainBatch ? (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>No Active Fermentation Batch</h3>
          <p style={{ color: "var(--color-text-muted)", marginBottom: 14 }}>
            You don't have an active fermentation batch right now. Once your admin creates one for your farm, it'll
            show up here.
          </p>
          <div style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>What you can monitor:</div>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              <li>Temperature</li>
              <li>pH</li>
              <li>Humidity</li>
              <li>Fermentation day</li>
              <li>Heating element status</li>
            </ul>
          </div>
        </div>
      ) : (
        <>
          {/* ---------- MAIN GRID: ACTIVE BATCH + PROGRESS ---------- */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Active batch card */}
            <div className="card">
              <span className="badge badge-info" style={{ marginBottom: 10, display: "inline-block" }}>
                Active Fermentation Batch
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{mainBatch.batch_code}</div>
                <span className="badge badge-info">Day {fermentationDay(mainBatch.start_date)}</span>
              </div>
              {farmName && (
                <div style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginBottom: 14 }}>
                  Farm: {farmName}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 14 }}>
                <div>
                  <div className="stat-card-label">Temperature</div>
                  {primaryReading?.temperature != null ? (
                    <>
                      <div className="stat-card-value">{primaryReading.temperature}°C</div>
                      <span className={`badge ${tempInRange ? "badge-success" : "badge-danger"}`}>
                        {tempInRange ? "Normal" : "Out of range"}
                      </span>
                    </>
                  ) : (
                    <div style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>No current reading</div>
                  )}
                </div>

                <div>
                  <div className="stat-card-label">pH Level</div>
                  {primaryReading?.ph != null ? (
                    <>
                      <div className="stat-card-value">{primaryReading.ph}</div>
                      {phInRange != null ? (
                        <span className={`badge ${phInRange ? "badge-success" : "badge-danger"}`}>
                          {phInRange ? "Normal" : "Out of range"}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <div style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>No current reading</div>
                  )}
                </div>

                <div>
                  <div className="stat-card-label">Humidity</div>
                  {primaryReading?.humidity != null ? (
                    <div className="stat-card-value">{primaryReading.humidity}%</div>
                  ) : (
                    <div style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>No current reading</div>
                  )}
                </div>
              </div>

              <div
                style={{
                  paddingTop: 12,
                  borderTop: "1px solid var(--color-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div className="stat-card-label">Heating Element</div>
                  <div style={{ fontWeight: 600 }}>
                    {primaryHeater == null
                      ? "No data available"
                      : primaryHeater.toLowerCase().includes("on")
                      ? "🔥 ON"
                      : "OFF"}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  Started {new Date(mainBatch.start_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>
            </div>

            {/* Fermentation progress card (no total duration exists → day count only) */}
            <div className="card" style={{ textAlign: "center" }}>
              <div className="stat-card-label" style={{ marginBottom: 10 }}>Fermentation Progress</div>
              <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>
                Day {fermentationDay(mainBatch.start_date)}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
                Started {new Date(mainBatch.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                Keep monitoring the temperature, pH, and humidity for optimal fermentation.
              </p>
            </div>
          </div>

          {/* ---------- ACTIVE BATCHES TABLE (only if more than one) ---------- */}
          {batches.length > 1 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 14, fontSize: 15 }}>Your Active Batches</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--color-text-muted)" }}>
                      <th style={{ padding: "6px 8px" }}>Batch</th>
                      <th style={{ padding: "6px 8px" }}>Day</th>
                      <th style={{ padding: "6px 8px" }}>Temperature</th>
                      <th style={{ padding: "6px 8px" }}>pH</th>
                      <th style={{ padding: "6px 8px" }}>Heater</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => {
                      const r = batchReadings[b.id];
                      const h = batchHeaterState[b.id];
                      return (
                        <tr key={b.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                          <td style={{ padding: "8px" }}>{b.batch_code}</td>
                          <td style={{ padding: "8px" }}>Day {fermentationDay(b.start_date)}</td>
                          <td style={{ padding: "8px" }}>{r?.temperature != null ? `${r.temperature}°C` : "—"}</td>
                          <td style={{ padding: "8px" }}>{r?.ph != null ? r.ph : "—"}</td>
                          <td style={{ padding: "8px" }}>
                            {h == null ? "—" : h.toLowerCase().includes("on") ? "ON" : "OFF"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ---------- ALERTS + TURNING SCHEDULE ---------- */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div className="card">
              <h3 style={{ marginBottom: 14, fontSize: 15 }}>Recent Alerts</h3>
              {alerts.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>No recent alerts.</p>
              ) : (
                alerts.map((a) => {
                  const c = alertColor(a.alert_type);
                  const value =
                    a.temperature_value != null
                      ? `${a.temperature_value}°C`
                      : a.ph_value != null
                      ? `pH ${a.ph_value}`
                      : a.humidity_value != null
                      ? `${a.humidity_value}%`
                      : null;
                  return (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 0",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: c.dot,
                            marginTop: 5,
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{formatAlertType(a.alert_type)}</div>
                          <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                            Batch {batchLabel(a.batch_id)}
                            {value ? ` · ${value}` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                        {timeAgo(a.created_at)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 14, fontSize: 15 }}>Today's Turning Schedule</h3>
              {todaysTurnings.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>No turnings scheduled for today.</p>
              ) : (
                todaysTurnings.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                        {new Date(t.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                        Batch {batchLabel(t.batch_id)} · Turning #{t.turning_number}
                      </div>
                    </div>
                    <span className={`badge ${t.status === "completed" ? "badge-success" : "badge-info"}`}>
                      {t.status}
                    </span>
                  </div>
                ))
              )}
              {nextTurning && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--color-border)" }}>
                  <div className="stat-card-label" style={{ marginBottom: 6 }}>Next turning</div>
                  <TurningCountdown scheduledAt={nextTurning.scheduled_at} turningNumber={nextTurning.turning_number} />
                </div>
              )}
            </div>
          </div>

          {/* ---------- SYSTEM STATUS + RECENT ACTIVITY ---------- */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="card">
              <h3 style={{ marginBottom: 14, fontSize: 15 }}>System Status</h3>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: 13.5 }}>ESP32 Controller</span>
                <span className={`badge ${sensor?.status === "online" ? "badge-success" : "badge-danger"}`}>
                  {sensor ? sensor.status : "No data available"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                <span style={{ fontSize: 13.5 }}>Cloud Database</span>
                <span className={`badge ${dbError ? "badge-danger" : "badge-success"}`}>
                  {dbError ? "Error" : "Connected"}
                </span>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 14, fontSize: 15 }}>Recent System Activity</h3>
              {activity.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>No recent activity.</p>
              ) : (
                activity.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--color-border)",
                      fontSize: 13,
                    }}
                  >
                    <span>{formatAction(a.action)}</span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {new Date(a.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}