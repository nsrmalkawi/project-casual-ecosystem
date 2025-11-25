// src/features/data-entry/PettyCashEntry.jsx
import { useState, useEffect } from "react";
import { loadData } from "../../utils/storage";
import { validateRow, validateRows } from "../../utils/validation";
import {
  BRANDS,
  OUTLETS,
  PETTY_CASH_CATEGORIES,
} from "../../config/lookups";
import { PETTY_CASH_FIELDS } from "../../config/dataModel";
import { exportToCsv, parseCsvTextToRows } from "../../utils/csv";

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

function normalizeRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.id) return { ...raw, id: makeId() };
  return raw;
}

function PettyCashEntry() {
  const [rows, setRows] = useState(() => {
    const stored = loadData("pc_petty_cash", []) || [];
    const normalized = stored.map(normalizeRow).filter((r) => r !== null);
    return normalized.length > 0
      ? normalized
      : [
          {
            id: makeId(),
            date: "",
            brand: "",
            outlet: "",
            category: "",
            description: "",
            amount: "",
            notes: "",
          },
        ];
  });

  const [errorsByRow, setErrorsByRow] = useState({});
  const [formMessage, setFormMessage] = useState("");
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const apiUrl = (path) =>
    API_BASE ? `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1") : path;

  useEffect(() => {
    try {
      localStorage.setItem("pc_petty_cash", JSON.stringify(rows));
    } catch (e) {
      console.error("Failed to save pc_petty_cash", e);
    }
  }, [rows]);

  useEffect(() => {
    const { errorsByRow } = validateRows("pettyCash", rows);
    setErrorsByRow(errorsByRow);
  }, []); // initial

  const getError = (rowId, field) =>
    errorsByRow[rowId] && errorsByRow[rowId][field]
      ? errorsByRow[rowId][field]
      : "";

  const updateRowField = (rowId, field, value) => {
    setRows((prev) => {
      const updated = prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      );

      const targetRow = updated.find((r) => r.id === rowId);
      const { errors } = validateRow("pettyCash", targetRow || {});
      setErrorsByRow((prevErrors) => ({
        ...prevErrors,
        [rowId]: errors,
      }));

      return updated;
    });
    setFormMessage("");
  };

  const addRow = () => {
    const { isValid, errorsByRow } = validateRows("pettyCash", rows);
    setErrorsByRow(errorsByRow);

    if (!isValid) {
      setFormMessage(
        "Please fix the highlighted fields before adding a new row."
      );
      return;
    }

    setRows((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        brand: "",
        outlet: "",
        category: "",
        description: "",
        amount: "",
        notes: "",
      },
    ]);
    setFormMessage("");
  };

  const deleteRow = (rowId) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
    setErrorsByRow((prev) => {
      const copy = { ...prev };
      delete copy[rowId];
      return copy;
    });
    setFormMessage("");
  };

  // ---------- CSV HANDLERS ----------

  const handleExportCsv = () => {
    exportToCsv("petty_cash_export.csv", PETTY_CASH_FIELDS, rows);
  };

  const downloadFromCloud = async () => {
    try {
      const resp = await fetch(apiUrl("/api/export/petty_cash"));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Download failed: ${resp.status} ${text}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "petty_cash_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download petty cash failed", err);
      setFormMessage("Cloud download failed. Check connection and DATABASE_URL.");
    }
  };

  const loadFromCloud = async () => {
    try {
      const resp = await fetch(apiUrl("/api/petty-cash"));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Load failed: ${resp.status} ${text}`);
      }
      const data = await resp.json();
      const serverRows = (data.rows || []).map(normalizeRow).filter(Boolean);
      if (!serverRows.length) {
        setFormMessage("No rows found in database.");
      } else {
        setRows(serverRows);
        setFormMessage("Loaded from database.");
      }
    } catch (err) {
      console.error("Load petty cash failed", err);
      setFormMessage("Load failed. Check connection and DATABASE_URL.");
    }
  };

  const handleImportCsv = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== "string") return;

      try {
        const parsed = parseCsvTextToRows(text, PETTY_CASH_FIELDS);
        if (!parsed.length) {
          setFormMessage("CSV file has no data rows.");
          return;
        }
        const normalized = parsed.map(normalizeRow).filter((r) => r !== null);
        setRows(normalized);
        const { errorsByRow } = validateRows("pettyCash", normalized);
        setErrorsByRow(errorsByRow);
        setFormMessage("");
      } catch (err) {
        console.error("CSV import failed", err);
        setFormMessage(
          "Failed to import CSV. Check that the header row matches the Petty Cash columns."
        );
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className="card">
      <h3 className="card-title">Petty Cash</h3>
      <p className="page-subtitle">
        Track small daily expenses paid from petty cash (delivery tips, small
        supplies, quick repairs, etc.). Required fields are highlighted until
        they are valid.
      </p>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="secondary-btn"
          onClick={handleExportCsv}
        >
          Export CSV
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={downloadFromCloud}
        >
          Download from Cloud
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={loadFromCloud}
        >
          Load from Cloud DB
        </button>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            backgroundColor: "#ffffff",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportCsv}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {formMessage && (
        <div
          style={{
            marginBottom: 8,
            padding: "6px 8px",
            borderRadius: 4,
            backgroundColor: "#fee2e2",
            color: "#b91c1c",
            fontSize: 12,
          }}
        >
          {formMessage}
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount (JOD)</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="8">No petty cash entries yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {/* Date */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="date"
                        value={row.date || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "date", e.target.value)
                        }
                        className={
                          getError(row.id, "date") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "date") && (
                        <div className="error-text">
                          {getError(row.id, "date")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Brand (dropdown) */}
                  <td>
                    <div className="field-with-error">
                      <select
                        value={row.brand || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "brand", e.target.value)
                        }
                        className={
                          getError(row.id, "brand") ? "input-error" : ""
                        }
                      >
                        <option value="">Select brand</option>
                        {BRANDS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                      {getError(row.id, "brand") && (
                        <div className="error-text">
                          {getError(row.id, "brand")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Outlet (dropdown) */}
                  <td>
                    <div className="field-with-error">
                      <select
                        value={row.outlet || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "outlet", e.target.value)
                        }
                        className={
                          getError(row.id, "outlet") ? "input-error" : ""
                        }
                      >
                        <option value="">Select outlet</option>
                        {OUTLETS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                      {getError(row.id, "outlet") && (
                        <div className="error-text">
                          {getError(row.id, "outlet")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Category (dropdown) */}
                  <td>
                    <div className="field-with-error">
                      <select
                        value={row.category || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "category", e.target.value)
                        }
                        className={
                          getError(row.id, "category") ? "input-error" : ""
                        }
                      >
                        <option value="">Select category</option>
                        {PETTY_CASH_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      {getError(row.id, "category") && (
                        <div className="error-text">
                          {getError(row.id, "category")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Description */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="text"
                        value={row.description || ""}
                        onChange={(e) =>
                          updateRowField(
                            row.id,
                            "description",
                            e.target.value
                          )
                        }
                        className={
                          getError(row.id, "description") ? "input-error" : ""
                        }
                        placeholder="Short explanation"
                      />
                      {getError(row.id, "description") && (
                        <div className="error-text">
                          {getError(row.id, "description")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Amount */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="0.001"
                        value={row.amount || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "amount", e.target.value)
                        }
                        className={
                          getError(row.id, "amount") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "amount") && (
                        <div className="error-text">
                          {getError(row.id, "amount")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Notes */}
                  <td>
                    <input
                      type="text"
                      value={row.notes || ""}
                      onChange={(e) =>
                        updateRowField(row.id, "notes", e.target.value)
                      }
                    />
                  </td>

                  {/* Delete */}
                  <td>
                    <button type="button" onClick={() => deleteRow(row.id)}>
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
        + Add Petty Cash Row
      </button>
    </div>
  );
}

export default PettyCashEntry;
