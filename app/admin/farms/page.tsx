"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ---------- Types (match your Supabase schema) ---------- */

type Farmer = {
  id: string;
  full_name: string;
};

type Farm = {
  id: string;
  name: string;
  farmer_id: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  size_hectares: number;
  created_at: string;
  profiles?: { full_name: string } | null; // joined owner name
};

const emptyFormState = {
  id: "",
  name: "",
  farmer_id: "",
  location: "",
  latitude: "",
  longitude: "",
  size_hectares: "",
};

type FormState = typeof emptyFormState;

/* ---------- Component ---------- */

export default function Page() {
  const supabase = useMemo(() => createClient(), []);

  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState<"closed" | "add" | "edit">("closed");
  const [form, setForm] = useState<FormState>(emptyFormState);
  const [deleteTarget, setDeleteTarget] = useState<Farm | null>(null);

  /* ---- Load farms (joined with owner name) + farmers list ---- */

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);

    const [farmsRes, farmersRes] = await Promise.all([
      supabase
        .from("farms")
        .select("*, profiles:farmer_id(full_name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "farmer")
        .order("full_name", { ascending: true }),
    ]);

    if (farmsRes.error) {
      setErrorMsg(farmsRes.error.message);
    } else {
      setFarms(farmsRes.data as Farm[]);
    }

    if (farmersRes.error) {
      setErrorMsg((prev) => prev ?? farmersRes.error.message);
    } else {
      setFarmers(farmersRes.data as Farmer[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredFarms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return farms;
    return farms.filter((f) => {
      const owner = f.profiles?.full_name ?? "";
      return (
        f.name.toLowerCase().includes(q) ||
        owner.toLowerCase().includes(q) ||
        f.location.toLowerCase().includes(q)
      );
    });
  }, [farms, search]);

  /* ---- Modal helpers ---- */

  function openAddModal() {
    setForm(emptyFormState);
    setModalMode("add");
  }

  function openEditModal(farm: Farm) {
    setForm({
      id: farm.id,
      name: farm.name,
      farmer_id: farm.farmer_id,
      location: farm.location,
      latitude: farm.latitude !== null ? String(farm.latitude) : "",
      longitude: farm.longitude !== null ? String(farm.longitude) : "",
      size_hectares: String(farm.size_hectares),
    });
    setModalMode("edit");
  }

  function closeModal() {
    if (saving) return;
    setModalMode("closed");
    setForm(emptyFormState);
  }

  /* ---- Create / update ---- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim() || !form.farmer_id || !form.location.trim() || !form.size_hectares) {
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      name: form.name.trim(),
      farmer_id: form.farmer_id,
      location: form.location.trim(),
      latitude: form.latitude.trim() ? Number(form.latitude) : null,
      longitude: form.longitude.trim() ? Number(form.longitude) : null,
      size_hectares: Number(form.size_hectares),
    };

    if (modalMode === "add") {
      const { error } = await supabase.from("farms").insert(payload);
      if (error) {
        setErrorMsg(error.message);
        setSaving(false);
        return;
      }
    } else if (modalMode === "edit") {
      const { error } = await supabase.from("farms").update(payload).eq("id", form.id);
      if (error) {
        setErrorMsg(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    closeModal();
    await loadData();
  }

  /* ---- Delete ---- */

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase.from("farms").delete().eq("id", deleteTarget.id);

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
          <h1>Farms</h1>
          <div className="page-subtitle">Register and manage farms, assign them to farmers.</div>
        </div>
        <button className="ff-btn-primary" onClick={openAddModal}>
          + Add farm
        </button>
      </div>

      <div className="card">
        <div className="ff-toolbar">
          <input
            className="ff-search"
            placeholder="Search by farm name, farmer, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {errorMsg && <div className="ff-error">{errorMsg}</div>}

        {loading ? (
          <div className="ff-empty">Loading farms...</div>
        ) : filteredFarms.length === 0 ? (
          <div className="ff-empty">
            {farms.length === 0
              ? 'No farms registered yet. Click "Add farm" to register the first one.'
              : "No farms match your search."}
          </div>
        ) : (
          <div className="ff-table-wrap">
            <table className="ff-table">
              <thead>
                <tr>
                  <th>Farm name</th>
                  <th>Owner (farmer)</th>
                  <th>Location</th>
                  <th>Size (ha)</th>
                  <th>Date registered</th>
                  <th className="ff-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFarms.map((farm) => (
                  <tr key={farm.id}>
                    <td data-label="Farm name" className="ff-farm-name">{farm.name}</td>
                    <td data-label="Owner">{farm.profiles?.full_name ?? "Unassigned"}</td>
                    <td data-label="Location">{farm.location}</td>
                    <td data-label="Size (ha)">{farm.size_hectares}</td>
                    <td data-label="Date registered">{formatDate(farm.created_at)}</td>
                    <td data-label="Actions">
                      <div className="ff-row-actions">
                        <button className="ff-btn-ghost" onClick={() => openEditModal(farm)}>
                          Edit
                        </button>
                        <button
                          className="ff-btn-ghost ff-btn-danger"
                          onClick={() => setDeleteTarget(farm)}
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

      {modalMode !== "closed" && (
        <div className="ff-modal-overlay" onClick={closeModal}>
          <div className="ff-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modalMode === "add" ? "Add farm" : "Edit farm"}</h2>

            <form onSubmit={handleSubmit}>
              <label className="ff-field">
                <span>Farm name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Ramos Cacao Farm"
                  required
                />
              </label>

              <label className="ff-field">
                <span>Select farmer</span>
                <select
                  value={form.farmer_id}
                  onChange={(e) => setForm({ ...form, farmer_id: e.target.value })}
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

              <label className="ff-field">
                <span>Location / address</span>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Barangay, City/Municipality"
                  required
                />
              </label>

              <div className="ff-field-row">
                <label className="ff-field">
                  <span>Latitude (optional)</span>
                  <input
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    placeholder="7.1907"
                  />
                </label>
                <label className="ff-field">
                  <span>Longitude (optional)</span>
                  <input
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    placeholder="125.4553"
                  />
                </label>
              </div>

              <label className="ff-field">
                <span>Size (hectares)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.size_hectares}
                  onChange={(e) => setForm({ ...form, size_hectares: e.target.value })}
                  placeholder="e.g. 2.5"
                  required
                />
              </label>

              <div className="ff-modal-actions">
                <button type="button" className="ff-btn-ghost" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="ff-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : modalMode === "add" ? "Add farm" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="ff-modal-overlay" onClick={() => !saving && setDeleteTarget(null)}>
          <div className="ff-modal ff-modal-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Delete farm?</h2>
            <p className="ff-modal-text">
              This will permanently remove <strong>{deleteTarget.name}</strong>. This action
              cannot be undone.
            </p>
            <div className="ff-modal-actions">
              <button className="ff-btn-ghost" onClick={() => setDeleteTarget(null)} disabled={saving}>
                Cancel
              </button>
              <button
                className="ff-btn-primary ff-btn-danger-solid"
                onClick={confirmDelete}
                disabled={saving}
              >
                {saving ? "Deleting..." : "Delete farm"}
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

        .ff-toolbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 16px;
        }

        .ff-search {
          width: 320px;
          max-width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--color-border, #e5e7eb);
          font-size: 14px;
          outline: none;
        }
        .ff-search:focus {
          border-color: #6c4ff6;
          box-shadow: 0 0 0 3px rgba(108, 79, 246, 0.15);
        }

        .ff-error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fbd5d5;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .ff-empty {
          padding: 48px 16px;
          text-align: center;
          color: var(--color-text-muted, #8b8fa3);
          font-size: 14px;
        }

        .ff-table-wrap {
          overflow-x: auto;
        }

        .ff-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .ff-table th {
          text-align: left;
          padding: 12px 16px;
          color: var(--color-text-muted, #8b8fa3);
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        .ff-table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--color-border, #f0f1f5);
        }

        .ff-farm-name {
          font-weight: 600;
        }

        .ff-actions-col {
          text-align: right;
        }

        .ff-row-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .ff-btn-primary {
          background: #6c4ff6;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        .ff-btn-primary:hover {
          background: #5b3fe0;
        }
        .ff-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ff-btn-ghost {
          background: transparent;
          border: 1px solid var(--color-border, #e5e7eb);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #374151;
        }
        .ff-btn-ghost:hover {
          background: #f8f9fc;
        }
        .ff-btn-ghost:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ff-btn-danger {
          color: #d92d20;
          border-color: #fbd5d5;
        }
        .ff-btn-danger:hover {
          background: #fef2f2;
        }

        .ff-btn-danger-solid {
          background: #d92d20;
        }
        .ff-btn-danger-solid:hover {
          background: #b91c1c;
        }

        .ff-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(17, 17, 17, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 16px;
        }

        .ff-modal {
          background: white;
          border-radius: 18px;
          padding: 28px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .ff-modal-sm {
          max-width: 400px;
        }

        .ff-modal h2 {
          margin: 0 0 20px 0;
          font-size: 20px;
        }

        .ff-modal-text {
          color: var(--color-text-muted, #6b7280);
          font-size: 14px;
          line-height: 1.5;
        }

        .ff-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .ff-field-row {
          display: flex;
          gap: 12px;
        }
        .ff-field-row .ff-field {
          flex: 1;
        }

        .ff-field input,
        .ff-field select {
          font-weight: 400;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--color-border, #e5e7eb);
          font-size: 14px;
          outline: none;
        }
        .ff-field input:focus,
        .ff-field select:focus {
          border-color: #6c4ff6;
          box-shadow: 0 0 0 3px rgba(108, 79, 246, 0.15);
        }

        .ff-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 8px;
        }

        @media (max-width: 640px) {
          .page-header {
            flex-direction: column;
          }
          .ff-table thead {
            display: none;
          }
          .ff-table,
          .ff-table tbody,
          .ff-table tr,
          .ff-table td {
            display: block;
            width: 100%;
          }
          .ff-table tr {
            margin-bottom: 12px;
            border: 1px solid var(--color-border, #e5e7eb);
            border-radius: 12px;
            padding: 4px 0;
          }
          .ff-table td {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            border-bottom: 1px solid var(--color-border, #f0f1f5);
            white-space: normal;
            text-align: right;
          }
          .ff-table tr td:last-child {
            border-bottom: none;
          }
          .ff-table td::before {
            content: attr(data-label);
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            color: var(--color-text-muted, #8b8fa3);
            text-align: left;
            margin-right: 12px;
          }
          .ff-row-actions {
            justify-content: flex-end;
          }
          .ff-search {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------- Helpers ---------- */

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}