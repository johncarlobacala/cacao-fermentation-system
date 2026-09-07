"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ---------- Config ---------- */

// No `total_days` column exists yet in fermentation_batches — using a fixed
// default for now. Swap this for a per-batch/per-settings value later if you
// add that column (e.g. from a `settings` table or a `total_days` field).
const DEFAULT_TOTAL_DAYS = 7;

const SIZE_OPTIONS = [10, 20, 50, 100, 150];
const VARIETY_OPTIONS = ["Forastero", "Trinitario", "Criollo"];
const METHOD_OPTIONS = ["Wooden Box", "Heap", "Basket"];

/* ---------- Types (match your Supabase schema) ---------- */

type Farmer = {
  id: string;
  full_name: string;
};

type Farm = {
  id: string;
  name: string;
  farmer_id: string;
};

type Batch = {
  id: string;
  batch_code: string;
  farm_id: string;
  farmer_id: string;
  size_kg: number;
  variety: string;
  method: string;
  start_date: string;
  status: string; // "ongoing" | "completed"
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  profiles?: { full_name: string } | null; // joined farmer
  farms?: { name: string } | null; // joined farm
};

const emptyFormState = {
  farmer_id: "",
  farm_id: "",
  size_kg: String(SIZE_OPTIONS[0]),
  variety: VARIETY_OPTIONS[0],
  method: METHOD_OPTIONS[0],
  start_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

type FormState = typeof emptyFormState;

/* ---------- Component ---------- */

export default function Page() {
  const supabase = useMemo(() => createClient(), []);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "ongoing" | "completed">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyFormState);
  const [completeTarget, setCompleteTarget] = useState<Batch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);

  // --- Edit modal state ---
  const [editTarget, setEditTarget] = useState<Batch | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyFormState);

  /* ---- Load batches (joined) + farmers + farms ---- */

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);

    const [batchesRes, farmersRes, farmsRes] = await Promise.all([
      supabase
        .from("fermentation_batches")
        .select("*, profiles:farmer_id(full_name), farms:farm_id(name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "farmer")
        .order("full_name", { ascending: true }),
      supabase.from("farms").select("id, name, farmer_id"),
    ]);

    if (batchesRes.error) setErrorMsg(batchesRes.error.message);
    else setBatches(batchesRes.data as Batch[]);

    if (farmersRes.error) setErrorMsg((prev) => prev ?? farmersRes.error.message);
    else setFarmers(farmersRes.data as Farmer[]);

    if (farmsRes.error) setErrorMsg((prev) => prev ?? farmsRes.error.message);
    else setFarms(farmsRes.data as Farm[]);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const farmsForSelectedFarmer = useMemo(
    () => farms.filter((f) => f.farmer_id === form.farmer_id),
    [farms, form.farmer_id]
  );

  // Farms list scoped to whichever farmer is currently selected in the edit form
  const farmsForEditFarmer = useMemo(
    () => farms.filter((f) => f.farmer_id === editForm.farmer_id),
    [farms, editForm.farmer_id]
  );

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches.filter((b) => {
      if (statusTab !== "all" && b.status !== statusTab) return false;
      if (!q) return true;
      const farmer = b.profiles?.full_name ?? "";
      const farm = b.farms?.name ?? "";
      return (
        b.batch_code.toLowerCase().includes(q) ||
        farmer.toLowerCase().includes(q) ||
        farm.toLowerCase().includes(q)
      );
    });
  }, [batches, search, statusTab]);

  /* ---- Modal helpers (create) ---- */

  function openCreateModal() {
    setForm(emptyFormState);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setForm(emptyFormState);
  }

  function handleFarmerChange(farmerId: string) {
    setForm({ ...form, farmer_id: farmerId, farm_id: "" });
  }

  /* ---- Modal helpers (edit) ---- */

  function openEditModal(batch: Batch) {
    setEditForm({
      farmer_id: batch.farmer_id,
      farm_id: batch.farm_id,
      size_kg: String(batch.size_kg),
      variety: batch.variety,
      method: batch.method,
      start_date: batch.start_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      notes: batch.notes ?? "",
    });
    setEditTarget(batch);
  }

  function closeEditModal() {
    if (saving) return;
    setEditTarget(null);
    setEditForm(emptyFormState);
  }

  function handleEditFarmerChange(farmerId: string) {
    setEditForm({ ...editForm, farmer_id: farmerId, farm_id: "" });
  }

  /* ---- Generate next batch code ---- */

  async function generateBatchCode() {
    const { count } = await supabase
      .from("fermentation_batches")
      .select("*", { count: "exact", head: true });
    const next = (count ?? 0) + 1;
    return `BATCH-${String(next).padStart(4, "0")}`;
  }

  /* ---- Create batch ---- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.farmer_id || !form.farm_id || !form.start_date) return;

    setSaving(true);
    setErrorMsg(null);

    const batch_code = await generateBatchCode();

    const payload = {
      batch_code,
      farmer_id: form.farmer_id,
      farm_id: form.farm_id,
      size_kg: Number(form.size_kg),
      variety: form.variety,
      method: form.method,
      start_date: form.start_date,
      status: "ongoing",
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase.from("fermentation_batches").insert(payload);

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    closeModal();
    await loadData();
  }

  /* ---- Edit batch ---- */

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!editTarget) return;
    if (!editForm.farmer_id || !editForm.farm_id || !editForm.start_date) return;

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      farmer_id: editForm.farmer_id,
      farm_id: editForm.farm_id,
      size_kg: Number(editForm.size_kg),
      variety: editForm.variety,
      method: editForm.method,
      start_date: editForm.start_date,
      notes: editForm.notes.trim() || null,
    };

    const { error } = await supabase
      .from("fermentation_batches")
      .update(payload)
      .eq("id", editTarget.id);

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    closeEditModal();
    await loadData();
  }

  /* ---- Mark as complete ---- */

  async function confirmComplete() {
    if (!completeTarget) return;
    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from("fermentation_batches")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", completeTarget.id);

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setCompleteTarget(null);
    await loadData();
  }

  /* ---- Delete ---- */

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from("fermentation_batches")
      .delete()
      .eq("id", deleteTarget.id);

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
          <h1>Fermentation batches</h1>
          <div className="page-subtitle">Create batches, track day-by-day progress, mark as complete.</div>
        </div>
        <button className="fb-btn-primary" onClick={openCreateModal}>
          + Create new batch
        </button>
      </div>

      <div className="card">
        <div className="fb-toolbar">
          <div className="fb-tabs">
            <button
              className={`fb-tab ${statusTab === "all" ? "fb-tab-active" : ""}`}
              onClick={() => setStatusTab("all")}
            >
              All
            </button>
            <button
              className={`fb-tab ${statusTab === "ongoing" ? "fb-tab-active" : ""}`}
              onClick={() => setStatusTab("ongoing")}
            >
              Ongoing
            </button>
            <button
              className={`fb-tab ${statusTab === "completed" ? "fb-tab-active" : ""}`}
              onClick={() => setStatusTab("completed")}
            >
              Completed
            </button>
          </div>
          <input
            className="fb-search"
            placeholder="Search by batch code, farmer, or farm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {errorMsg && <div className="fb-error">{errorMsg}</div>}

        {loading ? (
          <div className="fb-empty">Loading batches...</div>
        ) : filteredBatches.length === 0 ? (
          <div className="fb-empty">
            {batches.length === 0
              ? 'No fermentation batches yet. Click "Create new batch" to start one.'
              : "No batches match your filters."}
          </div>
        ) : (
          <div className="fb-table-wrap">
            <table className="fb-table">
              <thead>
                <tr>
                  <th>Batch code</th>
                  <th>Farmer</th>
                  <th>Farm</th>
                  <th>Variety</th>
                  <th>Method</th>
                  <th>Size (kg)</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th className="fb-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
  {filteredBatches.map((batch) => (
    <tr key={batch.id}>
      <td data-label="Batch code" className="fb-batch-code">{batch.batch_code}</td>
      <td data-label="Farmer">{batch.profiles?.full_name ?? "—"}</td>
      <td data-label="Farm">{batch.farms?.name ?? "—"}</td>
      <td data-label="Variety">{batch.variety}</td>
      <td data-label="Method">{batch.method}</td>
      <td data-label="Size (kg)">{batch.size_kg}</td>
      <td data-label="Progress">{formatProgress(batch)}</td>
      <td data-label="Status">
        <span
          className={`fb-badge ${
            batch.status === "completed" ? "fb-badge-green" : "fb-badge-amber"
          }`}
        >
          {batch.status === "completed" ? "Completed" : "Ongoing"}
        </span>
      </td>
      <td data-label="Actions">
        <div className="fb-row-actions">
          <button className="fb-btn-ghost" onClick={() => openEditModal(batch)}>
            Edit
          </button>
          {batch.status !== "completed" && (
            <button className="fb-btn-ghost" onClick={() => setCompleteTarget(batch)}>
              Mark complete
            </button>
          )}
          <button
            className="fb-btn-ghost fb-btn-danger"
            onClick={() => setDeleteTarget(batch)}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  ))}
</tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fb-modal-overlay" onClick={closeModal}>
          <div className="fb-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create new batch</h2>

            <form onSubmit={handleSubmit}>
              <label className="fb-field">
                <span>Select farmer</span>
                <select
                  value={form.farmer_id}
                  onChange={(e) => handleFarmerChange(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Choose a farmer
                  </option>
                  {farmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fb-field">
                <span>Select farm</span>
                <select
                  value={form.farm_id}
                  onChange={(e) => setForm({ ...form, farm_id: e.target.value })}
                  required
                  disabled={!form.farmer_id}
                >
                  <option value="" disabled>
                    {form.farmer_id ? "Choose a farm" : "Select a farmer first"}
                  </option>
                  {farmsForSelectedFarmer.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {form.farmer_id && farmsForSelectedFarmer.length === 0 && (
                  <span className="fb-field-hint">This farmer has no registered farms yet.</span>
                )}
              </label>

              <div className="fb-field-row">
                <label className="fb-field">
                  <span>Batch size (kg)</span>
                  <select
                    value={form.size_kg}
                    onChange={(e) => setForm({ ...form, size_kg: e.target.value })}
                  >
                    {SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s} kg
                      </option>
                    ))}
                  </select>
                </label>

                <label className="fb-field">
                  <span>Start date</span>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="fb-field-row">
                <label className="fb-field">
                  <span>Variety</span>
                  <select
                    value={form.variety}
                    onChange={(e) => setForm({ ...form, variety: e.target.value })}
                  >
                    {VARIETY_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="fb-field">
                  <span>Method</span>
                  <select
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                  >
                    {METHOD_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="fb-field">
                <span>Notes (optional)</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional notes about this batch..."
                  rows={3}
                />
              </label>

              <div className="fb-modal-actions">
                <button type="button" className="fb-btn-ghost" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="fb-btn-primary" disabled={saving}>
                  {saving ? "Creating..." : "Create batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fb-modal-overlay" onClick={closeEditModal}>
          <div className="fb-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit batch — {editTarget.batch_code}</h2>

            <form onSubmit={handleEditSubmit}>
              <label className="fb-field">
                <span>Select farmer</span>
                <select
                  value={editForm.farmer_id}
                  onChange={(e) => handleEditFarmerChange(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Choose a farmer
                  </option>
                  {farmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fb-field">
                <span>Select farm</span>
                <select
                  value={editForm.farm_id}
                  onChange={(e) => setEditForm({ ...editForm, farm_id: e.target.value })}
                  required
                  disabled={!editForm.farmer_id}
                >
                  <option value="" disabled>
                    {editForm.farmer_id ? "Choose a farm" : "Select a farmer first"}
                  </option>
                  {farmsForEditFarmer.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {editForm.farmer_id && farmsForEditFarmer.length === 0 && (
                  <span className="fb-field-hint">This farmer has no registered farms yet.</span>
                )}
              </label>

              <div className="fb-field-row">
                <label className="fb-field">
                  <span>Batch size (kg)</span>
                  <select
                    value={editForm.size_kg}
                    onChange={(e) => setEditForm({ ...editForm, size_kg: e.target.value })}
                  >
                    {SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s} kg
                      </option>
                    ))}
                  </select>
                </label>

                <label className="fb-field">
                  <span>Start date</span>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="fb-field-row">
                <label className="fb-field">
                  <span>Variety</span>
                  <select
                    value={editForm.variety}
                    onChange={(e) => setEditForm({ ...editForm, variety: e.target.value })}
                  >
                    {VARIETY_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="fb-field">
                  <span>Method</span>
                  <select
                    value={editForm.method}
                    onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}
                  >
                    {METHOD_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="fb-field">
                <span>Notes (optional)</span>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Any additional notes about this batch..."
                  rows={3}
                />
              </label>

              <div className="fb-modal-actions">
                <button type="button" className="fb-btn-ghost" onClick={closeEditModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="fb-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {completeTarget && (
        <div className="fb-modal-overlay" onClick={() => !saving && setCompleteTarget(null)}>
          <div className="fb-modal fb-modal-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Mark batch as complete?</h2>
            <p className="fb-modal-text">
              <strong>{completeTarget.batch_code}</strong> will be marked complete and its data
              locked. This moves it to the Completed tab.
            </p>
            <div className="fb-modal-actions">
              <button
                className="fb-btn-ghost"
                onClick={() => setCompleteTarget(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button className="fb-btn-primary" onClick={confirmComplete} disabled={saving}>
                {saving ? "Saving..." : "Mark as complete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fb-modal-overlay" onClick={() => !saving && setDeleteTarget(null)}>
          <div className="fb-modal fb-modal-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Delete batch?</h2>
            <p className="fb-modal-text">
              This will permanently remove <strong>{deleteTarget.batch_code}</strong>. This
              action cannot be undone.
            </p>
            <div className="fb-modal-actions">
              <button
                className="fb-btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="fb-btn-primary fb-btn-danger-solid"
                onClick={confirmDelete}
                disabled={saving}
              >
                {saving ? "Deleting..." : "Delete batch"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
      @media (max-width: 640px) {
  .page-header {
    flex-direction: column;
  }
  .fb-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .fb-table thead {
    display: none;
  }
  .fb-table, .fb-table tbody, .fb-table tr, .fb-table td {
    display: block;
    width: 100%;
  }
  .fb-table tr {
    margin-bottom: 12px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 12px;
    padding: 4px 0;
  }
  .fb-table td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid var(--color-border, #f0f1f5);
    white-space: normal;
    text-align: right;
  }
  .fb-table tr td:last-child {
    border-bottom: none;
  }
  .fb-table td::before {
    content: attr(data-label);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--color-text-muted, #8b8fa3);
    text-align: left;
    margin-right: 12px;
  }
  .fb-row-actions {
    justify-content: flex-end;
  }
  .fb-search {
    width: 100%;
  }
}
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .fb-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .fb-tabs {
          display: flex;
          gap: 6px;
          background: #f8f9fc;
          padding: 4px;
          border-radius: 10px;
        }

        .fb-tab {
          border: none;
          background: transparent;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
        }

        .fb-tab-active {
          background: white;
          color: #111827;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
        }

        .fb-search {
          width: 280px;
          max-width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--color-border, #e5e7eb);
          font-size: 14px;
          outline: none;
        }
        .fb-search:focus {
          border-color: #6c4ff6;
          box-shadow: 0 0 0 3px rgba(108, 79, 246, 0.15);
        }

        .fb-error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fbd5d5;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .fb-empty {
          padding: 48px 16px;
          text-align: center;
          color: var(--color-text-muted, #8b8fa3);
          font-size: 14px;
        }

        .fb-table-wrap {
          overflow-x: auto;
        }

        .fb-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .fb-table th {
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

        .fb-table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--color-border, #f0f1f5);
          white-space: nowrap;
        }

        .fb-batch-code {
          font-weight: 600;
        }

        .fb-actions-col {
          text-align: right;
        }

        .fb-row-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .fb-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        .fb-badge-green {
          background: #eafaf0;
          color: #15803d;
        }
        .fb-badge-amber {
          background: #fff8e6;
          color: #b45309;
        }

        .fb-btn-primary {
          background: #6c4ff6;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        .fb-btn-primary:hover {
          background: #5b3fe0;
        }
        .fb-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .fb-btn-ghost {
          background: transparent;
          border: 1px solid var(--color-border, #e5e7eb);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #374151;
        }
        .fb-btn-ghost:hover {
          background: #f8f9fc;
        }
        .fb-btn-ghost:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .fb-btn-danger {
          color: #d92d20;
          border-color: #fbd5d5;
        }
        .fb-btn-danger:hover {
          background: #fef2f2;
        }

        .fb-btn-danger-solid {
          background: #d92d20;
        }
        .fb-btn-danger-solid:hover {
          background: #b91c1c;
        }

        .fb-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(17, 17, 17, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 16px;
        }

        .fb-modal {
          background: white;
          border-radius: 18px;
          padding: 28px;
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .fb-modal-sm {
          max-width: 420px;
        }

        .fb-modal h2 {
          margin: 0 0 20px 0;
          font-size: 20px;
        }

        .fb-modal-text {
          color: var(--color-text-muted, #6b7280);
          font-size: 14px;
          line-height: 1.5;
        }

        .fb-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .fb-field-row {
          display: flex;
          gap: 12px;
        }
        .fb-field-row .fb-field {
          flex: 1;
        }

        .fb-field input,
        .fb-field select,
        .fb-field textarea {
          font-weight: 400;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--color-border, #e5e7eb);
          font-size: 14px;
          outline: none;
          font-family: inherit;
          resize: vertical;
        }
        .fb-field input:focus,
        .fb-field select:focus,
        .fb-field textarea:focus {
          border-color: #6c4ff6;
          box-shadow: 0 0 0 3px rgba(108, 79, 246, 0.15);
        }
        .fb-field select:disabled {
          background: #f8f9fc;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .fb-field-hint {
          font-weight: 400;
          font-size: 12px;
          color: #b45309;
        }

        .fb-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}

/* ---------- Helpers ---------- */

function formatProgress(batch: Batch) {
  if (batch.status === "completed") return "Complete";

  const start = new Date(batch.start_date);
  const today = new Date();
  const dayNumber =
    Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const clampedDay = Math.max(1, Math.min(dayNumber, DEFAULT_TOTAL_DAYS));

  return `Day ${clampedDay} of ${DEFAULT_TOTAL_DAYS}`;
}