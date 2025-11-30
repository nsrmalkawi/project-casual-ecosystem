// src/features/data-entry/SalesSection.jsx
import { useState, useEffect } from "react";
import { loadData } from "../../utils/storage";
import { validateRow, validateRows } from "../../utils/validation";
import { BRANDS, OUTLETS, SALES_CHANNELS } from "../../config/lookups";
import { SALES_FIELDS } from "../../config/dataModel";
import { exportToCsv, parseCsvTextToRows } from "../../utils/csv";

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

function normalizeRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.id) {
    return { ...raw, id: makeId() };
  }
  return raw;
}

function SalesSection({
  brandOptions = BRANDS,
  outletOptions = OUTLETS,
  channelOptions = SALES_CHANNELS,
} = {}) {
  const [rows, setRows] = useState(() => {
    const stored = loadData("pc_sales", []) || [];
    const normalized = stored.map(normalizeRow).filter((r) => r !== null);
    return normalized.length > 0
      ? normalized
      : [
          {
            id: makeId(),
            date: "",
            brand: "",
            outlet: "",
            channel: "",
            orders: "",
            covers: "",
            grossSales: "",
            discounts: "",
            netSales: "",
            vat: "",
            deliveryFees: "",
            notes: "",
          },
        ];
  });

  const [errorsByRow, setErrorsByRow] = useState({});
  const [formMessage, setFormMessage] = useState("");
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const apiUrl = (path) =>
    API_BASE ? `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1") : path;
  const downloadFromCloud = async () => {
    try {
      const resp = await fetch(apiUrl("/api/export/sales"));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Download failed: ${resp.status} ${text}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sales_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download from cloud failed", err);
      setFormMessage("Cloud download failed. Check connection and DATABASE_URL.");
    }
  };

  const loadFromCloud = async () => {
    try {
      const resp = await fetch(apiUrl("/api/sales"));
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
      console.error("Load from cloud failed", err);
      setFormMessage("Load failed. Check connection and DATABASE_URL.");
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem("pc_sales", JSON.stringify(rows));
    } catch (e) {
      console.error("Failed to save pc_sales", e);
    }
  }, [rows]);

  useEffect(() => {
    const { errorsByRow } = validateRows("sales", rows);
    setErrorsByRow(errorsByRow);
  }, []); // initial

  const updateRowField = (rowId, field, value) => {
    setRows((prev) => {
      const updated = prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      );

      const targetRow = updated.find((r) => r.id === rowId);
      const { errors } = validateRow("sales", targetRow || {});
      setErrorsByRow((prevErrors) => ({
        ...prevErrors,
        [rowId]: errors,
      }));

      return updated;
    });
    setFormMessage("");
  };

  const addRow = () => {
    const { isValid, errorsByRow } = validateRows("sales", rows);
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
        channel: "",
        orders: "",
        covers: "",
        grossSales: "",
        discounts: "",
        netSales: "",
        vat: "",
        deliveryFees: "",
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

  const getError = (rowId, field) =>
    errorsByRow[rowId] && errorsByRow[rowId][field]
      ? errorsByRow[rowId][field]
      : "";

  const saveToCloud = async () => {
    const { isValid, errorsByRow } = validateRows("sales", rows);
    setErrorsByRow(errorsByRow);
    if (!isValid) {
      setFormMessage("Please fix the highlighted fields before saving to database.");
      return;
    }

    try {
      setFormMessage("Saving to database...");
      for (const row of rows) {
        const payload = { ...row };
        delete payload.id; // local-only identifier
        const resp = await fetch(apiUrl("/api/sales"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Failed to save row (${resp.status}): ${text}`);
        }
      }
      setFormMessage("Saved to database. Use Admin > Data Import/Export to download.");
    } catch (err) {
      console.error("Save to cloud failed", err);
      setFormMessage("Save failed. Check connection, DATABASE_URL, and logs.");
    }
  };

  // ---------- CSV HANDLERS ----------

  const handleExportCsv = () => {
    exportToCsv("sales_export.csv", SALES_FIELDS, rows);
  };

  const handleImportCsv = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== "string") return;

      try {
        const parsed = parseCsvTextToRows(text, SALES_FIELDS);
        if (!parsed.length) {
          setFormMessage("CSV file has no data rows.");
          return;
        }
        const normalized = parsed.map(normalizeRow).filter((r) => r !== null);
        setRows(normalized);
        const { errorsByRow } = validateRows("sales", normalized);
        setErrorsByRow(errorsByRow);
        setFormMessage("");
      } catch (err) {
        console.error("CSV import failed", err);
        setFormMessage(
          "Failed to import CSV. Check that the header row matches the Sales columns."
        );
      }
    };
    reader.readAsText(file);
    // allow re-selecting the same file later
    event.target.value = "";
  };

  return (
    <div>
      <h3 className="card-title">Sales</h3>
      <p className="page-subtitle">
        Daily sales by brand, outlet, and channel. Required numeric fields must
        be filled with non-negative numbers before you add new rows.
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
          className="primary-btn"
          onClick={saveToCloud}
        >
          Save to Cloud DB
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
              <th>Channel</th>
              <th>Orders</th>
              <th>Covers</th>
              <th>Gross sales</th>
              <th>Discounts</th>
              <th>Net sales</th>
              <th>VAT</th>
              <th>Delivery fees</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="13">No sales rows yet.</td>
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
                        {brandOptions.map((b) => (
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
                        {outletOptions.map((o) => (
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

                  {/* Channel (dropdown) */}
                  <td>
                    <div className="field-with-error">
                      <select
                        value={row.channel || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "channel", e.target.value)
                        }
                        className={
                          getError(row.id, "channel") ? "input-error" : ""
                        }
                      >
                        <option value="">Select channel</option>
                        {channelOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      {getError(row.id, "channel") && (
                        <div className="error-text">
                          {getError(row.id, "channel")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Orders */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="1"
                        value={row.orders || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "orders", e.target.value)
                        }
                        className={
                          getError(row.id, "orders") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "orders") && (
                        <div className="error-text">
                          {getError(row.id, "orders")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Covers (optional) */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="1"
                        value={row.covers || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "covers", e.target.value)
                        }
                        className={
                          getError(row.id, "covers") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "covers") && (
                        <div className="error-text">
                          {getError(row.id, "covers")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Gross sales */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="0.001"
                        value={row.grossSales || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "grossSales", e.target.value)
                        }
                        className={
                          getError(row.id, "grossSales") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "grossSales") && (
                        <div className="error-text">
                          {getError(row.id, "grossSales")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Discounts */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="0.001"
                        value={row.discounts || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "discounts", e.target.value)
                        }
                        className={
                          getError(row.id, "discounts") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "discounts") && (
                        <div className="error-text">
                          {getError(row.id, "discounts")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Net sales */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="0.001"
                        value={row.netSales || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "netSales", e.target.value)
                        }
                        className={
                          getError(row.id, "netSales") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "netSales") && (
                        <div className="error-text">
                          {getError(row.id, "netSales")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* VAT */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="0.001"
                        value={row.vat || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "vat", e.target.value)
                        }
                        className={getError(row.id, "vat") ? "input-error" : ""}
                      />
                      {getError(row.id, "vat") && (
                        <div className="error-text">
                          {getError(row.id, "vat")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Delivery fees */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="0.001"
                        value={row.deliveryFees || ""}
                        onChange={(e) =>
                          updateRowField(
                            row.id,
                            "deliveryFees",
                            e.target.value
                          )
                        }
                        className={
                          getError(row.id, "deliveryFees")
                            ? "input-error"
                            : ""
                        }
                      />
                      {getError(row.id, "deliveryFees") && (
                        <div className="error-text">
                          {getError(row.id, "deliveryFees")}
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
                      placeholder="Optional"
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
        + Add row
      </button>
    </div>
  );
}

export default SalesSection;
