"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ---------- Config ---------- */

// Kung wala nag-send ug data ang sensor sulod ani nga minutes, "Offline" na siya.
const OFFLINE_THRESHOLD_MINUTES = 5;

/* ---------- Types ---------- */

type BatchOption = {
  id: string;
  batch_code: string;
  status: string;
};

type Sensor = {
  id: string;
  sensor_code: string;
  farm_id: string | null;
  batch_id: string | null;
  status: string; // raw DB value, no longer used for display
  last_reading_at: string | null;
  created_at: string;
  fermentation_batches?: { batch_code: string } | null;
};

/* ---------- Helper: compute real-time status from last_reading_at ---------- */

function getEffectiveStatus(lastReadingAt: string | null): "online" | "offline" {
  if (!lastReadingAt) return "offline";
  const diffMs = Date.now() - new Date(lastReadingAt).getTime();
  const diffMinutes = diffMs / 1000 / 60;
  return diffMinutes <= OFFLINE_THRESHOLD_MINUTES ? "online" : "offline";
}

/* ---------- Component ---------- */

export default function Page() {
  const supabase = useMemo(() => createClient(), []);

  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now()); // ticks to re-evaluate freshness without refetch

  /* ---- Load sensors + batches ---- */

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);

    const [sensorsRes, batchesRes] = await Promise.all([
      supabase
        .from("sensors")
        .select("*, fermentation_batches:batch_id(batch_code)")
        .order("created_at", { ascending: false }),
      supabase
        .from("fermentation_batches")
        .select("id, batch_code, status")
        .order("batch_code", { ascending: true }),
    ]);

    if (sensorsRes.error) setErrorMsg(sensorsRes.error.message);
    else setSensors(sensorsRes.data as Sensor[]);

    if (batchesRes.error) setErrorMsg((prev) => prev ?? batchesRes.error.message);
    else setBatches(batchesRes.data as BatchOption[]);

    setLoading(false);
  }

  useEffect(() => {
    loadData();

    // Re-fetch latest readings every 30s so "Last reading" & status stay fresh
    const fetchInterval = setInterval(loadData, 30_000);
    // Re-evaluate online/offline every 5s even between fetches (in case data goes stale)
    const tickInterval = setInterval(() => setNow(Date.now()), 5_000);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(tickInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Reassign a sensor's batch ---- */

  async function handleBatchChange(sensor: Sensor, newBatchId: string) {
    setSavingId(sensor.id);
    setErrorMsg(null);

    const { error } = await supabase
      .from("sensors")
      .update({ batch_id: newBatchId || null })
      .eq("id", sensor.id);

    setSavingId(null);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    await loadData();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sensors</h1>
          <div className="page-subtitle">
            Sensors appear here automatically once powered on. Assign them to a batch below.
          </div>
        </div>
      </div>

      <div className="card">
        {errorMsg && <div className="sn-error">{errorMsg}</div>}

        {loading ? (
          <div className="sn-empty">Loading sensors...</div>
        ) : sensors.length === 0 ? (
          <div className="sn-empty">
            No sensors detected yet. Power on a sensor device and it will appear here automatically.
          </div>
        ) : (
          <div className="sn-table-wrap">
            <table className="sn-table">
              <thead>
                <tr>
                  <th>Sensor (MAC address)</th>
                  <th>Assigned batch</th>
                  <th>Status</th>
                  <th>Last reading</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map((sensor) => {
                  const effectiveStatus = getEffectiveStatus(sensor.last_reading_at);
                  return (
                    <tr key={sensor.id}>
                      <td data-label="Sensor" className="sn-sensor-code">
                        {sensor.sensor_code}
                      </td>
                      <td data-label="Assigned batch">
                        <select
                          className="sn-batch-select"
                          value={sensor.batch_id ?? ""}
                          disabled={savingId === sensor.id}
                          onChange={(e) => handleBatchChange(sensor, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {batches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.batch_code} {b.status === "completed" ? "(completed)" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`sn-badge ${
                            effectiveStatus === "online" ? "sn-badge-green" : "sn-badge-gray"
                          }`}
                          title={
                            effectiveStatus === "offline"
                              ? `No data received in the last ${OFFLINE_THRESHOLD_MINUTES} min`
                              : "Receiving data"
                          }
                        >
                          {effectiveStatus === "online" ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td data-label="Last reading">
                        {sensor.last_reading_at
                          ? new Date(sensor.last_reading_at).toLocaleString()
                          : "Never"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .sn-error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fbd5d5;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .sn-empty {
          padding: 48px 16px;
          text-align: center;
          color: var(--color-text-muted, #8b8fa3);
          font-size: 14px;
        }

        .sn-table-wrap {
          overflow-x: auto;
        }

        .sn-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .sn-table th {
          text-align: left;
          padding: 12px 16px;
          color: var(--color-text-muted, #8b8fa3);
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
          white-space: nowrap;
        }

        .sn-table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--color-border, #f0f1f5);
          white-space: nowrap;
        }

        .sn-sensor-code {
          font-weight: 600;
          font-family: monospace;
        }

        .sn-batch-select {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--color-border, #e5e7eb);
          font-size: 13px;
          outline: none;
          min-width: 180px;
        }
        .sn-batch-select:focus {
          border-color: #6c4ff6;
          box-shadow: 0 0 0 3px rgba(108, 79, 246, 0.15);
        }

        .sn-badge {
          display: inline-block;
          padding: 5px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        .sn-badge-green {
          background: #eafaf0;
          color: #15803d;
        }
        .sn-badge-gray {
          background: #f3f4f6;
          color: #6b7280;
        }

        @media (max-width: 640px) {
          .page-header {
            flex-direction: column;
          }
          .sn-table thead {
            display: none;
          }
          .sn-table,
          .sn-table tbody,
          .sn-table tr,
          .sn-table td {
            display: block;
            width: 100%;
          }
          .sn-table tr {
            margin-bottom: 12px;
            border: 1px solid var(--color-border, #e5e7eb);
            border-radius: 12px;
            padding: 4px 0;
          }
          .sn-table td {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            border-bottom: 1px solid var(--color-border, #f0f1f5);
            white-space: normal;
            text-align: right;
          }
          .sn-table tr td:last-child {
            border-bottom: none;
          }
          .sn-table td::before {
            content: attr(data-label);
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            color: var(--color-text-muted, #8b8fa3);
            text-align: left;
            margin-right: 12px;
          }
          .sn-batch-select {
            min-width: 0;
            max-width: 60%;
          }
        }
      `}</style>
    </div>
  );
}