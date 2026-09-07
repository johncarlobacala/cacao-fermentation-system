"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { SimpleLineChart } from "@/components/ui/SimpleLineChart";

type Alert = {
  id: string;
  alert_type: string;
  temperature_value: number;
  created_at: string;
  fermentation_batches?: { batch_code: string } | null;
};

type Turning = {
  id: string;
  turning_number: number;
  scheduled_at: string;
  status: string;
  fermentation_batches?: {
    batch_code: string;
    farmer_id: string;
    profiles?: { full_name: string } | null;
  } | null;
};

type CompletedBatch = {
  id: string;
  batch_code: string;
  completed_at: string;
};

type Reading = {
  temperature: number | null;
  ph: number | null;
  humidity: number | null;
  recorded_at: string;
};

/**
 * Shared notification bell button used in the header.
 * Previously this markup only existed inside the `loading` early-return,
 * so once loading finished and the main dashboard rendered, the bell
 * disappeared entirely. Extracting it here lets both render paths use it.
 */
function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <button
      type="button"
      className="dashboard-notification"
      onClick={() => {
        window.location.href = "/admin/notifications";
      }}
      aria-label="Notifications"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {unreadCount > 0 && (
        <span className="notification-red-dot">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}

export default function AdminDashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [farmerCount, setFarmerCount] = useState(0);
  const [farmCount, setFarmCount] = useState(0);
  const [activeBatchCount, setActiveBatchCount] = useState(0);
  const [sensorsOnline, setSensorsOnline] = useState(0);
  const [sensorsOffline, setSensorsOffline] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [upcomingTurnings, setUpcomingTurnings] = useState<Turning[]>([]);
  const [recentCompleted, setRecentCompleted] = useState<CompletedBatch[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  /**
   * Fetches upcoming (pending, future-dated) turning schedules.
   *
   * NOTE: We deliberately do NOT rely on a single embedded/nested Supabase
   * select (e.g. `fermentation_batches(batch_code, farmer_id, profiles(full_name))`).
   * If the foreign key relationship between turning_schedules -> fermentation_batches
   * -> profiles isn't cleanly resolvable by PostgREST (missing/ambiguous FK,
   * multiple possible join paths, etc.), that embedded query silently errors
   * out and returns null data — which is why the dashboard was showing
   * "No turnings scheduled" even though rows existed in the table.
   *
   * Instead we fetch each table separately and merge them here in JS, which
   * works regardless of how the FK constraints are (or aren't) set up.
   */
  async function fetchUpcomingTurnings(): Promise<Turning[]> {
    const { data: schedules, error: schedulesError } = await supabase
      .from("turning_schedules")
      .select("id, turning_number, scheduled_at, status, batch_id")
      .eq("status", "pending")
      .gt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5);

    if (schedulesError) {
      console.error("Upcoming turnings (schedules) error:", schedulesError);
      return [];
    }
    if (!schedules || schedules.length === 0) return [];

    const batchIds = Array.from(
      new Set(schedules.map((s: any) => s.batch_id).filter(Boolean))
    );

    let batches: any[] = [];
    if (batchIds.length > 0) {
      const { data: batchesData, error: batchesError } = await supabase
        .from("fermentation_batches")
        .select("id, batch_code, farmer_id")
        .in("id", batchIds);

      if (batchesError) {
        console.error("Upcoming turnings (batches) error:", batchesError);
      } else {
        batches = batchesData ?? [];
      }
    }

    const farmerIds = Array.from(
      new Set(batches.map((b) => b.farmer_id).filter(Boolean))
    );

    let farmerProfiles: any[] = [];
    if (farmerIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", farmerIds);

      if (profilesError) {
        console.error("Upcoming turnings (profiles) error:", profilesError);
      } else {
        farmerProfiles = profilesData ?? [];
      }
    }

    const batchMap = new Map(batches.map((b) => [b.id, b]));
    const profileMap = new Map(farmerProfiles.map((p) => [p.id, p]));

    return schedules.map((s: any) => {
      const batch = batchMap.get(s.batch_id);
      const profile = batch ? profileMap.get(batch.farmer_id) : undefined;

      return {
        id: s.id,
        turning_number: s.turning_number,
        scheduled_at: s.scheduled_at,
        status: s.status,
        fermentation_batches: batch
          ? {
              batch_code: batch.batch_code,
              farmer_id: batch.farmer_id,
              profiles: profile ? { full_name: profile.full_name } : null,
            }
          : null,
      };
    });
  }

  async function loadUnreadNotifications() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUnreadNotifications(0);
      return;
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error("Unread notifications error:", error);
      setUnreadNotifications(0);
      return;
    }

    setUnreadNotifications(count ?? 0);
  }

  async function loadData() {
    const [
      { count: fCount },
      { count: farmC },
      { count: activeC },
      { count: onlineC },
      { count: offlineC },
      { data: alerts },
      turningsResult,
      { data: completed },
      { data: recentReadings },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "farmer"),
      supabase.from("farms").select("*", { count: "exact", head: true }),
      supabase
        .from("fermentation_batches")
        .select("*", { count: "exact", head: true })
        .eq("status", "ongoing"),
      supabase.from("sensors").select("*", { count: "exact", head: true }).eq("status", "online"),
      supabase.from("sensors").select("*", { count: "exact", head: true }).eq("status", "offline"),
      supabase
        .from("alerts")
        .select("id, alert_type, temperature_value, created_at, fermentation_batches(batch_code)")
        .order("created_at", { ascending: false })
        .limit(5),
      fetchUpcomingTurnings(),
      supabase
        .from("fermentation_batches")
        .select("id, batch_code, completed_at")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(5),
      supabase
        .from("sensor_readings")
        .select("temperature, ph, humidity, recorded_at")
        .gte("recorded_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("recorded_at", { ascending: true })
        .limit(50),
    ]);

    setFarmerCount(fCount ?? 0);
    setFarmCount(farmC ?? 0);
    setActiveBatchCount(activeC ?? 0);
    setSensorsOnline(onlineC ?? 0);
    setSensorsOffline(offlineC ?? 0);
    setRecentAlerts((alerts as any) ?? []);
    setUpcomingTurnings(turningsResult ?? []);
    setRecentCompleted(completed ?? []);
    setReadings(recentReadings ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    loadUnreadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Realtime subscriptions ---- */
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sensor_readings" },
        (payload) => {
          const row = payload.new as Reading;
          setReadings((prev) => {
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;
            const updated = [...prev, row].filter(
              (r) => new Date(r.recorded_at).getTime() >= cutoff
            );
            return updated.slice(-50);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        () => {
          supabase
            .from("alerts")
            .select("id, alert_type, temperature_value, created_at, fermentation_batches(batch_code)")
            .order("created_at", { ascending: false })
            .limit(5)
            .then(({ data }) => setRecentAlerts((data as any) ?? []));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "turning_schedules" },
        () => {
          fetchUpcomingTurnings().then((data) => setUpcomingTurnings(data));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "fermentation_batches" },
        () => {
          // Refresh counts + completed list + active batch count when a batch changes status
          supabase
            .from("fermentation_batches")
            .select("*", { count: "exact", head: true })
            .eq("status", "ongoing")
            .then(({ count }) => setActiveBatchCount(count ?? 0));

          supabase
            .from("fermentation_batches")
            .select("id, batch_code, completed_at")
            .eq("status", "completed")
            .order("completed_at", { ascending: false })
            .limit(5)
            .then(({ data }) => setRecentCompleted(data ?? []));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sensors" },
        () => {
          supabase
            .from("sensors")
            .select("*", { count: "exact", head: true })
            .eq("status", "online")
            .then(({ count }) => setSensorsOnline(count ?? 0));

          supabase
            .from("sensors")
            .select("*", { count: "exact", head: true })
            .eq("status", "offline")
            .then(({ count }) => setSensorsOffline(count ?? 0));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          loadUnreadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const chartPoints = readings.map((r) => ({
    label: new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    value: Number(r.temperature),
  }));

  const phChartPoints = readings
    .filter((r) => r.ph !== null && r.ph !== undefined)
    .map((r) => ({
      label: new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: Number(r.ph),
    }));

  const humidityChartPoints = readings
    .filter((r) => r.humidity !== null && r.humidity !== undefined)
    .map((r) => ({
      label: new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: Number(r.humidity),
    }));

  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;
  const latestTemperature =
    latestReading?.temperature != null ? `${Number(latestReading.temperature).toFixed(1)}°C` : "—";
  const latestPh = latestReading?.ph != null ? Number(latestReading.ph).toFixed(2) : "—";
  const latestHumidity =
    latestReading?.humidity != null ? `${Number(latestReading.humidity).toFixed(1)}%` : "—";

  if (loading) {
    return (
      <div className="page-header dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <div className="page-subtitle">
            System-wide overview of every active batch
          </div>
        </div>

        <NotificationBell unreadCount={unreadNotifications} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="page-subtitle">System-wide overview of every active batch</div>
        </div>

        <NotificationBell unreadCount={unreadNotifications} />
      </div>

      {/* Counts row */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard label="Total farmers" value={farmerCount} color="blue" />
        <StatCard label="Total active farms" value={farmCount} color="green" />
        <StatCard label="Active fermentation batches" value={activeBatchCount} color="amber" />
        <StatCard
          label="Sensors online / offline"
          value={`${sensorsOnline} / ${sensorsOffline}`}
          color={sensorsOffline ? "red" : "green"}
        />
      </div>

      {/* Current readings row — Temperature, pH, Humidity aligned together */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Current temperature" value={latestTemperature} color="red" />
        <StatCard label="Current pH" value={latestPh} color="blue" />
        <StatCard label="Current humidity" value={latestHumidity} color="green" />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16, fontSize: 15 }}>Temperature trend — last 24 hours</h3>
        <SimpleLineChart points={chartPoints} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>pH trend — last 24 hours</h3>
          {phChartPoints.length > 0 ? (
            <SimpleLineChart points={phChartPoints} />
          ) : (
            <EmptyRow text="No pH readings yet." />
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Humidity trend — last 24 hours</h3>
          {humidityChartPoints.length > 0 ? (
            <SimpleLineChart points={humidityChartPoints} />
          ) : (
            <EmptyRow text="No humidity readings yet." />
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Recent alerts</h3>
          {!recentAlerts.length && <EmptyRow text="No alerts recorded." />}
          {recentAlerts.map((a) => (
            <div key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{a.fermentation_batches?.batch_code}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                {a.alert_type === "high_temperature" ? "High temperature" : "Low temperature"} —{" "}
                {a.temperature_value}°C · {timeAgo(a.created_at)}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Upcoming turnings today</h3>
          {!upcomingTurnings.length && <EmptyRow text="No turnings scheduled for today." />}
          {upcomingTurnings.map((t) => (
            <div
              key={t.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {t.fermentation_batches?.batch_code} — Turning #{t.turning_number}
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  {t.fermentation_batches?.profiles?.full_name} ·{" "}
                  {new Date(t.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <a href={`/admin/turning`} className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }}>
                View
              </a>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Recently completed batches</h3>
          {!recentCompleted.length && <EmptyRow text="No completed batches yet." />}
          {recentCompleted.map((b) => (
            <div key={b.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{b.batch_code}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                Completed {new Date(b.completed_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div style={{ color: "var(--color-text-muted)", fontSize: 13.5, padding: "8px 0" }}>{text}</div>;
}

function timeAgo(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}