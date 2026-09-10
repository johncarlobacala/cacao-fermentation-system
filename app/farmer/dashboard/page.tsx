"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TurningCountdown } from "@/components/farmer/TurningCountdown";

/* ============================================================
   TYPES
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

  const diffDays = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

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

  if (t.includes("normal") || t.includes("resolved")) {
    return {
      dot: "#22c55e",
      label: "badge-success",
    };
  }

  if (t.includes("high") || t.includes("critical")) {
    return {
      dot: "#ef4444",
      label: "badge-danger",
    };
  }

  if (t.includes("low")) {
    return {
      dot: "#f97316",
      label: "badge-warning",
    };
  }

  return {
    dot: "#94a3b8",
    label: "badge-info",
  };
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
  const [batchReadings, setBatchReadings] = useState<
    Record<string, Reading | null>
  >({});
  const [batchHeaterState, setBatchHeaterState] = useState<
    Record<string, string | null>
  >({});

  const [nextTurning, setNextTurning] = useState<Turning | null>(null);
  const [todaysTurnings, setTodaysTurnings] = useState<Turning[]>([]);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);

  const [sensor, setSensor] = useState<SensorRow | null>(null);

  const [phRange, setPhRange] = useState<{
    min: number | null;
    max: number | null;
  }>({
    min: null,
    max: null,
  });

  const mainBatch = batches[0] ?? null;

  /* ============================================================
     LOAD DATA
     ============================================================ */

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

      /* ---------- Farmer profile ---------- */

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      setFarmerName(profile?.full_name ?? "");

      /* ---------- pH thresholds ---------- */

      const [{ data: minPhRow }, { data: maxPhRow }] =
        await Promise.all([
          supabase
            .from("min_ph")
            .select("numeric")
            .limit(1)
            .maybeSingle(),

          supabase
            .from("max_ph")
            .select("numeric")
            .limit(1)
            .maybeSingle(),
        ]);

      setPhRange({
        min: minPhRow?.numeric ?? null,
        max: maxPhRow?.numeric ?? null,
      });

      /* ---------- Active batches ---------- */

      const { data: batchRows } = await supabase
        .from("fermentation_batches")
        .select(
          "id, batch_code, farm_id, variety, method, size_kg, start_date, status, completed_at"
        )
        .eq("farmer_id", user.id)
        .eq("status", "ongoing")
        .order("start_date", { ascending: false });

      const activeBatches = batchRows ?? [];

      setBatches(activeBatches);

      if (activeBatches.length > 0) {
        const primary = activeBatches[0];

        const batchIds = activeBatches.map((b) => b.id);

        /* ---------- Farm ---------- */

        const { data: farm } = await supabase
          .from("farms")
          .select("name")
          .eq("id", primary.farm_id)
          .maybeSingle();

        setFarmName(farm?.name ?? null);

        /* ---------- Sensor ---------- */

        const { data: sensorRow } = await supabase
          .from("sensors")
          .select("id, sensor_code, status, last_reading_at")
          .eq("farm_id", primary.farm_id)
          .order("last_reading_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setSensor(sensorRow ?? null);

        /* ---------- Readings + heater ---------- */

        const readingEntries: Record<string, Reading | null> = {};
        const heaterEntries: Record<string, string | null> = {};

        await Promise.all(
          activeBatches.map(async (b) => {
            const [{ data: reading }, { data: actuatorLog }] =
              await Promise.all([
                supabase
                  .from("sensor_readings")
                  .select(
                    "temperature, ph, humidity, recorded_at"
                  )
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

        /* ---------- Next turning ---------- */

        const { data: turning } = await supabase
          .from("turning_schedules")
          .select(
            "id, batch_id, turning_number, scheduled_at, status"
          )
          .eq("batch_id", primary.id)
          .eq("status", "pending")
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        setNextTurning(turning ?? null);

        /* ---------- Today's turnings ---------- */

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const { data: todays } = await supabase
          .from("turning_schedules")
          .select(
            "id, batch_id, turning_number, scheduled_at, status"
          )
          .in("batch_id", batchIds)
          .gte("scheduled_at", startOfDay.toISOString())
          .lte("scheduled_at", endOfDay.toISOString())
          .order("scheduled_at", { ascending: true });

        setTodaysTurnings(todays ?? []);

        /* ---------- Alerts ---------- */

        const { data: alertRows } = await supabase
          .from("alerts")
          .select(
            "id, batch_id, alert_type, status, temperature_value, ph_value, humidity_value, created_at"
          )
          .in("batch_id", batchIds)
          .order("created_at", { ascending: false })
          .limit(5);

        setAlerts(alertRows ?? []);
      } else {
        setFarmName(null);
        setSensor(null);
        setNextTurning(null);
        setTodaysTurnings([]);
        setAlerts([]);
      }

      /* ---------- Activity ---------- */

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

  /* ============================================================
     REALTIME
     ============================================================ */

  useEffect(() => {
    if (!mainBatch) return;

    const channel = supabase
      .channel(`farmer-dashboard-${mainBatch.id}`)

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
          filter: `batch_id=eq.${mainBatch.id}`,
        },
        (payload) => {
          const row = payload.new as Reading;

          setBatchReadings((prev) => ({
            ...prev,
            [mainBatch.id]: row,
          }));
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
          filter: `batch_id=eq.${mainBatch.id}`,
        },
        () => {
          supabase
            .from("alerts")
            .select(
              "id, batch_id, alert_type, status, temperature_value, ph_value, humidity_value, created_at"
            )
            .in(
              "batch_id",
              batches.map((b) => b.id)
            )
            .order("created_at", { ascending: false })
            .limit(5)
            .then(({ data }) => {
              setAlerts(data ?? []);
            });
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "turning_schedules",
          filter: `batch_id=eq.${mainBatch.id}`,
        },
        () => {
          supabase
            .from("turning_schedules")
            .select(
              "id, batch_id, turning_number, scheduled_at, status"
            )
            .eq("batch_id", mainBatch.id)
            .eq("status", "pending")
            .order("scheduled_at", { ascending: true })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => {
              setNextTurning(data ?? null);
            });
        }
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainBatch?.id, supabase]);

  /* ============================================================
     DISPLAY VALUES
     ============================================================ */

  const batchLabel = (batchId: string) => {
    return (
      batches.find((b) => b.id === batchId)?.batch_code ??
      "Unknown batch"
    );
  };

  const primaryReading = mainBatch
    ? batchReadings[mainBatch.id] ?? null
    : null;

  const primaryHeater = mainBatch
    ? batchHeaterState[mainBatch.id] ?? null
    : null;

  const tempInRange =
    primaryReading?.temperature != null
      ? primaryReading.temperature >= 45 &&
        primaryReading.temperature <= 50
      : null;

  const phInRange =
    primaryReading?.ph != null &&
    phRange.min != null &&
    phRange.max != null
      ? primaryReading.ph >= phRange.min &&
        primaryReading.ph <= phRange.max
      : null;

  const lastUpdatedLabel = primaryReading?.recorded_at
    ? new Date(
        primaryReading.recorded_at
      ).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  /* ============================================================
     LOADING
     ============================================================ */

  if (loading) {
    return (
      <div className="fd-page">
        <div className="fd-header">
          <div>
            <h1>Dashboard</h1>

            <div className="page-subtitle">
              Your fermentation batch at a glance
            </div>
          </div>
        </div>

        <div className="card fd-loading-card">
          <p style={{ color: "var(--color-text-muted)" }}>
            Loading...
          </p>
        </div>

        <style jsx>{styles}</style>
      </div>
    );
  }

  /* ============================================================
     MAIN UI
     ============================================================ */

  return (
    <div className="fd-page">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="fd-header">
        <div className="fd-header-left">
          <h1>
            Good morning, {farmerName || "Farmer"}! 👋
          </h1>

          <div className="page-subtitle">
            Here's the current status of your cacao fermentation
            batch.
          </div>
        </div>

        <div className="fd-system-indicator">
          <div className="fd-system-line">
            <span
              className={`fd-status-dot ${
                dbError ? "fd-status-error" : ""
              }`}
            />

            <span>
              {dbError
                ? "Connection issue"
                : "System Operational"}
            </span>
          </div>

          <div className="fd-last-updated">
            Last updated: {lastUpdatedLabel}
          </div>
        </div>
      </div>

      {/* ======================================================
          EMPTY STATE
      ====================================================== */}

      {!mainBatch ? (
        <div className="card fd-empty-card">
          <div className="fd-empty-icon">🌱</div>

          <h3>No Active Fermentation Batch</h3>

          <p>
            You don't have an active fermentation batch right
            now. Once your admin creates one for your farm,
            it'll show up here.
          </p>

          <div className="fd-monitor-list">
            <div className="fd-monitor-title">
              What you can monitor:
            </div>

            <ul>
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
          {/* ==================================================
              ACTIVE BATCH + PROGRESS
          ================================================== */}

          <div className="fd-main-grid">
            {/* Active Batch */}

            <div className="card fd-batch-card">
              <span className="badge badge-info fd-active-badge">
                Active Fermentation Batch
              </span>

              <div className="fd-batch-title-row">
                <div className="fd-batch-code">
                  {mainBatch.batch_code}
                </div>

                <span className="badge badge-info">
                  Day {fermentationDay(mainBatch.start_date)}
                </span>
              </div>

              {farmName && (
                <div className="fd-farm-name">
                  Farm: {farmName}
                </div>
              )}

              {/* Metrics */}

              <div className="fd-metrics-grid">
                {/* Temperature */}

                <div className="fd-metric">
                  <div className="stat-card-label">
                    Temperature
                  </div>

                  {primaryReading?.temperature != null ? (
                    <>
                      <div className="stat-card-value">
                        {primaryReading.temperature}°C
                      </div>

                      <span
                        className={`badge ${
                          tempInRange
                            ? "badge-success"
                            : "badge-danger"
                        }`}
                      >
                        {tempInRange
                          ? "Normal"
                          : "Out of range"}
                      </span>
                    </>
                  ) : (
                    <div className="fd-no-reading">
                      No current reading
                    </div>
                  )}
                </div>

                {/* pH */}

                <div className="fd-metric">
                  <div className="stat-card-label">
                    pH Level
                  </div>

                  {primaryReading?.ph != null ? (
                    <>
                      <div className="stat-card-value">
                        {primaryReading.ph}
                      </div>

                      {phInRange != null && (
                        <span
                          className={`badge ${
                            phInRange
                              ? "badge-success"
                              : "badge-danger"
                          }`}
                        >
                          {phInRange
                            ? "Normal"
                            : "Out of range"}
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="fd-no-reading">
                      No current reading
                    </div>
                  )}
                </div>

                {/* Humidity */}

                <div className="fd-metric">
                  <div className="stat-card-label">
                    Humidity
                  </div>

                  {primaryReading?.humidity != null ? (
                    <div className="stat-card-value">
                      {primaryReading.humidity}%
                    </div>
                  ) : (
                    <div className="fd-no-reading">
                      No current reading
                    </div>
                  )}
                </div>
              </div>

              {/* Heater */}

              <div className="fd-batch-footer">
                <div>
                  <div className="stat-card-label">
                    Heating Element
                  </div>

                  <div className="fd-heater-status">
                    {primaryHeater == null ? (
                      "No data available"
                    ) : primaryHeater
                        .toLowerCase()
                        .includes("on") ? (
                      "🔥 ON"
                    ) : (
                      "OFF"
                    )}
                  </div>
                </div>

                <div className="fd-started">
                  Started{" "}
                  {new Date(
                    mainBatch.start_date
                  ).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>

            {/* Fermentation Progress */}

            <div className="card fd-progress-card">
              <div className="stat-card-label fd-progress-label">
                Fermentation Progress
              </div>

              <div className="fd-progress-day">
                Day {fermentationDay(mainBatch.start_date)}
              </div>

              <div className="fd-progress-start">
                Started{" "}
                {new Date(
                  mainBatch.start_date
                ).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>

              <div className="fd-progress-icon">
                🌱
              </div>

              <p>
                Keep monitoring the temperature, pH, and
                humidity for optimal fermentation.
              </p>
            </div>
          </div>

          {/* ==================================================
              ACTIVE BATCHES
          ================================================== */}

          {batches.length > 1 && (
            <div className="card fd-section-card">
              <div className="fd-section-title">
                Your Active Batches
              </div>

              <div className="fd-table-wrap">
                <table className="fd-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Day</th>
                      <th>Temperature</th>
                      <th>pH</th>
                      <th>Heater</th>
                    </tr>
                  </thead>

                  <tbody>
                    {batches.map((b) => {
                      const r = batchReadings[b.id];
                      const h = batchHeaterState[b.id];

                      return (
                        <tr key={b.id}>
                          <td>
                            <strong>{b.batch_code}</strong>
                          </td>

                          <td>
                            Day{" "}
                            {fermentationDay(
                              b.start_date
                            )}
                          </td>

                          <td>
                            {r?.temperature != null
                              ? `${r.temperature}°C`
                              : "—"}
                          </td>

                          <td>
                            {r?.ph != null
                              ? r.ph
                              : "—"}
                          </td>

                          <td>
                            {h == null
                              ? "—"
                              : h
                                  .toLowerCase()
                                  .includes("on")
                              ? "ON"
                              : "OFF"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================================================
              ALERTS + TURNING
          ================================================== */}

          <div className="fd-two-column-grid">
            {/* Recent Alerts */}

            <div className="card fd-section-card">
              <div className="fd-section-title">
                Recent Alerts
              </div>

              {alerts.length === 0 ? (
                <p className="fd-muted">
                  No recent alerts.
                </p>
              ) : (
                <div className="fd-list">
                  {alerts.map((a) => {
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
                        className="fd-alert-row"
                      >
                        <div className="fd-alert-left">
                          <span
                            className="fd-alert-dot"
                            style={{
                              background: c.dot,
                            }}
                          />

                          <div className="fd-alert-content">
                            <div className="fd-alert-title">
                              {formatAlertType(
                                a.alert_type
                              )}
                            </div>

                            <div className="fd-alert-detail">
                              Batch{" "}
                              {batchLabel(a.batch_id)}

                              {value
                                ? ` · ${value}`
                                : ""}
                            </div>
                          </div>
                        </div>

                        <div className="fd-alert-time">
                          {timeAgo(a.created_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Today's Turning */}

            <div className="card fd-section-card">
              <div className="fd-section-title">
                Today's Turning Schedule
              </div>

              {todaysTurnings.length === 0 ? (
                <p className="fd-muted">
                  No turnings scheduled for today.
                </p>
              ) : (
                <div className="fd-list">
                  {todaysTurnings.map((t) => (
                    <div
                      key={t.id}
                      className="fd-turning-row"
                    >
                      <div>
                        <div className="fd-turning-time">
                          {new Date(
                            t.scheduled_at
                          ).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>

                        <div className="fd-turning-detail">
                          Batch{" "}
                          {batchLabel(t.batch_id)} ·
                          Turning #
                          {t.turning_number}
                        </div>
                      </div>

                      <span
                        className={`badge ${
                          t.status === "completed"
                            ? "badge-success"
                            : "badge-info"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {nextTurning && (
                <div className="fd-next-turning">
                  <div className="stat-card-label">
                    Next turning
                  </div>

                  <TurningCountdown
                    scheduledAt={
                      nextTurning.scheduled_at
                    }
                    turningNumber={
                      nextTurning.turning_number
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* ==================================================
              SYSTEM STATUS + ACTIVITY
          ================================================== */}

          <div className="fd-two-column-grid fd-bottom-grid">
            {/* System Status */}

            <div className="card fd-section-card">
              <div className="fd-section-title">
                System Status
              </div>

              

            
            </div>

            {/* Recent Activity */}

            <div className="card fd-section-card">
              <div className="fd-section-title">
                Recent System Activity
              </div>

              {activity.length === 0 ? (
                <p className="fd-muted">
                  No recent activity.
                </p>
              ) : (
                <div className="fd-list">
                  {activity.map((a) => (
                    <div
                      key={a.id}
                      className="fd-activity-row"
                    >
                      <span>
                        {formatAction(a.action)}
                      </span>

                      <span className="fd-activity-time">
                        {new Date(
                          a.created_at
                        ).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ======================================================
          RESPONSIVE STYLES
      ====================================================== */}

      <style jsx>{styles}</style>
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const styles = `
  /* ==========================================================
     PAGE
  ========================================================== */

  .fd-page {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .fd-loading-card {
    padding: 24px;
  }

  /* ==========================================================
     HEADER
  ========================================================== */

  .fd-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 20px;
  }

  .fd-header-left {
    min-width: 0;
  }

  .fd-header-left h1 {
    margin-bottom: 6px;
  }

  .fd-system-indicator {
    flex-shrink: 0;
    text-align: right;
    font-size: 13px;
  }

  .fd-system-line {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 7px;
    font-weight: 500;
  }

  .fd-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    background: #22c55e;
    flex-shrink: 0;
  }

  .fd-status-error {
    background: #ef4444;
  }

  .fd-last-updated {
    color: var(--color-text-muted);
    margin-top: 3px;
  }

  /* ==========================================================
     MAIN GRID
  ========================================================== */

  .fd-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
    gap: 16px;
    margin-bottom: 20px;
  }

  .fd-main-grid > * {
    min-width: 0;
  }

  /* ==========================================================
     ACTIVE BATCH
  ========================================================== */

  .fd-batch-card {
    min-width: 0;
    overflow: hidden;
  }

  .fd-active-badge {
    margin-bottom: 10px;
    display: inline-block;
  }

  .fd-batch-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .fd-batch-code {
    font-weight: 700;
    font-size: 20px;
  }

  .fd-farm-name {
    font-size: 13.5px;
    color: var(--color-text-muted);
    margin-bottom: 14px;
  }

  /* ==========================================================
     METRICS
  ========================================================== */

  .fd-metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 14px;
  }

  .fd-metric {
    min-width: 0;
  }

  .fd-no-reading {
    color: var(--color-text-muted);
    font-size: 13.5px;
    margin-top: 6px;
  }

  /* ==========================================================
     BATCH FOOTER
  ========================================================== */

  .fd-batch-footer {
    padding-top: 12px;
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .fd-heater-status {
    font-weight: 600;
  }

  .fd-started {
    font-size: 13px;
    color: var(--color-text-muted);
    text-align: right;
  }

  /* ==========================================================
     PROGRESS
  ========================================================== */

  .fd-progress-card {
    text-align: center;
    min-width: 0;
    overflow: hidden;
  }

  .fd-progress-label {
    margin-bottom: 10px;
  }

  .fd-progress-day {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .fd-progress-start {
    font-size: 13px;
    color: var(--color-text-muted);
    margin-bottom: 16px;
  }

  .fd-progress-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  .fd-progress-card p {
    font-size: 13px;
    color: var(--color-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  /* ==========================================================
     TWO COLUMN SECTIONS
  ========================================================== */

  .fd-two-column-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 20px;
  }

  .fd-two-column-grid > * {
    min-width: 0;
  }

  .fd-bottom-grid {
    margin-bottom: 0;
  }

  .fd-section-card {
    min-width: 0;
    overflow: hidden;
  }

  .fd-section-title {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 14px;
  }

  .fd-muted {
    color: var(--color-text-muted);
    font-size: 13.5px;
    margin: 0;
  }

  /* ==========================================================
     ALERTS
  ========================================================== */

  .fd-list {
    width: 100%;
  }

  .fd-alert-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 11px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .fd-alert-row:last-child {
    border-bottom: none;
  }

  .fd-alert-left {
    display: flex;
    gap: 9px;
    align-items: flex-start;
    min-width: 0;
  }

  .fd-alert-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;
  }

  .fd-alert-content {
    min-width: 0;
  }

  .fd-alert-title {
    font-weight: 600;
    font-size: 13.5px;
    overflow-wrap: anywhere;
  }

  .fd-alert-detail {
    font-size: 12.5px;
    color: var(--color-text-muted);
    margin-top: 2px;
    overflow-wrap: anywhere;
  }

  .fd-alert-time {
    font-size: 12px;
    color: var(--color-text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ==========================================================
     TURNING
  ========================================================== */

  .fd-turning-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 11px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .fd-turning-row:last-child {
    border-bottom: none;
  }

  .fd-turning-time {
    font-weight: 600;
    font-size: 13.5px;
  }

  .fd-turning-detail {
    font-size: 12.5px;
    color: var(--color-text-muted);
    margin-top: 2px;
  }

  .fd-next-turning {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--color-border);
  }

  /* ==========================================================
     SYSTEM STATUS
  ========================================================== */

  .fd-status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 11px 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 13.5px;
  }

  .fd-status-row:last-child {
    border-bottom: none;
  }

  /* ==========================================================
     ACTIVITY
  ========================================================== */

  .fd-activity-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 13px;
  }

  .fd-activity-row:last-child {
    border-bottom: none;
  }

  .fd-activity-time {
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  /* ==========================================================
     TABLE
  ========================================================== */

  .fd-section-card:has(.fd-table-wrap) {
    margin-bottom: 20px;
  }

  .fd-table-wrap {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .fd-table {
    width: 100%;
    min-width: 560px;
    border-collapse: collapse;
    font-size: 13.5px;
  }

  .fd-table th {
    text-align: left;
    padding: 8px;
    color: var(--color-text-muted);
    font-weight: 600;
    white-space: nowrap;
  }

  .fd-table td {
    padding: 10px 8px;
    border-top: 1px solid var(--color-border);
    white-space: nowrap;
  }

  /* ==========================================================
     EMPTY STATE
  ========================================================== */

  .fd-empty-card {
    padding: 28px;
  }

  .fd-empty-icon {
    font-size: 34px;
    margin-bottom: 10px;
  }

  .fd-empty-card h3 {
    margin: 0 0 8px;
    font-size: 17px;
  }

  .fd-empty-card p {
    color: var(--color-text-muted);
    margin: 0 0 16px;
    line-height: 1.55;
    font-size: 13.5px;
    max-width: 650px;
  }

  .fd-monitor-title {
    font-weight: 600;
    margin-bottom: 6px;
    font-size: 13.5px;
  }

  .fd-monitor-list ul {
    padding-left: 18px;
    margin: 0;
    color: var(--color-text-muted);
    font-size: 13.5px;
    line-height: 1.7;
  }

  /* ==========================================================
     TABLET
  ========================================================== */

  @media (max-width: 900px) {
    .fd-main-grid {
      grid-template-columns: 1fr;
    }

    .fd-two-column-grid {
      grid-template-columns: 1fr;
    }

    .fd-progress-card {
      text-align: left;
    }

    .fd-progress-icon {
      display: none;
    }
  }

  /* ==========================================================
     MOBILE
  ========================================================== */

  @media (max-width: 640px) {
    .fd-page {
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
    }

    /* Header */

    .fd-header {
      flex-direction: column;
      gap: 10px;
      margin-bottom: 14px;
    }

    .fd-header-left h1 {
      font-size: 24px !important;
      line-height: 1.25;
      margin-bottom: 5px;
    }

    .fd-system-indicator {
      width: 100%;
      text-align: left;
    }

    .fd-system-line {
      justify-content: flex-start;
    }

    /* Main grid */

    .fd-main-grid {
      grid-template-columns: 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }

    /* Cards */

    .fd-batch-card,
    .fd-progress-card,
    .fd-section-card,
    .fd-empty-card {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .fd-batch-card,
    .fd-progress-card,
    .fd-section-card {
      padding: 17px;
    }

    /* Batch */

    .fd-batch-code {
      font-size: 19px;
    }

    .fd-farm-name {
      margin-bottom: 10px;
    }

    /* Metrics become vertical */

    .fd-metrics-grid {
      grid-template-columns: 1fr;
      gap: 0;
      margin-bottom: 10px;
    }

    .fd-metric {
      padding: 12px 0;
      border-bottom: 1px solid var(--color-border);
    }

    .fd-metric:last-child {
      border-bottom: none;
    }

    .stat-card-value {
      font-size: 28px !important;
      line-height: 1.15;
      margin-top: 4px;
      margin-bottom: 5px;
    }

    /* Footer */

    .fd-batch-footer {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .fd-started {
      text-align: left;
    }

    /* Progress */

    .fd-progress-card {
      text-align: left;
    }

    .fd-progress-day {
      font-size: 30px;
    }

    .fd-progress-icon {
      display: none;
    }

    /* Two-column sections become one column */

    .fd-two-column-grid {
      grid-template-columns: 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }

    /* Alerts */

    .fd-alert-row {
      gap: 8px;
    }

    .fd-alert-time {
      font-size: 11px;
    }

    .fd-alert-detail {
      line-height: 1.4;
    }

    /* Turning */

    .fd-turning-row {
      align-items: flex-start;
    }

    /* System status */

    .fd-status-row {
      padding: 10px 0;
    }

    /* Table */

    .fd-section-card:has(.fd-table-wrap) {
      margin-bottom: 12px;
    }

    .fd-table-wrap {
      margin-left: -2px;
      width: calc(100% + 4px);
    }

    /* Empty */

    .fd-empty-card {
      padding: 20px;
    }

    /* Badges */

    .badge {
      font-size: 11px;
    }
  }

  /* ==========================================================
     SMALL PHONE
  ========================================================== */

  @media (max-width: 400px) {
    .fd-batch-card,
    .fd-progress-card,
    .fd-section-card {
      padding: 15px;
    }

    .fd-header-left h1 {
      font-size: 22px !important;
    }

    .stat-card-value {
      font-size: 26px !important;
    }

    .fd-alert-row {
      align-items: flex-start;
    }

    .fd-alert-time {
      font-size: 10.5px;
    }

    .fd-section-title {
      font-size: 14.5px;
    }
  }
`;