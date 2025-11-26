// src/features/data-entry/RentOpexEntry.jsx
import { useEffect, useMemo, useState } from "react";
import { loadData, saveData } from "../../utils/storage";
import {
  OUTLET_OPTIONS,
  RENT_OPEX_CATEGORIES,
  BRAND_OPTIONS,
  RENT_FREQUENCY_OPTIONS,
} from "../../config/lookups";

const FREQ_TO_MONTHS = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

function parseIsoDate(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function addMonthsSafe(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "N/A";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "N/A";
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") return value;
  return "N/A";
}

function buildSchedule(rows) {
  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  const horizonMonths = 12;
  const limitMonth = addMonthsSafe(startMonth, horizonMonths);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = Array.from({ length: horizonMonths }, (_, idx) => {
    const d = addMonthsSafe(startMonth, idx);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: d.toLocaleString("default", { month: "short", year: "numeric" }),
      total: 0,
    };
  });

  const nextDueByLease = [];

  rows.forEach((row) => {
    const amount = Number(row.amount) || 0;
    if (!amount) return;
    const step = FREQ_TO_MONTHS[String(row.frequency || "").toLowerCase()] || 1;
    const leaseStart = parseIsoDate(row.leaseStart || row.date);
    const leaseEnd = parseIsoDate(row.leaseEnd);
    if (!leaseStart) return;
    if (leaseEnd && leaseEnd < leaseStart) return;

    let due = leaseStart;

    while (due < today) {
      due = addMonthsSafe(due, step);
      if (leaseEnd && due > leaseEnd) break;
    }
    if (!leaseEnd || due <= leaseEnd) {
      nextDueByLease.push({
        id: row.id,
        brand: row.brand,
        outlet: row.outlet,
        landlord: row.landlord,
        frequency: row.frequency || "monthly",
        date: due,
        amount,
        description: row.description,
      });
    }

    while (due < startMonth) {
      due = addMonthsSafe(due, step);
      if (leaseEnd && due > leaseEnd) return;
    }

    while (due < limitMonth) {
      if (leaseEnd && due > leaseEnd) break;
      const bucketKey = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      const bucket = buckets.find((b) => b.key === bucketKey);
      if (bucket) {
        bucket.total += amount;
      }
      due = addMonthsSafe(due, step);
    }
  });

  nextDueByLease.sort((a, b) => {
    const aTime = a.date ? a.date.getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.date ? b.date.getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  return { buckets, nextDueByLease };
}

export default function RentOpexEntry({
  brandOptions = BRAND_OPTIONS,
  outletOptions = OUTLET_OPTIONS,
  categoryOptions = RENT_OPEX_CATEGORIES,
  frequencyOptions = RENT_FREQUENCY_OPTIONS,
}) {
  const [rows, setRows] = useState(() => loadData("pc_rent_opex", []) || []);
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const apiUrl = (path) =>
    API_BASE ? `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1") : path;

  useEffect(() => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        frequency: row.frequency || "monthly",
      }))
    );
  }, []);

  useEffect(() => {
    saveData("pc_rent_opex", rows);
  }, [rows]);

  const schedule = useMemo(() => buildSchedule(rows), [rows]);
  const nextMonthTotal = schedule.buckets[0]?.total || 0;

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        brand: "",
        outlet: "",
        category: "",
        landlord: "",
        frequency: "monthly",
        leaseStart: "",
        leaseEnd: "",
        isRentFixed: false,
        description: "",
        amount: "",
        notes: "",
      },
    ]);
  };

  const handleChange = (rowId, field, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  };

  const handleDelete = (rowId) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const downloadFromCloud = async () => {
    try {
      const resp = await fetch(apiUrl("/api/export/rent_opex"));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Download failed: ${resp.status} ${text}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rent_opex_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download rent/opex failed", err);
      alert("Cloud download failed. Check connection and DATABASE_URL.");
    }
  };

  const saveToCloud = async () => {
    if (rows.length === 0) {
      alert("No rows to save.");
      return;
    }
    try {
      for (const row of rows) {
        const payload = { ...row };
        delete payload.id;
        const resp = await fetch(apiUrl("/api/rent-opex"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Failed to save row (${resp.status}): ${text}`);
        }
      }
      alert("Saved to database with lease metadata.");
    } catch (err) {
      console.error("Save rent/opex failed", err);
      alert("Save failed. Check connection and server logs.");
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">Rent &amp; Opex</h3>
      <p className="page-subtitle">
        Track rent, utilities, and overhead with lease metadata. Saves to local storage and the Cloud DB.
      </p>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Landlord</th>
              <th>Category</th>
              <th>Frequency</th>
              <th>Fixed rent?</th>
              <th>Lease start</th>
              <th>Lease end</th>
              <th>Description</th>
              <th>Amount (JOD)</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="13">No rent/opex rows yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
                      required
                      value={row.date || ""}
                      onChange={(e) =>
                        handleChange(row.id, "date", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={row.brand || ""}
                      onChange={(e) =>
                        handleChange(row.id, "brand", e.target.value)
                      }
                    >
                      <option value="">Select brand...</option>
                      {brandOptions.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={row.outlet || ""}
                      onChange={(e) =>
                        handleChange(row.id, "outlet", e.target.value)
                      }
                    >
                      <option value="">Select outlet...</option>
                      {outletOptions.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.landlord || ""}
                      onChange={(e) =>
                        handleChange(row.id, "landlord", e.target.value)
                      }
                      placeholder="Landlord / counterparty"
                    />
                  </td>
                  <td>
                    <select
                      value={row.category || ""}
                      onChange={(e) =>
                        handleChange(row.id, "category", e.target.value)
                      }
                    >
                      <option value="">Select category...</option>
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={row.frequency || ""}
                      onChange={(e) =>
                        handleChange(row.id, "frequency", e.target.value)
                      }
                    >
                      <option value="">Set frequency</option>
                      {frequencyOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={!!row.isRentFixed}
                      onChange={(e) =>
                        handleChange(row.id, "isRentFixed", e.target.checked)
                      }
                      title="Mark as fixed rent (usually paid twice a year)"
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={row.leaseStart || ""}
                      onChange={(e) =>
                        handleChange(row.id, "leaseStart", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={row.leaseEnd || ""}
                      onChange={(e) =>
                        handleChange(row.id, "leaseEnd", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.description || ""}
                      onChange={(e) =>
                        handleChange(row.id, "description", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={row.amount || ""}
                      onChange={(e) =>
                        handleChange(row.id, "amount", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.notes || ""}
                      onChange={(e) =>
                        handleChange(row.id, "notes", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => handleDelete(row.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button type="button" className="primary-btn" onClick={addRow}>
          + Add Rent/Opex Row
        </button>
        <button type="button" className="secondary-btn" onClick={saveToCloud}>
          Save to Cloud DB
        </button>
        <button type="button" className="secondary-btn" onClick={downloadFromCloud}>
          Download from Cloud (CSV)
        </button>
      </div>

      <hr style={{ margin: "16px 0" }} />
      <h4>Lease schedule (next 12 months)</h4>
      <p className="page-subtitle" style={{ marginBottom: 8 }}>
        Uses lease start/end, frequency, and rent flag to forecast upcoming due amounts.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div
          style={{
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            minWidth: 180,
            background: "#f9fafb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280" }}>Due this month</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(nextMonthTotal)} JOD</div>
        </div>
        <div
          style={{
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            minWidth: 180,
            background: "#f9fafb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280" }}>Leases with schedule</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{schedule.nextDueByLease.length}</div>
        </div>
      </div>

      <div className="table-wrapper" style={{ marginBottom: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Brand / Outlet</th>
              <th>Landlord</th>
              <th>Frequency</th>
              <th>Next due</th>
              <th>Amount (per period)</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {schedule.nextDueByLease.length === 0 ? (
              <tr>
                <td colSpan="6">Add lease start and frequency to see next dues.</td>
              </tr>
            ) : (
              schedule.nextDueByLease.map((lease) => (
                <tr key={lease.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{lease.brand || "Unassigned brand"}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{lease.outlet || "Outlet not set"}</div>
                  </td>
                  <td>{lease.landlord || "N/A"}</td>
                  <td>{lease.frequency}</td>
                  <td>{formatDate(lease.date)}</td>
                  <td>{formatMoney(lease.amount)} JOD</td>
                  <td>{lease.description || "N/A"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Scheduled amount (JOD)</th>
            </tr>
          </thead>
          <tbody>
            {schedule.buckets.map((bucket) => (
              <tr key={bucket.key}>
                <td>{bucket.label}</td>
                <td>{formatMoney(bucket.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
