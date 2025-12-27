// src/features/data-entry/HREntry.jsx
import { useEffect, useState } from "react";
import { loadData, saveData } from "../../utils/storage";
import {
  OUTLET_OPTIONS,
  HR_ROLES,
  BRAND_OPTIONS,
  PRIMARY_BRAND,
  PRIMARY_OUTLET,
} from "../../config/lookups";

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

export default function HREntry({
  brandOptions = BRAND_OPTIONS,
  outletOptions = OUTLET_OPTIONS,
  roleOptions = HR_ROLES,
} = {}) {
  const primaryBrand = brandOptions[0] || PRIMARY_BRAND || "";
  const primaryOutlet = outletOptions[0] || PRIMARY_OUTLET || "";

  const [rows, setRows] = useState(() => {
    const stored = loadData("pc_hr_labor", []) || [];
    const hydrated = stored.map((r) => ({
      ...r,
      brand: r.brand || primaryBrand,
      outlet: r.outlet || primaryOutlet,
    }));
    return hydrated.length
      ? hydrated
      : [
          {
            id: makeId(),
            date: "",
            brand: primaryBrand,
            outlet: primaryOutlet,
            employeeName: "",
            role: "",
            hours: "",
            hourlyRate: "",
            basePay: "",
            overtimePay: "",
            otherPay: "",
            laborCost: "",
            notes: "",
          },
        ];
  });
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const apiUrl = (path) =>
    API_BASE ? `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1") : path;
  const downloadFromCloud = async () => {
    try {
      const resp = await fetch(apiUrl("/api/export/hr_payroll"));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Download failed: ${resp.status} ${text}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hr_payroll_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download HR failed", err);
      alert("Cloud download failed. Check connection and DATABASE_URL.");
    }
  };

  useEffect(() => {
    saveData("pc_hr_labor", rows);
  }, [rows]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        brand: primaryBrand,
        outlet: primaryOutlet,
        employeeName: "",
        role: "",
        hours: "",
        hourlyRate: "",
        basePay: "",
        overtimePay: "",
        otherPay: "",
        laborCost: "",
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

  const saveToCloud = async () => {
    if (rows.length === 0) {
      alert("No rows to save.");
      return;
    }
    try {
      for (const row of rows) {
        const payload = { ...row };
        delete payload.id;
        const resp = await fetch(apiUrl("/api/hr-payroll"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Failed to save row (${resp.status}): ${text}`);
        }
      }
      alert("Saved to database. Use Admin > Data Import/Export to download.");
    } catch (err) {
      console.error("Save HR failed", err);
      alert("Save failed. Check connection and server logs.");
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">HR / Labor</h3>
      <p className="page-subtitle">
        Labor cost per employee and outlet. Used in labor % of sales and EBITDA.
      </p>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Employee</th>
              <th>Role</th>
              <th>Hours</th>
              <th>Hourly Rate</th>
              <th>Base Pay</th>
              <th>Overtime Pay</th>
              <th>Other Pay</th>
              <th>Total Labor Cost</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="12">No HR rows yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
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
                      <option value="">Select brand…</option>
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
                      <option value="">Select outlet…</option>
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
                      value={row.employeeName || ""}
                      onChange={(e) =>
                        handleChange(row.id, "employeeName", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={row.role || ""}
                      onChange={(e) =>
                        handleChange(row.id, "role", e.target.value)
                      }
                    >
                      <option value="">Select role…</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      value={row.hours || ""}
                      onChange={(e) =>
                        handleChange(row.id, "hours", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      value={row.hourlyRate || ""}
                      onChange={(e) =>
                        handleChange(row.id, "hourlyRate", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      value={row.basePay || ""}
                      onChange={(e) =>
                        handleChange(row.id, "basePay", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      value={row.overtimePay || ""}
                      onChange={(e) =>
                        handleChange(row.id, "overtimePay", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      value={row.otherPay || ""}
                      onChange={(e) =>
                        handleChange(row.id, "otherPay", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      value={row.laborCost || ""}
                      onChange={(e) =>
                        handleChange(row.id, "laborCost", e.target.value)
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
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="primary-btn"
        style={{ marginTop: 8 }}
        onClick={addRow}
      >
        + Add HR Row
      </button>
      <button
        type="button"
        className="secondary-btn"
        style={{ marginTop: 8, marginLeft: 8 }}
        onClick={saveToCloud}
      >
        Save to Cloud DB
      </button>
      <button
        type="button"
        className="secondary-btn"
        style={{ marginTop: 8, marginLeft: 8 }}
        onClick={downloadFromCloud}
      >
        Download from Cloud
      </button>
    </div>
  );
}
