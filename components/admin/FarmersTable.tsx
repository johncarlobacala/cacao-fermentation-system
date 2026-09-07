"use client";

import { useEffect, useMemo, useState } from "react";

interface Farmer {
  id: string;
  full_name: string;
  contact_number: string | null;
  status: "active" | "inactive";
  created_at: string;
  email: string;
  farms: string[];
}

export function FarmersTable() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [editTarget, setEditTarget] = useState<Farmer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farmer | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadFarmers() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/farmers");
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Failed to load farmers.");
      return;
    }
    setFarmers(body.farmers);
  }

  useEffect(() => {
    loadFarmers();
  }, []);

  const filtered = useMemo(() => {
    return farmers.filter((f) => {
      const matchesSearch =
        !search ||
        f.full_name.toLowerCase().includes(search.toLowerCase()) ||
        f.email.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || f.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [farmers, search, statusFilter]);

  async function toggleStatus(farmer: Farmer) {
    setSavingId(farmer.id);
    const newStatus = farmer.status === "active" ? "inactive" : "active";
    const res = await fetch(`/api/admin/farmers/${farmer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSavingId(null);
    if (res.ok) {
      setFarmers((prev) => prev.map((f) => (f.id === farmer.id ? { ...f, status: newStatus } : f)));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSavingId(deleteTarget.id);
    const res = await fetch(`/api/admin/farmers/${deleteTarget.id}`, { method: "DELETE" });
    setSavingId(null);
    if (res.ok) {
      setFarmers((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
  }

  async function handleSaveEdit(updated: { full_name: string; contact_number: string }) {
    if (!editTarget) return;
    setSavingId(editTarget.id);
    const res = await fetch(`/api/admin/farmers/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    setSavingId(null);
    if (res.ok) {
      setFarmers((prev) => prev.map((f) => (f.id === editTarget.id ? { ...f, ...updated } : f)));
      setEditTarget(null);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          className="text-input"
          placeholder="Search by name or email..."
          style={{ maxWidth: 280 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="text-input"
          style={{ maxWidth: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="btn-secondary" onClick={loadFarmers} style={{ marginLeft: "auto" }}>
          Refresh
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div style={{ color: "var(--color-text-muted)", padding: "20px 0" }}>Loading farmers...</div>}

      {!loading && !error && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Contact number</th>
                <th>Farm assigned</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "24px 0" }}>
                    No farmers found.
                  </td>
                </tr>
              )}
              {filtered.map((f) => (
                <tr key={f.id}>
                  <td data-label="Name" style={{ fontWeight: 600 }}>{f.full_name}</td>
                  <td data-label="Email">{f.email}</td>
                  <td data-label="Contact number">{f.contact_number || "—"}</td>
                  <td data-label="Farm assigned">{f.farms.length ? f.farms.join(", ") : "—"}</td>
                  <td data-label="Status">
                    <span className={`badge ${f.status === "active" ? "badge-success" : "badge-danger"}`}>
                      {f.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="row-actions">
                      <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setEditTarget(f)}>
                        Edit
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: "6px 12px", fontSize: 12 }}
                        disabled={savingId === f.id}
                        onClick={() => toggleStatus(f)}
                      >
                        {f.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: "6px 12px", fontSize: 12, color: "var(--color-danger-text)" }}
                        onClick={() => setDeleteTarget(f)}
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

      {editTarget && (
        <EditFarmerModal
          farmer={editTarget}
          saving={savingId === editTarget.id}
          onCancel={() => setEditTarget(null)}
          onSave={handleSaveEdit}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          farmerName={deleteTarget.full_name}
          saving={savingId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      <style jsx>{`
        @media (max-width: 640px) {
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
          .row-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28, 27, 46, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 20,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 420 }}>
        {children}
      </div>
    </div>
  );
}

function EditFarmerModal({
  farmer,
  saving,
  onCancel,
  onSave,
}: {
  farmer: Farmer;
  saving: boolean;
  onCancel: () => void;
  onSave: (updated: { full_name: string; contact_number: string }) => void;
}) {
  const [fullName, setFullName] = useState(farmer.full_name);
  const [contactNumber, setContactNumber] = useState(farmer.contact_number ?? "");

  return (
    <ModalShell>
      <h3 style={{ marginBottom: 18, fontSize: 17 }}>Edit farmer</h3>

      <div className="field-group">
        <label className="field-label">Full name</label>
        <input className="text-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className="field-group">
        <label className="field-label">Contact number</label>
        <input className="text-input" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
      </div>

      <div className="field-group">
        <label className="field-label">Email</label>
        <input className="text-input" value={farmer.email} disabled />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-primary"
          style={{ flex: 1 }}
          disabled={saving}
          onClick={() => onSave({ full_name: fullName, contact_number: contactNumber })}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </ModalShell>
  );
}

function ConfirmDeleteModal({
  farmerName,
  saving,
  onCancel,
  onConfirm,
}: {
  farmerName: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell>
      <h3 style={{ marginBottom: 10, fontSize: 17 }}>Delete {farmerName}?</h3>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14, marginBottom: 20 }}>
        This permanently deletes their login and, because of how the database is linked, also deletes their
        farms, batches, and all related records. This can't be undone.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-primary"
          style={{ flex: 1, background: "var(--color-danger-text)" }}
          disabled={saving}
          onClick={onConfirm}
        >
          {saving ? "Deleting..." : "Delete permanently"}
        </button>
      </div>
    </ModalShell>
  );
}