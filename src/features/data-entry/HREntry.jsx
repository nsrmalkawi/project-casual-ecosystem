// src/features/data-entry/HREntry.jsx
import { useEffect, useState } from "react";
import { loadData, saveData } from "../../utils/storage";
import { OUTLET_OPTIONS, HR_ROLES } from "../../config/lookups";

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

export default function HREntry() {
  const [rows, setRows] = useState(() => loadData("pc_hr_labor", []) || []);

  useEffect(() => {
    saveData("pc_hr_labor", rows);
  }, [rows]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        outlet: "",
        employee: "",
        role: "",
        hours: "",
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
              <th>Outlet</th>
              <th>Employee</th>
              <th>Role</th>
              <th>Hours</th>
              <th>Labor Cost (JOD)</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="8">No HR rows yet.</td>
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
                      type="text"
                      value={row.employee || ""}
                      onChange={(e) =>
                        handleChange(row.id, "employee", e.target.value)
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
                      {HR_ROLES.map((r) => (
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
    </div>
  );
}
