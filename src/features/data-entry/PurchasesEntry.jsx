// src/features/data-entry/PurchasesEntry.jsx
import { useState, useEffect } from "react";
import { loadData } from "../../utils/storage";
import { validateRow, validateRows } from "../../utils/validation";
import { BRANDS, OUTLETS } from "../../config/lookups";
import { exportToCsv, parseCsvTextToRows } from "../../utils/csv";

const PURCHASE_FIELDS = [
  { key: "date", label: "Date" },
  { key: "brand", label: "Brand" },
  { key: "outlet", label: "Outlet" },
  { key: "supplier", label: "Supplier" },
  { key: "category", label: "Category" },
  { key: "itemName", label: "Item" },
  { key: "unit", label: "Unit" },
  { key: "quantity", label: "Quantity" },
  { key: "unitCost", label: "Unit Cost" },
  { key: "totalCost", label: "Total Cost" },
  { key: "invoiceNo", label: "Invoice No" },
  { key: "paymentTerm", label: "Payment Term" },
  { key: "notes", label: "Notes" },
];

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

function normalizeRow(raw) {
  if (!raw || typeof raw !== "object") return null;

  return {
    id: raw.id || makeId(),
    date: raw.date || "",
    brand: raw.brand || "",
    outlet: raw.outlet || "",
    supplier: raw.supplier || "",
    category: raw.category || "",
    itemName: raw.itemName || "",
    unit: raw.unit || "",
    quantity: raw.quantity || "",
    unitCost: raw.unitCost || "",
    totalCost: raw.totalCost || "",
    invoiceNo: raw.invoiceNo || "",
    paymentTerm: raw.paymentTerm || "",
    notes: raw.notes || "",
  };
}

function PurchasesEntry() {
  const [rows, setRows] = useState(() => {
    const stored = loadData("pc_purchases", []) || [];
    const normalized = stored.map(normalizeRow).filter((r) => r !== null);
    return normalized.length > 0
      ? normalized
      : [
          {
            id: makeId(),
            date: "",
            brand: "",
            outlet: "",
            supplier: "",
            category: "",
            itemName: "",
            unit: "",
            quantity: "",
            unitCost: "",
            totalCost: "",
            invoiceNo: "",
            paymentTerm: "",
            notes: "",
          },
        ];
  });

  const [errorsByRow, setErrorsByRow] = useState({});
  const [formMessage, setFormMessage] = useState("");

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("pc_purchases", JSON.stringify(rows));
    } catch (e) {
      console.error("Failed to save pc_purchases", e);
    }
  }, [rows]);

  // Initial validation
  useEffect(() => {
    const { errorsByRow } = validateRows("purchases", rows);
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
      const { errors } = validateRow("purchases", targetRow || {});
      setErrorsByRow((prevErrors) => ({
        ...prevErrors,
        [rowId]: errors,
      }));

      return updated;
    });
    setFormMessage("");
  };

  const addRow = () => {
    const { isValid, errorsByRow } = validateRows("purchases", rows);
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
        supplier: "",
        category: "",
        itemName: "",
        unit: "",
        quantity: "",
        unitCost: "",
        totalCost: "",
        invoiceNo: "",
        paymentTerm: "",
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

  // ---------- CSV handlers ----------

  const handleExportCsv = () => {
    exportToCsv("purchases_export.csv", PURCHASE_FIELDS, rows);
  };

  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const apiUrl = (path) =>
    API_BASE ? `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1") : path;
  const downloadFromCloud = async () => {
    try {
      const resp = await fetch(apiUrl("/api/export/purchases"));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Download failed: ${resp.status} ${text}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "purchases_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download purchases failed", err);
      setFormMessage("Cloud download failed. Check connection and DATABASE_URL.");
    }
  };

  const saveToCloud = async () => {
    const { isValid, errorsByRow } = validateRows("purchases", rows);
    setErrorsByRow(errorsByRow);
    if (!isValid) {
      const firstErrRow = Object.entries(errorsByRow).find(
        ([, errs]) => errs && Object.keys(errs).length
      );
      if (firstErrRow) {
        const [rowId, errs] = firstErrRow;
        const fields = Object.keys(errs).join(", ");
        setFormMessage(
          `Please fill required numeric/text fields (${fields}) on row ${rowId}.`
        );
      } else {
        setFormMessage("Please fix the highlighted fields before saving to database.");
      }
      return;
    }

    try {
      setFormMessage("Saving to database...");
      for (const row of rows) {
        const payload = { ...row };
        delete payload.id;
        const resp = await fetch(apiUrl("/api/purchases"), {
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
      console.error("Save purchases failed", err);
      setFormMessage("Save failed. Check connection, DATABASE_URL, and logs.");
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
        const parsed = parseCsvTextToRows(text, PURCHASE_FIELDS);
        if (!parsed.length) {
          setFormMessage("CSV file has no data rows.");
          setStatusType?.("error");
          return;
        }

        const normalized = parsed.map(normalizeRow).filter((r) => r !== null);
        setRows(normalized);

        const { errorsByRow } = validateRows("purchases", normalized);
        setErrorsByRow(errorsByRow);
        setFormMessage("");
      } catch (err) {
        console.error("CSV import failed", err);
        setFormMessage(
          "Failed to import CSV. Check that the header row matches the Purchases columns."
        );
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className="card">
      <h3 className="card-title">Purchases / COGS</h3>
      <p className="page-subtitle">
        Track supplier invoices used for cost of goods sold (COGS). These feed
        into COGS%, gross margin, and EBITDA in your reports.
      </p>

      {/* CSV controls */}
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

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Supplier</th>
              <th>Category</th>
              <th>Item</th>
              <th>Unit</th>
              <th>Quantity</th>
              <th>Unit Cost</th>
              <th>Total Cost (JOD)</th>
              <th>Invoice No</th>
              <th>Payment Term</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="13">No purchase rows yet.</td>
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

                  {/* Brand */}
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

                  {/* Outlet */}
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

                  {/* Supplier */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="text"
                        value={row.supplier || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "supplier", e.target.value)
                        }
                        className={
                          getError(row.id, "supplier") ? "input-error" : ""
                        }
                        placeholder="Supplier name"
                      />
                      {getError(row.id, "supplier") && (
                        <div className="error-text">
                          {getError(row.id, "supplier")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Category */}
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

                  {/* Item */}
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

                  {/* Unit */}
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

                  {/* Quantity */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="0.001"
                        value={row.quantity || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "quantity", e.target.value)
                        }
                        className={
                          getError(row.id, "quantity") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "quantity") && (
                        <div className="error-text">
                          {getError(row.id, "quantity")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Unit Cost */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="0.001"
                        value={row.unitCost || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "unitCost", e.target.value)
                        }
                        className={
                          getError(row.id, "unitCost") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "unitCost") && (
                        <div className="error-text">
                          {getError(row.id, "unitCost")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Total Cost */}
                  <td>
                    <div className="field-with-error">
                      <input
                        type="number"
                        step="0.001"
                        value={row.totalCost || ""}
                        onChange={(e) =>
                          updateRowField(row.id, "totalCost", e.target.value)
                        }
                        className={
                          getError(row.id, "totalCost") ? "input-error" : ""
                        }
                      />
                      {getError(row.id, "totalCost") && (
                        <div className="error-text">
                          {getError(row.id, "totalCost")}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Invoice No */}
                  <td>
                    <input
                      type="text"
                      value={row.invoiceNo || ""}
                      onChange={(e) =>
                        updateRowField(row.id, "invoiceNo", e.target.value)
                      }
                      placeholder="Optional"
                    />
                    </td>

                  {/* Payment Term */}
                  <td>
                    <input
                      type="text"
                      value={row.paymentTerm || ""}
                      onChange={(e) =>
                        updateRowField(row.id, "paymentTerm", e.target.value)
                      }
                      placeholder="Optional"
                    />
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
        + Add Purchase Row
      </button>
    </div>
  );
}

export default PurchasesEntry;
