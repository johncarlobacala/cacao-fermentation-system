"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { SimpleLineChart } from "@/components/ui/SimpleLineChart";

type BatchOption = {
  id: string;
  batch_code: string;
  status: string;
};

type Reading = {
  id: string;
  temperature: number | null;
  ph: number | null;
  humidity: number | null;
  recorded_at: string;
};

export default function Page() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const batchFromUrl = searchParams.get("batch");

  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [heatingStatus, setHeatingStatus] = useState("OFF");
  const [loading, setLoading] = useState(true);
  const [loadingReadings, setLoadingReadings] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /* ---- Load ongoing batches for the selector ---- */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("fermentation_batches")
        .select("id, batch_code, status")
        .eq("status", "ongoing")
        .order("batch_code", { ascending: true });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setBatches(data ?? []);
        if (data && data.length > 0) {
          const urlExists = data.find((b) => b.id === batchFromUrl);

          if (urlExists) {
            setSelectedBatch(batchFromUrl!);
            localStorage.setItem("selectedBatch", batchFromUrl!);
          } else {
            const savedBatch = localStorage.getItem("selectedBatch");
            const savedExists = data.find((b) => b.id === savedBatch);

            if (savedExists) {
              setSelectedBatch(savedBatch!);
            } else {
              setSelectedBatch(data[0].id);
              localStorage.setItem("selectedBatch", data[0].id);
            }
          }
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Load readings whenever selected batch changes ---- */
  useEffect(() => {
    if (!selectedBatch) {
      setReadings([]);
      setHeatingStatus("OFF");
      return;
    }

    (async () => {
      setLoadingReadings(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("sensor_readings")
        .select("id, temperature, ph, humidity, recorded_at")
        .eq("batch_id", selectedBatch)
        .gte(
          "recorded_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        )
        .order("recorded_at", { ascending: true })
        .limit(200);

      if (error) {
        setErrorMsg(error.message);
        setReadings([]);
        setHeatingStatus("OFF");
      } else {
        setReadings(data ?? []);

        const { data: actuatorData } = await supabase
          .from("actuator_logs")
          .select("action")
          .eq("batch_id", selectedBatch)
          .order("activated_at", { ascending: false })
          .limit(1);

        if (actuatorData && actuatorData.length > 0) {
          setHeatingStatus(actuatorData[0].action);
        } else {
          setHeatingStatus("OFF");
        }
      }

      setLoadingReadings(false);
    })();
  }, [selectedBatch, supabase]);

  const tempChartPoints = readings
    .filter((r) => r.temperature !== null)
    .map((r) => ({
      label: new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: Number(r.temperature),
    }));

  const phChartPoints = readings
    .filter((r) => r.ph !== null)
    .map((r) => ({
      label: new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: Number(r.ph),
    }));

  const latest = readings.length > 0 ? readings[readings.length - 1] : null;
  const latestTemp = latest?.temperature != null ? `${Number(latest.temperature).toFixed(1)}°C` : "—";
  const latestPh = latest?.ph != null ? Number(latest.ph).toFixed(2) : "—";
  const latestHumidity = latest?.humidity != null ? `${Number(latest.humidity).toFixed(1)}%` : "—";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sensor Readings
</h1>
          <div className="page-subtitle">View live sensor readings and historical data per fermentation batch.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="temp-batch-select">
          <label className="temp-field-label">Select batch</label>
          {loading ? (
            <div style={{ color: "var(--color-text-muted)" }}>Loading batches...</div>
          ) : batches.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)" }}>No ongoing batches to monitor.</div>
          ) : (
            <select
              className="text-input"
              value={selectedBatch}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedBatch(value);
                localStorage.setItem("selectedBatch", value);
              }}
              style={{ maxWidth: 320 }}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_code}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {errorMsg && <div className="form-error" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      {selectedBatch && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatCard label="Current temperature" value={latestTemp} color="amber" />
            <StatCard label="Current pH" value={latestPh} color="blue" />
            <StatCard label="Current humidity" value={latestHumidity} color="green" />
            <StatCard
              label="Heating Element"
              value={heatingStatus === "ON" ? "Active" : "Inactive"}
              color={heatingStatus === "ON" ? "amber" : "green"}
            />
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
              <h3 style={{ marginBottom: 16, fontSize: 15 }}>Temperature trend — last 24 hours</h3>
              {loadingReadings ? (
                <div style={{ color: "var(--color-text-muted)" }}>Loading...</div>
              ) : tempChartPoints.length > 0 ? (
                <SimpleLineChart points={tempChartPoints} />
              ) : (
                <div style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>No readings yet.</div>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 16, fontSize: 15 }}>pH trend — last 24 hours</h3>
              {loadingReadings ? (
                <div style={{ color: "var(--color-text-muted)" }}>Loading...</div>
              ) : phChartPoints.length > 0 ? (
                <SimpleLineChart points={phChartPoints} />
              ) : (
                <div style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>No readings yet.</div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: 15 }}>Reading history</h3>
            {loadingReadings ? (
              <div style={{ color: "var(--color-text-muted)" }}>Loading...</div>
            ) : readings.length === 0 ? (
              <div style={{ color: "var(--color-text-muted)" }}>No readings recorded for this batch yet.</div>
            ) : (
              <div className="temp-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Temperature</th>
                      <th>pH</th>
                      <th>Humidity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...readings].reverse().map((r) => (
                      <tr key={r.id}>
                        <td data-label="Time">{new Date(r.recorded_at).toLocaleString()}</td>
                        <td data-label="Temperature">
                          {r.temperature != null ? `${Number(r.temperature).toFixed(1)}°C` : "—"}
                        </td>
                        <td data-label="pH">{r.ph != null ? Number(r.ph).toFixed(2) : "—"}</td>
                        <td data-label="Humidity">
                          {r.humidity != null ? `${Number(r.humidity).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .temp-field-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
        }

        .temp-table-wrap {
          overflow-x: auto;
        }

        @media (max-width: 640px) {
          .page-header {
            flex-direction: column;
          }
          .data-table thead {
            display: none;
          }
          .data-table,
          .data-table tbody,
          .data-table tr,
          .data-table td {
            display: block;
            width: 100%;
          }
          .data-table tr {
            margin-bottom: 12px;
            border: 1px solid var(--color-border, #e5e7eb);
            border-radius: 12px;
            padding: 4px 0;
          }
          .data-table td {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            border-bottom: 1px solid var(--color-border, #f0f1f5);
            white-space: normal;
            text-align: right;
          }
          .data-table tr td:last-child {
            border-bottom: none;
          }
          .data-table td::before {
            content: attr(data-label);
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            color: var(--color-text-muted, #8b8fa3);
            text-align: left;
            margin-right: 12px;
          }
        }
      `}</style>
    </div>
  );
}