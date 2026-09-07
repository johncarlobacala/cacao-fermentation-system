"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Farm {
  id: string;
  name: string;
  location: string | null;
  size_hectares: number | null;
}

interface Batch {
  id: string;
  batch_code: string;
  variety: string;
  method: string;
  size_kg: string;
  start_date: string;
  completed_at: string | null;
  status: string;
}

interface AlertRow {
  id: string;
  alert_type: string;
  temperature_value: number | null;
  status: string;
  created_at: string;
}

export default function MyFarmPage() {
  const supabase = createClient();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: farmData }, { data: batchData }, { data: alertData }] = await Promise.all([
      supabase.from("farms").select("id, name, location, size_hectares").eq("farmer_id", user!.id),
      supabase
        .from("fermentation_batches")
        .select("id, batch_code, variety, method, size_kg, start_date, completed_at, status")
        .eq("farmer_id", user!.id)
        .order("start_date", { ascending: false }),
      supabase
        .from("alerts")
        .select("id, alert_type, temperature_value, status, created_at, fermentation_batches!inner(farmer_id)")
        .eq("fermentation_batches.farmer_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setFarms(farmData ?? []);
    setBatches(batchData ?? []);
    setAlerts((alertData as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleMarkComplete(batchId: string) {
    setCompletingId(batchId);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.rpc("mark_batch_complete", { p_batch_id: batchId, p_completed_by: user!.id });
    setCompletingId(null);
    load();
  }

  const activeBatches = batches.filter((b) => b.status === "ongoing");
  const completedBatches = batches.filter((b) => b.status === "completed");

  if (loading) return <div className="card">Loading your farm...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My farm</h1>
          <div className="page-subtitle">Farm details and fermentation batches</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        {farms.length === 0 && (
          <div className="card">
            <p style={{ color: "var(--color-text-muted)" }}>
              No farm registered yet. Ask your admin to register one for your account.
            </p>
          </div>
        )}
        {farms.map((f) => (
          <div className="card" key={f.id}>
            <div className="stat-card-label">Farm name</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>{f.name}</div>
            <div style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              {f.location ?? "No location set"} · {f.size_hectares ? `${f.size_hectares} ha` : "size not set"}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            className={tab === "active" ? "btn-primary" : "btn-secondary"}
            style={{ padding: "8px 16px", fontSize: 13 }}
            onClick={() => setTab("active")}
          >
            Active ({activeBatches.length})
          </button>
          <button
            className={tab === "completed" ? "btn-primary" : "btn-secondary"}
            style={{ padding: "8px 16px", fontSize: 13 }}
            onClick={() => setTab("completed")}
          >
            Completed ({completedBatches.length})
          </button>
        </div>

        {tab === "active" &&
          (activeBatches.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No active batches.</div>
          ) : (
            activeBatches.map((b) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{b.batch_code}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    {b.variety} · {b.method} · {b.size_kg}kg · started{" "}
                    {new Date(b.start_date).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="btn-secondary"
                  disabled={completingId === b.id}
                  onClick={() => handleMarkComplete(b.id)}
                >
                  {completingId === b.id ? "Marking..." : "Mark as complete"}
                </button>
              </div>
            ))
          ))}

        {tab === "completed" &&
          (completedBatches.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No completed batches yet.</div>
          ) : (
            completedBatches.map((b) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{b.batch_code}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    Completed {b.completed_at ? new Date(b.completed_at).toLocaleDateString() : "—"}
                  </div>
                </div>
                <a href="/farmer/reports" className="btn-secondary" style={{ fontSize: 12 }}>
                  View report
                </a>
              </div>
            ))
          ))}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>Alert history</h3>
        {alerts.length === 0 && <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No alerts recorded.</div>}
        {alerts.map((a) => (
          <div key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: 14 }}>
              {a.alert_type === "high_temperature" ? "High temperature" : "Low temperature"} — {a.temperature_value}°C
            </div>
            <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              {new Date(a.created_at).toLocaleString()} ·{" "}
              <span className={`badge ${a.status === "active" ? "badge-danger" : "badge-success"}`} style={{ marginLeft: 4 }}>
                {a.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* NOTE: farm name/location/size are shown read-only. The current RLS policy
   ("Admins update farms") only lets admins update the `farms` table, so a
   farmer-side edit form would fail silently on save. If you want farmers to
   edit their own farm details, add this policy in Supabase SQL editor first:

   create policy "Farmers update own farm" on public.farms
     for update using (farmer_id = auth.uid());

   Then this page can add editable inputs + a supabase.from('farms').update(...) call. */
