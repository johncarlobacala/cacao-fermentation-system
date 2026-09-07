"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ---------- Types (match your Supabase schema) ---------- */

type BatchOption = {
  id: string;
  batch_code: string;
  status: string;
};

type Turning = {
  id: string;
  batch_id: string;
  turning_number: number;
  scheduled_at: string;
  completed_at: string | null;
  status: string; // "pending" | "completed" (overdue is computed, not stored)
  reminder_sent: boolean;
  created_at: string;
  fermentation_batches?: { batch_code: string } | null; // joined batch
};

const emptyFormState = {
  batch_id: "",
  turning_number: "1",
  scheduled_at: "",
};

type FormState = typeof emptyFormState;

/* ---------- Component ---------- */

export default function Page() {
  const supabase = useMemo(() => createClient(), []);

  const [turnings, setTurnings] = useState<Turning[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "pending" | "overdue" | "completed">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyFormState);
  const [doneTarget, setDoneTarget] = useState<Turning | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Turning | null>(null);

  /* ---- Load turnings (joined with batch code) + ongoing batches for the dropdown ---- */

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);

    const [turningsRes, batchesRes] = await Promise.all([
      supabase
        .from("turning_schedules")
        .select("*, fermentation_batches:batch_id(batch_code)")
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("fermentation_batches")
        .select("id, batch_code, status")
        .eq("status", "ongoing")
        .order("batch_code", { ascending: true }),
    ]);

    if (turningsRes.error) setErrorMsg(turningsRes.error.message);
    else setTurnings(turningsRes.data as Turning[]);

    if (batchesRes.error) setErrorMsg((prev) => prev ?? batchesRes.error.message);
    else setBatches(batchesRes.data as BatchOption[]);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTurnings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return turnings.filter((t) => {
      const displayStatus = computeStatus(t);
      if (statusTab !== "all" && displayStatus !== statusTab) return false;
      if (!q) return true;
      const code = t.fermentation_batches?.batch_code ?? "";
      return code.toLowerCase().includes(q);
    });
  }, [turnings, search, statusTab]);

  /* ---- Modal helpers ---- */

  function openAddModal() {
    setForm(emptyFormState);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setForm(emptyFormState);
  }

  /* ---- Create turning entry ---- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.batch_id || !form.scheduled_at) return;

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      batch_id: form.batch_id,
      turning_number: Number(form.turning_number),
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      status: "pending",
      reminder_sent: false,
    };

    const { error } = await supabase.from("turning_schedules").insert(payload);

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    closeModal();
    await loadData();
  }

  /* ---- Mark turning done ---- */

  async function confirmDone() {
    if (!doneTarget) return;
    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from("turning_schedules")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", doneTarget.id);

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setDoneTarget(null);
    await loadData();
  }

  /* ---- Delete ---- */

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase.from("turning_schedules").delete().eq("id", deleteTarget.id);

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setDeleteTarget(null);
    await loadData();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Turning schedule</h1>
          <div className="page-subtitle">List of turnings across all batches.</div>
        </div>
        <button className="ts-btn-primary" onClick={openAddModal}>
          + Add turning
        </button>
      </div>

      <div className="card">
        <div className="ts-toolbar">
          <div className="ts-tabs">
            {(["all", "pending", "overdue", "completed"] as const).map((tab) => (
              <button
                key={tab}
                className={`ts-tab ${statusTab === tab ? "ts-tab-active" : ""}`}
                onClick={() => setStatusTab(tab)}
              >
                {tab === "all" ? "All" : tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <input
            className="ts-search"
            placeholder="Search by batch code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {errorMsg && <div className="ts-error">{errorMsg}</div>}

        {loading ? (
          <div className="ts-empty">Loading turning schedule...</div>
        ) : filteredTurnings.length === 0 ? (
          <div className="ts-empty">
            {turnings.length === 0
              ? 'No turnings scheduled yet. Click "Add turning" to schedule one.'
              : "No turnings match your filters."}
          </div>
        ) : (
          <div className="ts-table-wrap">
            <table className="ts-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Turning</th>
                  <th>Scheduled time</th>
                  <th>Status</th>
                  <th className="ts-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTurnings.map((t) => {
                  const displayStatus = computeStatus(t);
                  return (
                    <tr key={t.id}>
                      <td data-label="Batch" className="ts-batch-code">
                        {t.fermentation_batches?.batch_code ?? "—"}
                      </td>
                      <td data-label="Turning">{turningLabel(t.turning_number)}</td>
                      <td data-label="Scheduled time">{formatDateTime(t.scheduled_at)}</td>
                      <td data-label="Status">
                        <span className={`ts-badge ${badgeClass(displayStatus)}`}>
                          {displayStatus[0].toUpperCase() + displayStatus.slice(1)}
                        </span>
                      </td>
                      <td data-label="Actions">
                        <div className="ts-row-actions">
                          {displayStatus !== "completed" && (
                            <button className="ts-btn-ghost" onClick={() => setDoneTarget(t)}>
                              Mark turning done
                            </button>
                          )}
                          <button
                            className="ts-btn-ghost ts-btn-danger"
                            onClick={() => setDeleteTarget(t)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="ts-modal-overlay" onClick={closeModal}>
          <div className="ts-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add turning</h2>

            <form onSubmit={handleSubmit}>
              <label className="ts-field">
                <span>Batch</span>
                <select
                  value={form.batch_id}
                  onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
                  required
                >
                  <option value="" disabled>
                    Choose an ongoing batch
                  </option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_code}
                    </option>
                  ))}
                </select>
                {batches.length === 0 && (
                  <span className="ts-field-hint">No ongoing batches available.</span>
                )}
              </label>

              <label className="ts-field">
                <span>Turning number</span>
                <select
                  value={form.turning_number}
                  onChange={(e) => setForm({ ...form, turning_number: e.target.value })}
                >
                  <option value="1">1st turning</option>
                  <option value="2">2nd turning</option>
                  <option value="3">Optional turning</option>
                </select>
              </label>

              <label className="ts-field">
                <span>Scheduled time</span>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  required
                />
              </label>

              <div className="ts-modal-actions">
                <button type="button" className="ts-btn-ghost" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="ts-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Add turning"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {doneTarget && (
        <div className="ts-modal-overlay" onClick={() => !saving && setDoneTarget(null)}>
          <div className="ts-modal ts-modal-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Mark turning done?</h2>
            <p className="ts-modal-text">
              {turningLabel(doneTarget.turning_number)} for{" "}
              <strong>{doneTarget.fermentation_batches?.batch_code}</strong> will be logged as
              completed.
            </p>
            <div className="ts-modal-actions">
              <button className="ts-btn-ghost" onClick={() => setDoneTarget(null)} disabled={saving}>
                Cancel
              </button>
              <button className="ts-btn-primary" onClick={confirmDone} disabled={saving}>
                {saving ? "Saving..." : "Mark done"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="ts-modal-overlay" onClick={() => !saving && setDeleteTarget(null)}>
          <div className="ts-modal ts-modal-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Delete turning entry?</h2>
            <p className="ts-modal-text">
              This will permanently remove this scheduled turning. This action cannot be undone.
            </p>
            <div className="ts-modal-actions">
              <button
                className="ts-btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="ts-btn-primary ts-btn-danger-solid"
                onClick={confirmDelete}
                disabled={saving}
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .ts-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .ts-tabs {
          display: flex;
          gap: 6px;
          background: #f8f9fc;
          padding: 4px;
          border-radius: 10px;
        }

        .ts-tab {
          border: none;
          background: transparent;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
        }

        .ts-tab-active {
          background: white;
          color: #111827;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
        }

        .ts-search {
          width: 260px;
          max-width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--color-border, #e5e7eb);
          font-size: 14px;
          outline: none;
        }
        .ts-search:focus {
          border-color: #6c4ff6;
          box-shadow: 0 0 0 3px rgba(108, 79, 246, 0.15);
        }

        .ts-error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fbd5d5;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .ts-empty {
          padding: 48px 16px;
          text-align: center;
          color: var(--color-text-muted, #8b8fa3);
          font-size: 14px;
        }

        .ts-table-wrap {
          overflow-x: auto;
        }

        .ts-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .ts-table th {
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

        .ts-table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--color-border, #f0f1f5);
          white-space: nowrap;
        }

        .ts-batch-code {
          font-weight: 600;
        }

        .ts-actions-col {
          text-align: right;
        }

        .ts-row-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .ts-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        .ts-badge-green {
          background: #eafaf0;
          color: #15803d;
        }
        .ts-badge-amber {
          background: #fff8e6;
          color: #b45309;
        }
        .ts-badge-red {
          background: #fef2f2;
          color: #d92d20;
        }

        .ts-btn-primary {
          background: #6c4ff6;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        .ts-btn-primary:hover {
          background: #5b3fe0;
        }
        .ts-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ts-btn-ghost {
          background: transparent;
          border: 1px solid var(--color-border, #e5e7eb);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #374151;
        }
        .ts-btn-ghost:hover {
          background: #f8f9fc;
        }
        .ts-btn-ghost:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ts-btn-danger {
          color: #d92d20;
          border-color: #fbd5d5;
        }
        .ts-btn-danger:hover {
          background: #fef2f2;
        }

        .ts-btn-danger-solid {
          background: #d92d20;
        }
        .ts-btn-danger-solid:hover {
          background: #b91c1c;
        }

        .ts-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(17, 17, 17, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 16px;
        }

        .ts-modal {
          background: white;
          border-radius: 18px;
          padding: 28px;
          width: 100%;
          max-width: 460px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .ts-modal-sm {
          max-width: 400px;
        }

        .ts-modal h2 {
          margin: 0 0 20px 0;
          font-size: 20px;
        }

        .ts-modal-text {
          color: var(--color-text-muted, #6b7280);
          font-size: 14px;
          line-height: 1.5;
        }

        .ts-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .ts-field input,
        .ts-field select {
          font-weight: 400;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--color-border, #e5e7eb);
          font-size: 14px;
          outline: none;
          font-family: inherit;
        }
        .ts-field input:focus,
        .ts-field select:focus {
          border-color: #6c4ff6;
          box-shadow: 0 0 0 3px rgba(108, 79, 246, 0.15);
        }

        .ts-field-hint {
          font-weight: 400;
          font-size: 12px;
          color: #b45309;
        }

        .ts-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 8px;
        }

        @media (max-width: 640px) {
          .page-header {
            flex-direction: column;
          }
          .ts-toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          .ts-table thead {
            display: none;
          }
          .ts-table,
          .ts-table tbody,
          .ts-table tr,
          .ts-table td {
            display: block;
            width: 100%;
          }
          .ts-table tr {
            margin-bottom: 12px;
            border: 1px solid var(--color-border, #e5e7eb);
            border-radius: 12px;
            padding: 4px 0;
          }
          .ts-table td {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            border-bottom: 1px solid var(--color-border, #f0f1f5);
            white-space: normal;
            text-align: right;
          }
          .ts-table tr td:last-child {
            border-bottom: none;
          }
          .ts-table td::before {
            content: attr(data-label);
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            color: var(--color-text-muted, #8b8fa3);
            text-align: left;
            margin-right: 12px;
          }
          .ts-row-actions {
            justify-content: flex-end;
          }
          .ts-search {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------- Helpers ---------- */

function computeStatus(t: Turning): "pending" | "overdue" | "completed" {
  if (t.status === "completed") return "completed";
  const scheduled = new Date(t.scheduled_at).getTime();
  return scheduled < Date.now() ? "overdue" : "pending";
}

function badgeClass(status: string) {
  if (status === "completed") return "ts-badge-green";
  if (status === "overdue") return "ts-badge-red";
  return "ts-badge-amber";
}

function turningLabel(n: number) {
  if (n === 1) return "1st turning";
  if (n === 2) return "2nd turning";
  return "Optional turning";
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}