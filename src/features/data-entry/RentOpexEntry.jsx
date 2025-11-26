// src/features/data-entry/RentOpexEntry.jsx
import { useEffect, useState } from "react";
import { loadData, saveData } from "../../utils/storage";
import { OUTLET_OPTIONS, RENT_OPEX_CATEGORIES, BRAND_OPTIONS } from "../../config/lookups";

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

export default function RentOpexEntry() {
  const [rows, setRows] = useState(() => loadData("pc_rent_opex", []) || []);
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const apiUrl = (path) =>
    API_BASE ? `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1") : path;
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

  useEffect(() => {
    saveData("pc_rent_opex", rows);
  }, [rows]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        brand: "",
        outlet: "",
        category: "",
        isRentFixed: false, // NEW: rent-only flag (fixed, paid twice a year)
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

  return (
    <div className="card">
      <h3 className="card-title">Rent & Opex</h3>
      <p className="page-subtitle">
        Operating expenses by outlet and category. Feeds EBITDA.
      </p>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Category</th>
              <th>Rent only?</th>
              <th>Description</th>
              <th>Amount (JOD)</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="6">No rent/opex rows yet.</td>
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
                      <option value="">Select brand…</option>
                      {BRAND_OPTIONS.map((b) => (
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
                      {OUTLET_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={row.category || ""}
                      onChange={(e) =>
                        handleChange(row.id, "category", e.target.value)
                      }
                    >
                      <option value="">Select category…</option>
                      {RENT_OPEX_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={!!row.isRentFixed}
                      onChange={(e) => handleChange(row.id, "isRentFixed", e.target.checked)}
                      title="Mark as fixed rent (paid twice a year)"
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
        + Add Rent/Opex Row
      </button>
      <button
        type="button"
        className="secondary-btn"
        style={{ marginTop: 8, marginLeft: 8 }}
        onClick={async () => {
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
            alert("Saved to database. Use Admin > Data Import/Export or Download from Cloud.");
          } catch (err) {
            console.error("Save rent/opex failed", err);
            alert("Save failed. Check connection and server logs.");
          }
        }}
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
