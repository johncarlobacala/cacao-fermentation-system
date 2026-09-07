"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Farmer {
  id: string;
  full_name: string;
}

interface BatchRow {
  id: string;
  batch_code: string;
  farmer_name: string;
  farm_name: string;
  variety: string;
  method: string;
  size_kg: string;
  status: string;
  start_date: string;
  completed_at: string | null;
}

export function ReportsBuilder() {
  const supabase = createClient();

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [rows, setRows] = useState<BatchRow[]>([]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [farmerId, setFarmerId] = useState("");

  const [reportType, setReportType] = useState<
    "batch" | "farmer_summary" | "overall_summary"
  >("overall_summary");

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedBatch, setSelectedBatch] = useState<BatchRow | null>(null);

  // =========================================================
  // LOAD FARMERS
  // =========================================================
  useEffect(() => {
    async function loadFarmers() {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "farmer")
        .order("full_name", { ascending: true });

      setFarmers(data ?? []);
    }

    loadFarmers();
  }, [supabase]);

  // =========================================================
  // LOAD ALL BATCHES AUTOMATICALLY
  // =========================================================
  useEffect(() => {
    loadBatches();
  }, []);

  async function loadBatches() {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("fermentation_batches")
      .select(`
        id,
        batch_code,
        variety,
        method,
        size_kg,
        status,
        start_date,
        completed_at,
        farmer_id,
        profiles!fermentation_batches_farmer_id_fkey(full_name),
        farms(name)
      `)
      .order("start_date", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const mapped: BatchRow[] = (data ?? []).map((b: any) => ({
      id: b.id,
      batch_code: b.batch_code,
      farmer_name: b.profiles?.full_name ?? "—",
      farm_name: b.farms?.name ?? "—",
      variety: b.variety ?? "—",
      method: b.method ?? "—",
      size_kg: b.size_kg ?? "—",
      status: b.status ?? "—",
      start_date: b.start_date,
      completed_at: b.completed_at,
    }));

    setRows(mapped);
    setLoading(false);
  }

  // =========================================================
  // SEARCH / FILTER
  // =========================================================
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    setSearching(true);
    setError(null);

    let query = supabase
      .from("fermentation_batches")
      .select(`
        id,
        batch_code,
        variety,
        method,
        size_kg,
        status,
        start_date,
        completed_at,
        farmer_id,
        profiles!fermentation_batches_farmer_id_fkey(full_name),
        farms(name)
      `);

    if (dateFrom) {
      query = query.gte("start_date", dateFrom);
    }

    if (dateTo) {
      query = query.lte("start_date", dateTo);
    }

    if (reportType === "farmer_summary" && farmerId) {
      query = query.eq("farmer_id", farmerId);
    }

    const { data, error: queryError } = await query.order("start_date", {
      ascending: false,
    });

    if (queryError) {
      setError(queryError.message);
      setSearching(false);
      return;
    }

    const mapped: BatchRow[] = (data ?? []).map((b: any) => ({
      id: b.id,
      batch_code: b.batch_code,
      farmer_name: b.profiles?.full_name ?? "—",
      farm_name: b.farms?.name ?? "—",
      variety: b.variety ?? "—",
      method: b.method ?? "—",
      size_kg: b.size_kg ?? "—",
      status: b.status ?? "—",
      start_date: b.start_date,
      completed_at: b.completed_at,
    }));

    setRows(mapped);
    setSearching(false);
  }

  // =========================================================
  // CLEAR FILTERS
  // =========================================================
  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setFarmerId("");
    setReportType("overall_summary");

    loadBatches();
  }

  // =========================================================
  // EXPORT EXCEL
  // =========================================================
  function exportExcel() {
    if (!rows.length) return;

    const headers = [
      "Batch",
      "Farmer",
      "Farm",
      "Variety",
      "Method",
      "Size (kg)",
      "Status",
      "Start Date",
      "Completed At",
    ];

    const dataRows = rows.map((r) => [
      r.batch_code,
      r.farmer_name,
      r.farm_name,
      r.variety,
      r.method,
      r.size_kg,
      r.status,
      formatDate(r.start_date),
      r.completed_at ? formatDate(r.completed_at) : "—",
    ]);

    const table = `
      <table border="1">
        <thead>
          <tr>
            ${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${dataRows
            .map(
              (row) => `
                <tr>
                  ${row
                    .map((value) => `<td>${escapeHtml(String(value))}</td>`)
                    .join("")}
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <h2>Cacao Fermentation Report</h2>
          <p>Generated: ${new Date().toLocaleString()}</p>
          ${table}
        </body>
      </html>
    `;

    const blob = new Blob([html], {
      type: "application/vnd.ms-excel",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `cacao-fermentation-report-${new Date()
      .toISOString()
      .slice(0, 10)}.xls`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  // =========================================================
  // EXPORT PDF
  // =========================================================
  function exportPDF() {
    if (!rows.length) return;

    const printWindow = window.open("", "_blank");

    if (!printWindow) return;

    const tableRows = rows
      .map(
        (r) => `
          <tr>
            <td>${escapeHtml(r.batch_code)}</td>
            <td>${escapeHtml(r.farmer_name)}</td>
            <td>${escapeHtml(r.farm_name)}</td>
            <td>${escapeHtml(r.variety)}</td>
            <td>${escapeHtml(r.method)}</td>
            <td>${escapeHtml(String(r.size_kg))} kg</td>
            <td>${escapeHtml(r.status)}</td>
            <td>${formatDate(r.start_date)}</td>
            <td>${
              r.completed_at ? formatDate(r.completed_at) : "—"
            }</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cacao Fermentation Report</title>

          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 30px;
              color: #222;
            }

            h1 {
              color: #6d4aff;
              margin-bottom: 5px;
            }

            .subtitle {
              color: #777;
              margin-bottom: 25px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 11px;
            }

            th,
            td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }

            th {
              background: #f4f2ff;
              color: #333;
            }

            .status {
              font-weight: 600;
            }
          </style>
        </head>

        <body>
          <h1>Cacao Fermentation Report</h1>

          <div class="subtitle">
            Generated: ${new Date().toLocaleString()}
          </div>

          <table>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Farmer</th>
                <th>Farm</th>
                <th>Variety</th>
                <th>Method</th>
                <th>Size</th>
                <th>Status</th>
                <th>Start</th>
                <th>Completed</th>
              </tr>
            </thead>

            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  // =========================================================
  // VIEW INDIVIDUAL BATCH
  // =========================================================
  function viewBatch(batch: BatchRow) {
    setSelectedBatch(batch);
  }

  function closeBatchView() {
    setSelectedBatch(null);
  }

  // =========================================================
  // HELPERS
  // =========================================================
  function formatDate(date: string) {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================
  // UI
  // =========================================================
  return (
    <div>
      {/* =====================================================
          FILTER CARD
      ====================================================== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={handleSearch}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {/* REPORT TYPE */}
            <div className="field-group" style={{ marginBottom: 0 }}>
              <label className="field-label">Report type</label>

              <select
                className="text-input"
                value={reportType}
                onChange={(e) =>
                  setReportType(
                    e.target.value as
                      | "batch"
                      | "farmer_summary"
                      | "overall_summary"
                  )
                }
              >
                <option value="overall_summary">
                  Overall summary
                </option>

                <option value="farmer_summary">
                  Farmer summary
                </option>

                <option value="batch">
                  Individual batches
                </option>
              </select>
            </div>

            {/* FARMER */}
            {reportType === "farmer_summary" && (
              <div
                className="field-group"
                style={{ marginBottom: 0 }}
              >
                <label className="field-label">Farmer</label>

                <select
                  className="text-input"
                  value={farmerId}
                  onChange={(e) =>
                    setFarmerId(e.target.value)
                  }
                >
                  <option value="">
                    All farmers
                  </option>

                  {farmers.map((farmer) => (
                    <option
                      key={farmer.id}
                      value={farmer.id}
                    >
                      {farmer.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* DATE FROM */}
            <div
              className="field-group"
              style={{ marginBottom: 0 }}
            >
              <label className="field-label">
                Date from
              </label>

              <input
                type="date"
                className="text-input"
                value={dateFrom}
                onChange={(e) =>
                  setDateFrom(e.target.value)
                }
              />
            </div>

            {/* DATE TO */}
            <div
              className="field-group"
              style={{ marginBottom: 0 }}
            >
              <label className="field-label">
                Date to
              </label>

              <input
                type="date"
                className="text-input"
                value={dateTo}
                onChange={(e) =>
                  setDateTo(e.target.value)
                }
              />
            </div>
          </div>

          {/* SEARCH BUTTON */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              className="btn-primary"
              disabled={searching}
            >
              {searching ? "Searching..." : "Search"}
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={clearFilters}
              disabled={searching}
            >
              Clear filters
            </button>
          </div>
        </form>
      </div>

      {/* ERROR */}
      {error && (
        <div
          className="form-error"
          style={{ marginBottom: 16 }}
        >
          {error}
        </div>
      )}

      {/* =====================================================
          RESULTS
      ====================================================== */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: 16,
                margin: 0,
                marginBottom: 4,
              }}
            >
              Fermentation Records
            </h3>

            <div
              style={{
                fontSize: 13,
                color: "var(--color-text-muted)",
              }}
            >
              {loading
                ? "Loading records..."
                : `${rows.length} batch${
                    rows.length !== 1 ? "es" : ""
                  } found`}
            </div>
          </div>

          {/* EXPORT BUTTONS */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn-secondary"
              onClick={exportExcel}
              disabled={!rows.length || loading}
            >
              Export Excel
            </button>

            <button
              className="btn-secondary"
              onClick={exportPDF}
              disabled={!rows.length || loading}
            >
              Export PDF
            </button>
          </div>
        </div>

        {/* LOADING */}
        {loading ? (
          <div
            style={{
              padding: "35px 10px",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            Loading fermentation records...
          </div>
        ) : rows.length === 0 ? (
          /* EMPTY */
          <div
            style={{
              padding: "40px 10px",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            No fermentation records found.
          </div>
        ) : (
          /* TABLE */
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Farmer</th>
                  <th>Farm</th>
                  <th>Variety</th>
                  <th>Method</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>
                      {r.batch_code}
                    </td>

                    <td>{r.farmer_name}</td>

                    <td>{r.farm_name}</td>

                    <td>{r.variety}</td>

                    <td>{r.method}</td>

                    <td>{r.size_kg}kg</td>

                    <td>
                      <span
                        className={`badge ${
                          r.status === "completed"
                            ? "badge-success"
                            : "badge-info"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td>
                      {formatDate(r.start_date)}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => viewBatch(r)}
                        style={{
                          padding: "7px 14px",
                          fontSize: 13,
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================
          INDIVIDUAL BATCH MODAL
      ====================================================== */}
      {selectedBatch && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
          onClick={closeBatchView}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 650,
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            {/* HEADER */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 22,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                  }}
                >
                  {selectedBatch.batch_code}
                </h2>

                <div
                  style={{
                    marginTop: 5,
                    color: "var(--color-text-muted)",
                    fontSize: 13,
                  }}
                >
                  Fermentation batch details
                </div>
              </div>

              <button
                type="button"
                onClick={closeBatchView}
                className="btn-secondary"
                style={{
                  padding: "7px 12px",
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* DETAILS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 14,
              }}
            >
              <DetailItem
                label="Batch Code"
                value={selectedBatch.batch_code}
              />

              <DetailItem
                label="Farmer"
                value={selectedBatch.farmer_name}
              />

              <DetailItem
                label="Farm"
                value={selectedBatch.farm_name}
              />

              <DetailItem
                label="Cacao Variety"
                value={selectedBatch.variety}
              />

              <DetailItem
                label="Fermentation Method"
                value={selectedBatch.method}
              />

              <DetailItem
                label="Batch Size"
                value={`${selectedBatch.size_kg} kg`}
              />

              <DetailItem
                label="Start Date"
                value={formatDate(selectedBatch.start_date)}
              />

              <DetailItem
                label="Completed At"
                value={
                  selectedBatch.completed_at
                    ? formatDate(selectedBatch.completed_at)
                    : "Not completed"
                }
              />

              <div
                style={{
                  padding: 15,
                  border: "1px solid var(--color-border, #e5e7eb)",
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    marginBottom: 7,
                  }}
                >
                  Status
                </div>

                <span
                  className={`badge ${
                    selectedBatch.status === "completed"
                      ? "badge-success"
                      : "badge-info"
                  }`}
                >
                  {selectedBatch.status}
                </span>
              </div>
            </div>

            {/* FOOTER */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 22,
              }}
            >
              <button
                type="button"
                className="btn-primary"
                onClick={closeBatchView}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// DETAIL ITEM
// =========================================================

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: 15,
        border: "1px solid var(--color-border, #e5e7eb)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--color-text-muted)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}