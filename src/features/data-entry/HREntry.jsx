// src/features/data-entry/HREntry.jsx
import { useState, useEffect } from "react";
import { loadData, saveData } from "../../utils/storage";

const STORAGE_KEY = "pc_hr_labor";

function HREntry() {
  const [form, setForm] = useState({
    date: "",
    employeeName: "",
    position: "",
    outlet: "",
    hoursWorked: "",
    hourlyRate: "",
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
    if (!form.date || !form.employeeName || !form.outlet) {
      alert("Date, Employee, and Outlet are required.");
      return;
    }

    const hours = Number(form.hoursWorked) || 0;
    const rate = Number(form.hourlyRate) || 0;
    const laborCost = hours * rate;

    const newRow = {
      id: Date.now(),
      ...form,
      laborCost,
    };

    setRows((prev) => [...prev, newRow]);

    setForm({
      date: "",
      employeeName: "",
      position: "",
      outlet: "",
      hoursWorked: "",
      hourlyRate: "",
      notes: "",
    });
  };

  const totalLabor = rows.reduce(
    (sum, row) => sum + (Number(row.laborCost) || 0),
    0
  );

  return (
    <div className="card">
      <h3 className="card-title">HR & Labor / SOPs</h3>
      <p className="page-subtitle">
        Capture labor cost inputs per outlet. This will later connect to labor
        % vs sales and employee assessments/SOPs.
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
          <label>Employee Name</label>
          <input
            type="text"
            name="employeeName"
            value={form.employeeName}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Position</label>
          <input
            type="text"
            name="position"
            value={form.position}
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
          <label>Hours Worked</label>
          <input
            type="number"
            name="hoursWorked"
            value={form.hoursWorked}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label>Hourly Rate (JOD)</label>
          <input
            type="number"
            name="hourlyRate"
            value={form.hourlyRate}
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
        Add Labor Row
      </button>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Position</th>
              <th>Outlet</th>
              <th>Hours</th>
              <th>Rate</th>
              <th>Labor Cost</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="8">No labor entries yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.employeeName}</td>
                  <td>{row.position}</td>
                  <td>{row.outlet}</td>
                  <td>{row.hoursWorked}</td>
                  <td>{row.hourlyRate}</td>
                  <td>{row.laborCost?.toFixed(3)}</td>
                  <td>{row.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="page-subtitle">
        Total Labor Cost in table:{" "}
        <strong>{totalLabor.toFixed(3)} JOD</strong>
      </p>
    </div>
  );
}

export default HREntry;
