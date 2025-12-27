// src/features/data-entry/SalesEntry.jsx
import { useEffect, useState } from "react";
import { loadData, saveData } from "../../utils/storage";
import {
  BRAND_OPTIONS,
  OUTLET_OPTIONS,
  PRIMARY_BRAND,
  PRIMARY_OUTLET,
} from "../../config/lookups";

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

export default function SalesEntry() {
  const [rows, setRows] = useState(() => loadData("pc_sales", []) || []);

  useEffect(() => {
    saveData("pc_sales", rows);
  }, [rows]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        brand: PRIMARY_BRAND,
        outlet: PRIMARY_OUTLET,
        netSales: "",
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
      <h3 className="card-title">Sales</h3>
      <p className="page-subtitle">
        Net sales by date, using standardized brand and outlet dropdowns.
      </p>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Net Sales (JOD)</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="6">No sales rows yet.</td>
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
                    <input
                      type="number"
                      step="0.001"
                      value={row.netSales || ""}
                      onChange={(e) =>
                        handleChange(row.id, "netSales", e.target.value)
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
        + Add Sales Row
      </button>
    </div>
  );
}
