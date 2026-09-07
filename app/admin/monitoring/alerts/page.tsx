"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Alert = {
  id: string;
  batch_id: string | null;
  sensor_id: string;
  alert_type: string;
  temperature_value: number | null;
  ph_value: number | null;
  humidity_value: number | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  fermentation_batches?: { batch_code: string } | null;
};

export default function Page() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const status = searchParams.get("status");
  const activeFilter =
    status === "resolved" ? "resolved" : status === "all" ? "all" : "active";

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAlerts(filter: string, silent = false) {
    if (!silent) setLoading(true);
    setError(null);

    let query = supabase
      .from("alerts")
      .select(
        "id, batch_id, sensor_id, alert_type, temperature_value, ph_value, humidity_value, status, created_at, resolved_at, fermentation_batches(batch_code)"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter === "active") {
      query = query.eq("status", "active");
    } else if (filter === "resolved") {
      query = query.eq("status", "resolved");
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      if (!silent) setAlerts([]);
      setLoading(false);
      return;
    }

    setAlerts((data as unknown as Alert[]) ?? []);
    setLoading(false);
  }

  // Re-fetch whenever the filter (URL query param) changes.
  useEffect(() => {
    loadAlerts(activeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  // Realtime: any insert/update on the alerts table re-fetches the
  // currently filtered list. We re-fetch (instead of patching state
  // in place) because a new/changed alert can affect which filter
  // bucket it belongs in (e.g. active -> resolved), and because the
  // joined fermentation_batches.batch_code isn't included in the
  // realtime payload itself.
  useEffect(() => {
    const channel = supabase
      .channel("alerts-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        () => loadAlerts(activeFilter, true)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "alerts" },
        () => loadAlerts(activeFilter, true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Alerts</h1>
          <div className="page-subtitle">
            Out-of-range temperature, pH, and humidity alerts. Automatically
            resolved once new readings return to normal range.
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}
      >
        <FilterLink current={activeFilter} value="active" label="Active" />
        <FilterLink current={activeFilter} value="resolved" label="Resolved" />
        <FilterLink current={activeFilter} value="all" label="All" />
      </div>

      <div className="card">
        {error && (
          <p style={{ color: "var(--color-danger, red)" }}>
            Failed to load alerts: {error}
          </p>
        )}

        {!error && loading && (
          <p style={{ color: "var(--color-text-muted)" }}>Loading...</p>
        )}

        {!error && !loading && alerts.length === 0 && (
          <p style={{ color: "var(--color-text-muted)" }}>No alerts found.</p>
        )}

        {!error && !loading && alerts.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <th style={{ padding: "0.5rem" }}>Type</th>
                <th style={{ padding: "0.5rem" }}>Temp (°C)</th>
                <th style={{ padding: "0.5rem" }}>pH</th>
                <th style={{ padding: "0.5rem" }}>Humidity (%)</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Batch</th>
                <th style={{ padding: "0.5rem" }}>Sensor</th>
                <th style={{ padding: "0.5rem" }}>Created</th>
                <th style={{ padding: "0.5rem" }}>Resolved</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr
                  key={alert.id}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td style={{ padding: "0.5rem" }}>{alert.alert_type}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {alert.temperature_value ?? "—"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {alert.ph_value ?? "—"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {alert.humidity_value ?? "—"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <span
                      style={{
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        background:
                          alert.status === "resolved"
                            ? "var(--color-success-bg, #dcfce7)"
                            : "var(--color-danger-bg, #fee2e2)",
                        color:
                          alert.status === "resolved"
                            ? "var(--color-success, #16a34a)"
                            : "var(--color-danger, #dc2626)",
                      }}
                    >
                      {alert.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {alert.fermentation_batches?.batch_code ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "0.5rem",
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {alert.sensor_id.slice(0, 8)}…
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {new Date(alert.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {alert.resolved_at
                      ? new Date(alert.resolved_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FilterLink({
  current,
  value,
  label,
}: {
  current: string;
  value: string;
  label: string;
}) {
  const isActive = current === value;
  const href = "?status=" + value;

  return (
    <Link
      href={href}
      style={{
        padding: "0.35rem 0.75rem",
        borderRadius: "6px",
        fontSize: "0.85rem",
        textDecoration: "none",
        background: isActive ? "var(--color-primary, #6d28d9)" : "transparent",
        color: isActive ? "white" : "var(--color-text-muted)",
      }}
    >
      {label}
    </Link>
  );
}