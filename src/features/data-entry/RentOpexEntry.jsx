// src/features/data-entry/RentOpexEntry.jsx
import { useState, useEffect } from "react";
import { loadData, saveData } from "../../utils/storage";

const STORAGE_KEY = "pc_rent_opex";

function RentOpexEntry() {
  const [form, setForm] = useState({
    month: "",
    outlet: "",
    category: "",
    amount: "",
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
    if (!form.month || !form.outlet || !form.category || !form.amount) {
      alert("Month, Outlet, Category, and Amount are required.");
      return;
    }

    const newRow = {
      id: Date.now(),
      ...form,
    };

    setRows((prev) => [...prev, newRow]);

    setForm({
      month: "",
      outlet: "",
      category: "",
      amount: "",
      notes: "",
    });
  };

  const totalOpex = rows.reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0
  );

  return (
    <div className="card">
      <h3 className="card-title">Rent & Opex</h3>
      <p className="page-subtitle">
        Record fixed costs like rent, utilities, salaries, and other OPEX. This
        is used for outlet profitability and outlet format decisions.
      </p>

      <div className="form-grid">
        <div className="form-field">
          <label>Month</label>
          <input
            type="month"
            name="month"
            value={form.month}
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
          <label>Category</label>
          <input
            type="text"
            name="category"
            placeholder="Rent, Utilities, Salaries, Marketing..."
            value={form.category}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Amount (JOD)</label>
          <input
            type="number"
            name="amount"
            value={form.amount}
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
        Add Opex Row
      </button>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Outlet</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="5">No rent/opex recorded yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.month}</td>
                  <td>{row.outlet}</td>
                  <td>{row.category}</td>
                  <td>{row.amount}</td>
                  <td>{row.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="page-subtitle">
        Total Opex in table: <strong>{totalOpex.toFixed(3)} JOD</strong>
      </p>
    </div>
  );
}

export default RentOpexEntry;
