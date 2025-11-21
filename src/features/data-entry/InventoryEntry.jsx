// src/features/data-entry/InventoryEntry.jsx
import { useState, useEffect } from "react";
import { loadData, saveData } from "../../utils/storage";

const STORAGE_KEY = "pc_inventory";

function InventoryEntry() {
  const [form, setForm] = useState({
    date: "",
    outlet: "",
    itemName: "",
    countedQty: "",
    systemQty: "",
    varianceQty: "",
    notes: "",
  });

  const [rows, setRows] = useState([]);

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
    if (!form.date || !form.outlet || !form.itemName) {
      alert("Date, Outlet, and Item are required.");
      return;
    }

    let varianceQty = form.varianceQty;
    if (varianceQty === "") {
      const counted = Number(form.countedQty) || 0;
      const system = Number(form.systemQty) || 0;
      varianceQty = counted - system;
    }

    const newRow = {
      id: Date.now(),
      ...form,
      varianceQty,
    };

    setRows((prev) => [...prev, newRow]);

    setForm({
      date: "",
      outlet: "",
      itemName: "",
      countedQty: "",
      systemQty: "",
      varianceQty: "",
      notes: "",
    });
  };

  return (
    <div className="card">
      <h3 className="card-title">Inventory Counts</h3>
      <p className="page-subtitle">
        Enter weekly inventory counts by outlet. This feeds stock variance and
        loss analysis.
      </p>

      <div className="form-grid">
        <div className="form-field">
          <label>Date / Week Ending</label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Outlet</label>
          <input
            type="text"
            name="outlet"
            value={form.outlet}
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
          <label>Counted Qty</label>
          <input
            type="number"
            name="countedQty"
            value={form.countedQty}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>System Qty</label>
          <input
            type="number"
            name="systemQty"
            value={form.systemQty}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Variance Qty (auto if empty)</label>
          <input
            type="number"
            name="varianceQty"
            value={form.varianceQty}
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
        Add Inventory Row
      </button>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Outlet</th>
              <th>Item</th>
              <th>Counted Qty</th>
              <th>System Qty</th>
              <th>Variance Qty</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="7">No inventory counts yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.outlet}</td>
                  <td>{row.itemName}</td>
                  <td>{row.countedQty}</td>
                  <td>{row.systemQty}</td>
                  <td>{row.varianceQty}</td>
                  <td>{row.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default InventoryEntry;
