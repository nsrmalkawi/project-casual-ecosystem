// src/features/data-entry/InventoryEntry.jsx
import { useEffect, useState } from "react";
import { loadData } from "../../utils/storage";
import { validateRow, validateRows } from "../../utils/validation";
import { BRANDS, OUTLETS } from "../../config/lookups";
import { INVENTORY_FIELDS } from "../../config/dataModel";
import { exportToCsv, parseCsvTextToRows } from "../../utils/csv";

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

function normalizeRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.id) return { ...raw, id: makeId() };
  return raw;
}

export default function InventoryEntry() {
  const [rows, setRows] = useState(() => {
    const stored = loadData("pc_inventory", []) || [];
    const normalized = stored.map(normalizeRow).filter((r) => r !== null);
    return normalized.length > 0
      ? normalized
      : [
          {
            id: makeId(),
            itemCode: "",
            itemName: "",
            category: "",
            brand: "",
            defaultOutlet: "",
            unit: "",
            parLevel: "",
            minLevel: "",
            lastCost: "",
            avgCost: "",
            currentQty: "",
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
      localStorage.setItem("pc_inventory", JSON.stringify(rows));
    } catch (e) {
      console.error("Failed to save pc_inventory", e);
    }
  }, [rows]);

  useEffect(() => {
    const { errorsByRow } = validateRows("inventory", rows);
    setErrorsByRow(errorsByRow);
  }, []);

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
      const { errors } = validateRow("inventory", targetRow || {});
      setErrorsByRow((prevErrors) => ({
        ...prevErrors,
        [rowId]: errors,
      }));
      return updated;
    });
    setFormMessage("");
  };

  const addRow = () => {
    const { isValid, errorsByRow } = validateRows("inventory", rows);
    setErrorsByRow(errorsByRow);
    if (!isValid) {
      setFormMessage("Please fix the highlighted fields before adding a new row.");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id: makeId(),
        itemCode: "",
        itemName: "",
        category: "",
        brand: "",
        defaultOutlet: "",
        unit: "",
        parLevel: "",
        minLevel: "",
        lastCost: "",
        avgCost: "",
        currentQty: "",
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

  const handleExportCsv = () => {
    exportToCsv("inventory_export.csv", INVENTORY_FIELDS, rows);
  };

  const downloadFromCloud = async () => {
    try {
      const resp = await fetch(apiUrl("/api/export/inventory_items"));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Download failed: ${resp.status} ${text}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventory_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download inventory failed", err);
      setFormMessage("Cloud download failed. Check connection and DATABASE_URL.");
    }
  };

  const loadFromCloud = async () => {
    try {
      const resp = await fetch(apiUrl("/api/inventory-items"));
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
      console.error("Load inventory failed", err);
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
        const parsed = parseCsvTextToRows(text, INVENTORY_FIELDS);
        if (!parsed.length) {
          setFormMessage("CSV file has no data rows.");
          return;
        }
        const normalized = parsed.map(normalizeRow).filter((r) => r !== null);
        setRows(normalized);
        const { errorsByRow } = validateRows("inventory", normalized);
        setErrorsByRow(errorsByRow);
        setFormMessage("");
      } catch (err) {
        console.error("CSV import failed", err);
        setFormMessage(
          "Failed to import CSV. Check that the header row matches the Inventory columns."
        );
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className="card">
      <h3 className="card-title">Inventory / Items Master</h3>
      <p className="page-subtitle">
        Master data for inventory items. Save to DB to include in exports.
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
              <th>Item Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Brand</th>
              <th>Default Outlet</th>
              <th>Unit</th>
              <th>Par Level</th>
              <th>Min Level</th>
              <th>Last Cost</th>
              <th>Avg Cost</th>
              <th>Current Qty</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="13">No inventory rows yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="field-with-error">
                      <input
                        type="text"
                        value={row.itemCode || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "itemCode", e.target.value)
                        }
                        className={
                          getError(row.id, "itemCode") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "itemCode") && (
                        <div className="error-text">
                          {getError(row.id, "itemCode")}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="field-with-error">
                      <input
                        type="text"
                        value={row.itemName || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "itemName", e.target.value)
                        }
                        className={
                          getError(row.id, "itemName") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "itemName") && (
                        <div className="error-text">
                          {getError(row.id, "itemName")}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="field-with-error">
                      <input
                        type="text"
                        value={row.category || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "category", e.target.value)
                        }
                        className={
                          getError(row.id, "category") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "category") && (
                        <div className="error-text">
                          {getError(row.id, "category")}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.brand || ""}
                      onChange={(e) =>
                        updateRowField(row.id, "brand", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={row.defaultOutlet || ""}
                      onChange={(e) =>
                        updateRowField(row.id, "defaultOutlet", e.target.value)
                      }
                    >
                      <option value="">Select outlet</option>
                      {OUTLETS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="field-with-error">
                      <input
                        type="text"
                        value={row.unit || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "unit", e.target.value)
                        }
                        className={getError(row.id, "unit") ? "input-error" : ""}
                      />
                      {getError(row.id, "unit") && (
                        <div className="error-text">
                          {getError(row.id, "unit")}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      value={row.parLevel || ""}
                      onChange={(e) =>
                        updateRowField(row.id, "parLevel", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      value={row.minLevel || ""}
                      onChange={(e) =>
                        updateRowField(row.id, "minLevel", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="0.001"
                        value={row.lastCost || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "lastCost", e.target.value)
                        }
                        className={
                          getError(row.id, "lastCost") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "lastCost") && (
                        <div className="error-text">
                          {getError(row.id, "lastCost")}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      value={row.avgCost || ""}
                      onChange={(e) =>
                        updateRowField(row.id, "avgCost", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      value={row.currentQty || ""}
                      onChange={(e) =>
                        updateRowField(row.id, "currentQty", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.notes || ""}
                      onChange={(e) =>
                        updateRowField(row.id, "notes", e.target.value)
                      }
                      placeholder="Optional"
                    />
                  </td>
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
        + Add Inventory Row
      </button>
      <button
        type="button"
        className="secondary-btn"
        style={{ marginTop: 8, marginLeft: 8 }}
        onClick={async () => {
          const { isValid, errorsByRow } = validateRows("inventory", rows);
          setErrorsByRow(errorsByRow);
          if (!isValid) {
            setFormMessage("Please fix the highlighted fields before saving to database.");
            return;
          }
          try {
            for (const row of rows) {
              const payload = { ...row };
              delete payload.id;
              const resp = await fetch(apiUrl("/api/inventory-items"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Failed to save row (${resp.status}): ${text}`);
              }
            }
            setFormMessage("Saved to database. Use Download/Load from Cloud.");
          } catch (err) {
            console.error("Save inventory failed", err);
            setFormMessage("Save failed. Check connection and server logs.");
          }
        }}
      >
        Save to Cloud DB
      </button>
      <button
        type="button"
        className="secondary-btn"
        style={{ marginTop: 8, marginLeft: 8 }}
        onClick={loadFromCloud}
      >
        Load from Cloud DB
      </button>
    </div>
  );
}
