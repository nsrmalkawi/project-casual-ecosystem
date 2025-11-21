// src/features/data-entry/SalesEntry.jsx
import { useState, useEffect } from "react";
import { loadData, saveData } from "../../utils/storage";

const STORAGE_KEY = "pc_sales";

function SalesEntry() {
  const [form, setForm] = useState({
    date: "",
    brand: "",
    outlet: "",
    channel: "Dine-in",
    orders: "",
    netSales: "",
    deliveryPlatform: "",
    notes: "",
  });

  const [rows, setRows] = useState([]);

  // Load saved data on first render
  useEffect(() => {
    const stored = loadData(STORAGE_KEY, []);
    setRows(stored);
  }, []);

  // Save every time rows change
  useEffect(() => {
    saveData(STORAGE_KEY, rows);
  }, [rows]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdd = () => {
    if (!form.date || !form.brand || !form.outlet || !form.netSales) {
      alert("Date, Brand, Outlet, and Net Sales are required.");
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
      channel: "Dine-in",
      orders: "",
      netSales: "",
      deliveryPlatform: "",
      notes: "",
    });
  };

  const totalSales = rows.reduce(
    (sum, row) => sum + (Number(row.netSales) || 0),
    0
  );

  return (
    <div className="card">
      <h3 className="card-title">Sales Entry</h3>
      <p className="page-subtitle">
        Daily sales by brand, outlet, and channel. This feeds the daily/weekly
        dashboards and outlet strategy analysis.
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
            placeholder="Buns Meat Dough, Fish Face..."
            value={form.brand}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Outlet</label>
          <input
            type="text"
            name="outlet"
            placeholder="Abdoun, Cloud Kitchen..."
            value={form.outlet}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Channel</label>
          <select
            name="channel"
            value={form.channel}
            onChange={handleChange}
          >
            <option value="Dine-in">Dine-in</option>
            <option value="Delivery">Delivery</option>
            <option value="Takeaway">Takeaway</option>
          </select>
        </div>

        <div className="form-field">
          <label>Orders (count)</label>
          <input
            type="number"
            name="orders"
            value={form.orders}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Net Sales (JOD)</label>
          <input
            type="number"
            name="netSales"
            value={form.netSales}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Delivery Platform</label>
          <input
            type="text"
            name="deliveryPlatform"
            placeholder="Talabat, Careem..."
            value={form.deliveryPlatform}
            onChange={handleChange}
          />
        </div>

        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
          <label>Notes</label>
          <textarea
            name="notes"
            rows={2}
            placeholder="Promos, issues, special events..."
            value={form.notes}
            onChange={handleChange}
          />
        </div>
      </div>

      <button className="primary-btn" onClick={handleAdd}>
        Add Sales Row
      </button>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Channel</th>
              <th>Orders</th>
              <th>Net Sales (JOD)</th>
              <th>Delivery Platform</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="8">No sales data added yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.brand}</td>
                  <td>{row.outlet}</td>
                  <td>{row.channel}</td>
                  <td>{row.orders}</td>
                  <td>{row.netSales}</td>
                  <td>{row.deliveryPlatform}</td>
                  <td>{row.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="page-subtitle">
        Total Net Sales in table: <strong>{totalSales.toFixed(2)} JOD</strong>
      </p>
    </div>
  );
}

export default SalesEntry;
