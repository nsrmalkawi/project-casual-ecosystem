// src/features/data-entry/WasteEntry.jsx
import { useState, useEffect } from "react";
import { loadData, saveData } from "../../utils/storage";
import { BRANDS, OUTLETS } from "../../config/lookups";

const STORAGE_KEY = "pc_waste";

function WasteEntry() {
  const [form, setForm] = useState({
    date: "",
    brand: "",
    outlet: "",
    category: "",
    itemName: "",
    quantity: "",
    unit: "",
    unitCost: "",
    totalCost: "",
    reason: "",
    notes: "",
  });

  const [rows, setRows] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const apiUrl = (path) =>
    API_BASE ? `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1") : path;

  useEffect(() => {
    setRows(loadData(STORAGE_KEY, []));
  }, []);

  useEffect(() => {
    saveData(STORAGE_KEY, rows);
  }, [rows]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdd = () => {
    if (!form.date || !form.itemName || !form.category || !form.unitCost || !form.totalCost || !form.reason) {
      alert("Date, Category, Item, Reason, Unit Cost, and Total Cost are required.");
      return;
    }

    const newRow = {
      id: Date.now(),
      ...form,
    };

    setRows((prev) => [...prev, newRow]);

    setForm({
      date: "",
      brand: "",
      outlet: "",
      category: "",
      itemName: "",
      quantity: "",
      unit: "",
      unitCost: "",
      totalCost: "",
      reason: "",
      notes: "",
    });
  };

  const totalWaste = rows.reduce(
    (sum, row) => sum + (Number(row.totalCost) || 0),
    0
  );

  const downloadFromCloud = async () => {
    try {
      const resp = await fetch(apiUrl("/api/export/waste"));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Download failed: ${resp.status} ${text}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "waste_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download waste failed", err);
      alert("Cloud download failed. Check connection and DATABASE_URL.");
    }
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
        const resp = await fetch(apiUrl("/api/waste"), {
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
      console.error("Save waste failed", err);
      alert("Save failed. Check connection and server logs.");
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">Waste Log</h3>
      <p className="page-subtitle">
        Log daily waste by item, reason, and value. This feeds the waste %
        dashboards and improvement plans.
      </p>

      <div className="form-grid">
        <div className="form-field">
          <label>Date</label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
          />
        </div>

      <div className="form-field">
        <label>Brand</label>
        <select name="brand" value={form.brand} onChange={handleChange}>
          <option value="">Select brand</option>
          {BRANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label>Outlet</label>
        <select name="outlet" value={form.outlet} onChange={handleChange}>
          <option value="">Select outlet</option>
          {OUTLETS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label>Category</label>
        <input
          type="text"
          name="category"
          value={form.category}
          onChange={handleChange}
        />
      </div>

        <div className="form-field">
          <label>Item</label>
          <input
            type="text"
            name="itemName"
            value={form.itemName}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Quantity</label>
          <input
            type="number"
            name="quantity"
            value={form.quantity}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Unit</label>
          <input
            type="text"
            name="unit"
            value={form.unit}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Unit Cost (JOD)</label>
          <input
            type="number"
            name="unitCost"
            value={form.unitCost}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Total Cost (JOD)</label>
          <input
            type="number"
            name="totalCost"
            value={form.totalCost}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Reason</label>
          <input
            type="text"
            name="reason"
            placeholder="Overproduction, expiry..."
            value={form.reason}
            onChange={handleChange}
          />
        </div>

        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
          <label>Notes</label>
          <textarea
            name="notes"
            rows={2}
            value={form.notes}
            onChange={handleChange}
          />
        </div>
      </div>

      <button className="primary-btn" onClick={handleAdd}>
        Add Waste Row
      </button>
      <button className="secondary-btn" style={{ marginLeft: 8 }} onClick={downloadFromCloud}>
        Download from Cloud
      </button>
      <button className="secondary-btn" style={{ marginLeft: 8 }} onClick={saveToCloud}>
        Save to Cloud DB
      </button>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Cost Value</th>
              <th>Reason</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="9">No waste logged yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.brand}</td>
                  <td>{row.outlet}</td>
                  <td>{row.itemName}</td>
                  <td>{row.quantity}</td>
                  <td>{row.unit}</td>
                  <td>{row.costValue}</td>
                  <td>{row.reason}</td>
                  <td>{row.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="page-subtitle">
        Total Waste Value in table:{" "}
        <strong>{totalWaste.toFixed(3)} JOD</strong>
      </p>
    </div>
  );
}

export default WasteEntry;
