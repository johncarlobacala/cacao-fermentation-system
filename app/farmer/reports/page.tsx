"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Batch {
  batch_code: string;
  variety: string;
  method: string;
  size_kg: string;
  status: string;
  start_date: string;
  completed_at: string | null;
}

export default function MyReportsPage() {
  const supabase = createClient();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data } = await supabase
        .from("fermentation_batches")
        .select("batch_code, variety, method, size_kg, status, start_date, completed_at")
        .eq("farmer_id", user!.id)
        .order("start_date", { ascending: false });

      setBatches(data ?? []);
      setLoading(false);
    })();
  }, []);

  function exportCSV() {
    if (!batches.length) return;
    const headers = ["Batch code", "Variety", "Method", "Size (kg)", "Status", "Start date", "Completed at"];
    const rows = batches.map((b) =>
      [b.batch_code, b.variety, b.method, b.size_kg, b.status, b.start_date, b.completed_at ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-batches-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    if (!batches.length) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tableRows = batches
      .map(
        (b) => `<tr>
          <td>${b.batch_code}</td><td>${b.variety}</td><td>${b.method}</td>
          <td>${b.size_kg}kg</td><td>${b.status}</td>
          <td>${new Date(b.start_date).toLocaleDateString()}</td>
          <td>${b.completed_at ? new Date(b.completed_at).toLocaleDateString() : "—"}</td>
        </tr>`
      )
      .join("");

    printWindow.document.write(`
      <html><head><title>My Batches Report</title>
      <style>
        body { font-family: sans-serif; padding: 30px; }
        h1 { color: #6c4ff6; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f8f9fc; }
      </style></head>
      <body>
        <h1>My Fermentation Batches</h1>
        <p>Generated ${new Date().toLocaleString()}</p>
        <table><thead><tr>
          <th>Batch</th><th>Variety</th><th>Method</th><th>Size</th><th>Status</th><th>Start</th><th>Completed</th>
        </tr></thead><tbody>${tableRows}</tbody></table>
        <script>window.print();</script>
      </body></html>
    `);
    printWindow.document.close();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My reports</h1>
          <div className="page-subtitle">Your fermentation batch history</div>
        </div>
      </div>

      <div className="card">
        <div className="reports-toolbar">
          <h3 style={{ fontSize: 15 }}>{batches.length} batch(es)</h3>
          <div className="reports-export-btns">
            <button className="btn-secondary" onClick={exportCSV} disabled={!batches.length}>
              Export CSV
            </button>
            <button className="btn-secondary" onClick={exportPDF} disabled={!batches.length}>
              Export PDF
            </button>
          </div>
        </div>

        {loading && <div style={{ color: "var(--color-text-muted)" }}>Loading...</div>}
        {!loading && batches.length === 0 && (
          <div style={{ color: "var(--color-text-muted)" }}>No batches yet.</div>
        )}

        {!loading && batches.length > 0 && (
          <div className="reports-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Variety</th>
                  <th>Method</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Start</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.batch_code}>
                    <td data-label="Batch" style={{ fontWeight: 600 }}>{b.batch_code}</td>
                    <td data-label="Variety">{b.variety}</td>
                    <td data-label="Method">{b.method}</td>
                    <td data-label="Size">{b.size_kg}kg</td>
                    <td data-label="Status">
                      <span className={`badge ${b.status === "completed" ? "badge-success" : "badge-info"}`}>
                        {b.status}
                      </span>
                    </td>
                    <td data-label="Start">{new Date(b.start_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .reports-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .reports-export-btns {
          display: flex;
          gap: 8px;
        }

        .reports-table-wrap {
          overflow-x: auto;
        }

        @media (max-width: 640px) {
          .page-header {
            flex-direction: column;
          }

          .reports-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .reports-export-btns {
            width: 100%;
          }

          .reports-export-btns button {
            flex: 1;
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