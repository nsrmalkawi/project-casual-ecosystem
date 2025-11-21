// src/features/targets/TargetsHub.jsx
import { useEffect, useState } from "react";

// Simple ID generator
function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

function useLocalArray(key) {
  const [rows, setRows] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(rows));
    } catch (e) {
      console.error("Failed to save", key, e);
    }
  }, [key, rows]);

  return [rows, setRows];
}

function TargetsHub() {
  const [targets, setTargets] = useLocalArray("pc_targets");

  const addRow = () => {
    setTargets((prev) => [
      ...prev,
      {
        id: makeId(),
        yearMonth: "",
        brand: "",
        outlet: "",
        salesTarget: "",
        foodCostPctTarget: "",
        laborPctTarget: "",
        rentOpexPctTarget: "",
        ebitdaPctTarget: "",
        notes: "",
      },
    ]);
  };

  const handleChange = (id, field, value) => {
    setTargets((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleDelete = (id) => {
    setTargets((prev) => prev.filter((row) => row.id !== id));
  };

  const clearAll = () => {
    if (window.confirm("Clear ALL targets?")) {
      setTargets([]);
    }
  };

  return (
    <div>
      <h2 className="page-title">Targets / Budgets</h2>
      <p className="page-subtitle">
        Define monthly targets per outlet (and optionally per brand). These are
        used in the Reports &amp; Dashboard &rarr; Budget vs Actual table.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, marginBottom: 8 }}>
          Guidelines:
        </p>
        <ul style={{ fontSize: 13, paddingLeft: 18 }}>
          <li>
            <strong>Month</strong>: Use the selector (YYYY-MM). The plan is
            monthly.
          </li>
          <li>
            <strong>Outlet</strong>: Must match the outlet name used in Data
            Entry (Sales / Rent / HR).
          </li>
          <li>
            <strong>Brand</strong> is optional and mostly for labeling. Targets
            are primarily evaluated per outlet/month.
          </li>
          <li>
            <strong>Targets</strong>: Sales in JOD, percentages as whole
            numbers (e.g. 40 for 40%).
          </li>
        </ul>
      </div>

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            gap: 8,
          }}
        >
          <h3 className="card-title">Monthly targets</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="secondary-btn"
              onClick={clearAll}
            >
              Clear all
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={addRow}
            >
              + Add Target Row
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Brand (optional)</th>
                <th>Outlet</th>
                <th>Sales Target (JOD)</th>
                <th>Food Cost %</th>
                <th>Labor %</th>
                <th>Rent &amp; Opex %</th>
                <th>EBITDA %</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {targets.length === 0 ? (
                <tr>
                  <td colSpan="10">No targets defined yet.</td>
                </tr>
              ) : (
                targets.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="month"
                        value={row.yearMonth || ""}
                        onChange={(e) =>
                          handleChange(row.id, "yearMonth", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.brand || ""}
                        onChange={(e) =>
                          handleChange(row.id, "brand", e.target.value)
                        }
                        placeholder="Optional"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.outlet || ""}
                        onChange={(e) =>
                          handleChange(row.id, "outlet", e.target.value)
                        }
                        placeholder="Outlet name"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="1"
                        value={row.salesTarget || ""}
                        onChange={(e) =>
                          handleChange(row.id, "salesTarget", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        value={row.foodCostPctTarget || ""}
                        onChange={(e) =>
                          handleChange(
                            row.id,
                            "foodCostPctTarget",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        value={row.laborPctTarget || ""}
                        onChange={(e) =>
                          handleChange(
                            row.id,
                            "laborPctTarget",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        value={row.rentOpexPctTarget || ""}
                        onChange={(e) =>
                          handleChange(
                            row.id,
                            "rentOpexPctTarget",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        value={row.ebitdaPctTarget || ""}
                        onChange={(e) =>
                          handleChange(
                            row.id,
                            "ebitdaPctTarget",
                            e.target.value
                          )
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
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TargetsHub;
