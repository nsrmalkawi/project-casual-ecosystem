// src/features/data-entry/WasteEntry.jsx
import { useState, useEffect } from "react";
import { loadData, saveData } from "../../utils/storage";

const STORAGE_KEY = "pc_waste";

function WasteEntry() {
  const [form, setForm] = useState({
    date: "",
    brand: "",
    outlet: "",
    itemName: "",
    quantity: "",
    unit: "",
    costValue: "",
    reason: "",
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
    if (!form.date || !form.itemName || !form.costValue) {
      alert("Date, Item, and Cost Value are required.");
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
      itemName: "",
      quantity: "",
      unit: "",
      costValue: "",
      reason: "",
      notes: "",
    });
  };

  const totalWaste = rows.reduce(
    (sum, row) => sum + (Number(row.costValue) || 0),
    0
  );

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
          <input
            type="text"
            name="brand"
            value={form.brand}
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
          <label>Cost Value (JOD)</label>
          <input
            type="number"
            name="costValue"
            value={form.costValue}
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
