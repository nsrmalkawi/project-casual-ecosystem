// src/features/data-entry/RentOpexEntry.jsx
import { useEffect, useState } from "react";
import { loadData, saveData } from "../../utils/storage";
import { OUTLET_OPTIONS, RENT_OPEX_CATEGORIES } from "../../config/lookups";

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

export default function RentOpexEntry() {
  const [rows, setRows] = useState(() => loadData("pc_rent_opex", []) || []);

  useEffect(() => {
    saveData("pc_rent_opex", rows);
  }, [rows]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        outlet: "",
        category: "",
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
              <th>Outlet</th>
              <th>Category</th>
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
    </div>
  );
}
