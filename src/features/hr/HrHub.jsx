// src/features/hr/HrHub.jsx
import { useEffect, useMemo, useState } from 'react';
import { hrAssessmentTemplate } from '../../config/hrAssessmentsConfig';
import { useData } from '../../DataContext';

const API_BASE =
  import.meta.env.VITE_API_BASE || (typeof window !== "undefined" ? window.location.origin : "");

const DEFAULT_EMPLOYEE = {
  employeeId: "",
  name: "",
  role: "",
  outlet: "",
  status: "Active",
  startDate: "",
  hourlyRate: "",
  monthlySalary: "",
  overtimeRate: "",
  contact: "",
  notes: "",
};

const DEFAULT_ATTENDANCE = {
  date: "",
  employeeId: "",
  outlet: "",
  startTime: "",
  endTime: "",
  totalHours: "",
  overtimeHours: "",
  notes: "",
};

const DEFAULT_ASSESSMENT = {
  employeeId: "",
  reviewDate: "",
  reviewer: "",
  overallRating: "",
  comments: "",
  scores: {},
};

function SectionTabs({ active, onChange }) {
  const tabs = [
    { id: "employees", label: "Employees" },
    { id: "attendance", label: "Attendance & Shifts" },
    { id: "assessments", label: "Assessments" },
    { id: "sops", label: "SOP & Training" },
    { id: "dashboard", label: "HR KPIs" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={active === t.id ? "primary-btn" : "secondary-btn"}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Info({ text }) {
  return <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{text}</div>;
}

function ErrorText({ text }) {
  if (!text) return null;
  return <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{text}</div>;
}

function HrHub() {
  const { outletFilter } = useData();
  const [activeTab, setActiveTab] = useState("employees");

  // Employees
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState("");
  const [empForm, setEmpForm] = useState(DEFAULT_EMPLOYEE);
  const [empEditingId, setEmpEditingId] = useState(null);
  const [empSearch, setEmpSearch] = useState("");

  // Attendance
  const [attendance, setAttendance] = useState([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attError, setAttError] = useState("");
  const [attForm, setAttForm] = useState(() => ({ ...DEFAULT_ATTENDANCE, outlet: outletFilter || "" }));
  const [attFilters, setAttFilters] = useState({
    from: "",
    to: "",
    outlet: outletFilter || "",
    employeeId: "",
  });

  // Assessments
  const [assessments, setAssessments] = useState([]);
  const [assessLoading, setAssessLoading] = useState(false);
  const [assessError, setAssessError] = useState("");
  const [assessForm, setAssessForm] = useState(DEFAULT_ASSESSMENT);

  // SOPs
  const [sops, setSops] = useState([]);
  const [sopAssignments, setSopAssignments] = useState([]);
  const [sopLoading, setSopLoading] = useState(false);
  const [sopError, setSopError] = useState("");
  const [sopForm, setSopForm] = useState({ employeeId: "", sopId: "" });
  const [sopNew, setSopNew] = useState({ title: "", description: "", category: "", effectiveDate: "" });

  // Labor KPI
  const [kpiLoading, setKpiLoading] = useState(false);
  const [laborKpi, setLaborKpi] = useState(null);
  const [kpiError, setKpiError] = useState("");

  // Options
  const outletOptions = useMemo(() => {
    const set = new Set();
    employees.forEach((e) => e.outlet && set.add(e.outlet));
    attendance.forEach((a) => a.outlet && set.add(a.outlet));
    return Array.from(set).sort();
  }, [employees, attendance]);

  const employeeOptions = useMemo(
    () =>
      employees.map((e) => ({
        id: e.id,
        name: `${e.name || "Unnamed"}${e.employeeId ? ` (${e.employeeId})` : ""}`,
      })),
    [employees]
  );

  // API helpers
  async function apiGet(path) {
    const resp = await fetch(`${API_BASE}${path}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }
  async function apiPost(path, body) {
    const resp = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }
  async function apiPut(path, body) {
    const resp = await fetch(`${API_BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  // Employees
  async function loadEmployees() {
    if (!API_BASE) return;
    setEmpLoading(true);
    setEmpError("");
    try {
      const qs = new URLSearchParams();
      if (empSearch) qs.set("q", empSearch);
      const data = await apiGet(`/api/hr/employees?${qs.toString()}`);
      setEmployees(data.records || []);
    } catch (err) {
      setEmpError(err.message || "Failed to load employees");
    } finally {
      setEmpLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empSearch]);

  async function saveEmployee() {
    setEmpError("");
    try {
      if (empEditingId) {
        await apiPut(`/api/hr/employees/${empEditingId}`, empForm);
      } else {
        await apiPost("/api/hr/employees", empForm);
      }
      setEmpForm(DEFAULT_EMPLOYEE);
      setEmpEditingId(null);
      loadEmployees();
    } catch (err) {
      setEmpError(err.message || "Save failed");
    }
  }

  // Attendance
  async function loadAttendance() {
    if (!API_BASE) return;
    setAttLoading(true);
    setAttError("");
    try {
      const qs = new URLSearchParams();
      Object.entries(attFilters).forEach(([k, v]) => {
        if (v) qs.set(k, v);
      });
      const data = await apiGet(`/api/hr/attendance?${qs.toString()}`);
      setAttendance(data.records || []);
    } catch (err) {
      setAttError(err.message || "Failed to load attendance");
    } finally {
      setAttLoading(false);
    }
  }

  useEffect(() => {
    loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attFilters.from, attFilters.to, attFilters.outlet, attFilters.employeeId]);

  async function saveAttendance() {
    setAttError("");
    try {
      await apiPost("/api/hr/attendance", attForm);
      setAttForm({ ...DEFAULT_ATTENDANCE, outlet: attForm.outlet });
      loadAttendance();
    } catch (err) {
      setAttError(err.message || "Save failed");
    }
  }

  // Assessments
  async function loadAssessments(employeeId = "") {
    if (!API_BASE) return;
    setAssessLoading(true);
    setAssessError("");
    try {
      const qs = new URLSearchParams();
      if (employeeId) qs.set("employeeId", employeeId);
      const data = await apiGet(`/api/hr/assessments?${qs.toString()}`);
      setAssessments(data.records || []);
    } catch (err) {
      setAssessError(err.message || "Failed to load assessments");
    } finally {
      setAssessLoading(false);
    }
  }

  useEffect(() => {
    loadAssessments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAssessment() {
    setAssessError("");
    try {
      await apiPost("/api/hr/assessments", assessForm);
      setAssessForm(DEFAULT_ASSESSMENT);
      loadAssessments();
    } catch (err) {
      setAssessError(err.message || "Save failed");
    }
  }

  // SOPs
  async function loadSops() {
    if (!API_BASE) return;
    setSopLoading(true);
    setSopError("");
    try {
      const [sopsResp, assignResp] = await Promise.all([
        apiGet("/api/hr/sops"),
        apiGet("/api/hr/sop-assignments"),
      ]);
      setSops(sopsResp.records || []);
      setSopAssignments(assignResp.records || []);
    } catch (err) {
      setSopError(err.message || "Failed to load SOPs");
    } finally {
      setSopLoading(false);
    }
  }

  useEffect(() => {
    loadSops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createSop() {
    setSopError("");
    if (!sopNew.title || !sopNew.category) {
      setSopError("Title and category are required for SOP.");
      return;
    }
    try {
      setSopLoading(true);
      const resp = await fetch(`${API_BASE}/api/hr/sops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sopNew),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Create SOP failed: ${resp.status} ${text}`);
      }
      setSopNew({ title: "", description: "", category: "", effectiveDate: "" });
      loadSops();
    } catch (err) {
      setSopError(err.message || "Failed to create SOP");
    } finally {
      setSopLoading(false);
    }
  }

  async function assignSop(status = "Assigned") {
    setSopError("");
    try {
      if (!sopForm.employeeId || !sopForm.sopId) {
        setSopError("Select employee and SOP");
        return;
      }
      if (status === "Acknowledged") {
        await apiPost("/api/hr/sops/ack", {
          employeeId: sopForm.employeeId,
          sopId: sopForm.sopId,
        });
      } else {
        await apiPost("/api/hr/sops/assign", {
          employeeId: sopForm.employeeId,
          sopId: sopForm.sopId,
          status,
        });
      }
      loadSops();
    } catch (err) {
      setSopError(err.message || "Failed to update SOP status");
    }
  }

  // Labor KPI
  async function loadLaborKpi() {
    if (!API_BASE) return;
    setKpiLoading(true);
    setKpiError("");
    try {
      const qs = new URLSearchParams();
      if (attFilters.from) qs.set("from", attFilters.from);
      if (attFilters.to) qs.set("to", attFilters.to);
      if (attFilters.outlet) qs.set("outlet", attFilters.outlet);
      const data = await apiGet(`/api/hr/labor-kpi?${qs.toString()}`);
      setLaborKpi(data);
    } catch (err) {
      setKpiError(err.message || "Failed to load labor KPI");
    } finally {
      setKpiLoading(false);
    }
  }

  useEffect(() => {
    loadLaborKpi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attFilters.from, attFilters.to, attFilters.outlet]);

  const renderEmployees = () => (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title">Employee directory</h3>
          <Info text="Search, add, and edit employees. Saved directly to the cloud DB." />
        </div>
        <input
          type="search"
          placeholder="Search name / ID / role"
          value={empSearch}
          onChange={(e) => setEmpSearch(e.target.value)}
          style={{ padding: 8, minWidth: 200 }}
        />
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
          gap: 10,
        }}
      >
        <div className="card" style={{ border: "1px dashed #cbd5e1" }}>
          <h4 className="card-title">{empEditingId ? "Edit employee" : "Add employee"}</h4>
          <div className="form-grid">
            <label>
              Name*
              <input
                value={empForm.name}
                onChange={(e) => setEmpForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label>
              Employee ID
              <input
                value={empForm.employeeId}
                onChange={(e) => setEmpForm((f) => ({ ...f, employeeId: e.target.value }))}
              />
            </label>
            <label>
              Role*
              <input
                value={empForm.role}
                onChange={(e) => setEmpForm((f) => ({ ...f, role: e.target.value }))}
              />
            </label>
            <label>
              Outlet*
              <input
                value={empForm.outlet}
                onChange={(e) => setEmpForm((f) => ({ ...f, outlet: e.target.value }))}
              />
            </label>
            <label>
              Status
              <select
                value={empForm.status}
                onChange={(e) => setEmpForm((f) => ({ ...f, status: e.target.value }))}
              >
                {["Active", "On Leave", "Terminated"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Start date
              <input
                type="date"
                value={empForm.startDate}
                onChange={(e) => setEmpForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </label>
            <label>
              Hourly rate
              <input
                type="number"
                step="0.01"
                value={empForm.hourlyRate}
                onChange={(e) => setEmpForm((f) => ({ ...f, hourlyRate: e.target.value }))}
              />
            </label>
            <label>
              Monthly salary
              <input
                type="number"
                step="0.01"
                value={empForm.monthlySalary}
                onChange={(e) => setEmpForm((f) => ({ ...f, monthlySalary: e.target.value }))}
              />
            </label>
            <label>
              Overtime rate
              <input
                type="number"
                step="0.01"
                value={empForm.overtimeRate}
                onChange={(e) => setEmpForm((f) => ({ ...f, overtimeRate: e.target.value }))}
              />
            </label>
            <label>
              Contact
              <input
                value={empForm.contact}
                onChange={(e) => setEmpForm((f) => ({ ...f, contact: e.target.value }))}
              />
            </label>
            <label>
              Notes
              <textarea
                rows={2}
                value={empForm.notes}
                onChange={(e) => setEmpForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="primary-btn" onClick={saveEmployee} disabled={empLoading}>
              {empEditingId ? "Update" : "Add"} employee
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setEmpForm(DEFAULT_EMPLOYEE);
                setEmpEditingId(null);
              }}
            >
              Clear
            </button>
          </div>
          <ErrorText text={empError} />
        </div>

        <div className="card" style={{ gridColumn: "1 / -1", overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>ID</th>
                <th>Role</th>
                <th>Outlet</th>
                <th>Status</th>
                <th>Start</th>
                <th>Rate</th>
                <th>Salary</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {empLoading ? (
                <tr>
                  <td colSpan={9}>Loading...</td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={9}>No employees yet.</td>
                </tr>
              ) : (
                employees.map((e) => (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td>{e.employeeId}</td>
                    <td>{e.role}</td>
                    <td>{e.outlet}</td>
                    <td>{e.status}</td>
                    <td>{e.startDate}</td>
                    <td>{e.hourlyRate}</td>
                    <td>{e.monthlySalary}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          setEmpForm({
                            employeeId: e.employeeId || "",
                            name: e.name || "",
                            role: e.role || "",
                            outlet: e.outlet || "",
                            status: e.status || "Active",
                            startDate: e.startDate || "",
                            hourlyRate: e.hourlyRate || "",
                            monthlySalary: e.monthlySalary || "",
                            overtimeRate: e.overtimeRate || "",
                            contact: e.contact || "",
                            notes: e.notes || "",
                          });
                          setEmpEditingId(e.id);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAttendance = () => (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title">Attendance & shifts</h3>
          <Info text="Track shifts and overtime. Totals calculated server-side too." />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="date"
            value={attFilters.from}
            onChange={(e) => setAttFilters((f) => ({ ...f, from: e.target.value }))}
          />
          <input
            type="date"
            value={attFilters.to}
            onChange={(e) => setAttFilters((f) => ({ ...f, to: e.target.value }))}
          />
          <select
            value={attFilters.outlet}
            onChange={(e) => setAttFilters((f) => ({ ...f, outlet: e.target.value }))}
          >
            <option value="">All outlets</option>
            {outletOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select
            value={attFilters.employeeId}
            onChange={(e) => setAttFilters((f) => ({ ...f, employeeId: e.target.value }))}
          >
            <option value="">All employees</option>
            {employeeOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button type="button" className="secondary-btn" onClick={loadAttendance}>
            Refresh
          </button>
        </div>
      </div>

      <div className="card" style={{ border: "1px dashed #cbd5e1", marginTop: 12 }}>
        <h4 className="card-title">Add shift</h4>
        <div className="form-grid">
          <label>
            Date*
            <input
              type="date"
              value={attForm.date}
              onChange={(e) => setAttForm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          <label>
            Employee*
            <select
              value={attForm.employeeId}
              onChange={(e) => setAttForm((f) => ({ ...f, employeeId: e.target.value }))}
            >
              <option value="">Select employee</option>
              {employeeOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Outlet
            <input
              value={attForm.outlet}
              onChange={(e) => setAttForm((f) => ({ ...f, outlet: e.target.value }))}
            />
          </label>
          <label>
            Start
            <input
              type="time"
              value={attForm.startTime}
              onChange={(e) => setAttForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </label>
          <label>
            End
            <input
              type="time"
              value={attForm.endTime}
              onChange={(e) => setAttForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </label>
          <label>
            Total hours
            <input
              type="number"
              step="0.1"
              value={attForm.totalHours}
              onChange={(e) => setAttForm((f) => ({ ...f, totalHours: e.target.value }))}
            />
          </label>
          <label>
            Overtime
            <input
              type="number"
              step="0.1"
              value={attForm.overtimeHours}
              onChange={(e) => setAttForm((f) => ({ ...f, overtimeHours: e.target.value }))}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Notes
            <textarea
              rows={2}
              value={attForm.notes}
              onChange={(e) => setAttForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="primary-btn" onClick={saveAttendance} disabled={attLoading}>
            Save shift
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setAttForm({ ...DEFAULT_ATTENDANCE, outlet: attForm.outlet })}
          >
            Clear
          </button>
        </div>
        <ErrorText text={attError} />
      </div>

      <div className="table-wrapper" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Outlet</th>
              <th>Start</th>
              <th>End</th>
              <th>Total h</th>
              <th>OT h</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {attLoading ? (
              <tr>
                <td colSpan={8}>Loading...</td>
              </tr>
            ) : attendance.length === 0 ? (
              <tr>
                <td colSpan={8}>No attendance for current filters.</td>
              </tr>
            ) : (
              attendance.map((a) => (
                <tr key={a.id}>
                  <td>{a.date}</td>
                  <td>{a.employeeName || a.employeeId}</td>
                  <td>{a.outlet}</td>
                  <td>{a.startTime}</td>
                  <td>{a.endTime}</td>
                  <td>{a.totalHours}</td>
                  <td>{a.overtimeHours}</td>
                  <td>{a.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAssessments = () => (
    <div className="card">
      <h3 className="card-title">Performance assessments</h3>
      <Info text="Use the template to record reviews. Ratings are simple 1-5 scales; stored with comments." />
      <div className="card" style={{ border: "1px dashed #cbd5e1", marginTop: 8 }}>
        <h4 className="card-title">New assessment</h4>
        <div className="form-grid">
          <label>
            Employee*
            <select
              value={assessForm.employeeId}
              onChange={(e) => setAssessForm((f) => ({ ...f, employeeId: e.target.value }))}
            >
              <option value="">Select employee</option>
              {employeeOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Review date*
            <input
              type="date"
              value={assessForm.reviewDate}
              onChange={(e) => setAssessForm((f) => ({ ...f, reviewDate: e.target.value }))}
            />
          </label>
          <label>
            Reviewer*
            <input
              value={assessForm.reviewer}
              onChange={(e) => setAssessForm((f) => ({ ...f, reviewer: e.target.value }))}
            />
          </label>
          <label>
            Overall rating
            <input
              type="number"
              min="1"
              max="5"
              step="1"
              value={assessForm.overallRating}
              onChange={(e) => setAssessForm((f) => ({ ...f, overallRating: e.target.value }))}
            />
          </label>
        </div>

        <div className="form-grid" style={{ marginTop: 8 }}>
          {hrAssessmentTemplate.map((section) => (
            <div key={section.id} style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{section.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 8 }}>
                {section.metrics.map((m) => (
                  <label key={m.id}>
                    {m.label}
                    <input
                      type="number"
                      min="1"
                      max={m.scale || 5}
                      step="1"
                      value={assessForm.scores?.[m.id] || ""}
                      onChange={(e) =>
                        setAssessForm((f) => ({
                          ...f,
                          scores: { ...(f.scores || {}), [m.id]: e.target.value },
                        }))
                      }
                    />
                    {m.help && <Info text={m.help} />}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label style={{ display: "block", marginTop: 8 }}>
          Comments
          <textarea
            rows={3}
            value={assessForm.comments}
            onChange={(e) => setAssessForm((f) => ({ ...f, comments: e.target.value }))}
          />
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="primary-btn" onClick={saveAssessment} disabled={assessLoading}>
            Save assessment
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setAssessForm(DEFAULT_ASSESSMENT)}
          >
            Clear
          </button>
        </div>
        <ErrorText text={assessError} />
      </div>

      <div className="table-wrapper" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Reviewer</th>
              <th>Overall</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            {assessLoading ? (
              <tr>
                <td colSpan={5}>Loading...</td>
              </tr>
            ) : assessments.length === 0 ? (
              <tr>
                <td colSpan={5}>No assessments yet.</td>
              </tr>
            ) : (
              assessments.map((a) => (
                <tr key={a.id}>
                  <td>{a.reviewDate}</td>
                  <td>{a.employeeName || a.employeeId}</td>
                  <td>{a.reviewer}</td>
                  <td>{a.overallRating}</td>
                  <td>{a.comments}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSops = () => (
    <div className="card">
      <h3 className="card-title">SOP & Training</h3>
      <Info text="Assign SOPs to employees and capture acknowledgments. Everything stays in-app (no popups)." />

      <div className="card" style={{ border: "1px dashed #cbd5e1", marginBottom: 12 }}>
        <h4 className="card-title">Create new SOP</h4>
        <div className="form-grid">
          <label>
            Title*
            <input
              value={sopNew.title}
              onChange={(e) => setSopNew((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label>
            Category*
            <input
              value={sopNew.category}
              onChange={(e) => setSopNew((f) => ({ ...f, category: e.target.value }))}
            />
          </label>
          <label>
            Effective date
            <input
              type="date"
              value={sopNew.effectiveDate}
              onChange={(e) => setSopNew((f) => ({ ...f, effectiveDate: e.target.value }))}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Description
            <textarea
              rows={2}
              value={sopNew.description}
              onChange={(e) => setSopNew((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="primary-btn" onClick={createSop} disabled={sopLoading}>
            Save SOP
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setSopNew({ title: "", description: "", category: "", effectiveDate: "" })}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="form-grid" style={{ marginTop: 8 }}>
        <label>
          Employee
          <select
            value={sopForm.employeeId}
            onChange={(e) => setSopForm((f) => ({ ...f, employeeId: e.target.value }))}
          >
            <option value="">Select employee</option>
            {employeeOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          SOP
          <select
            value={sopForm.sopId}
            onChange={(e) => setSopForm((f) => ({ ...f, sopId: e.target.value }))}
          >
            <option value="">Select SOP</option>
            {sops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button type="button" className="primary-btn" onClick={() => assignSop("Assigned")} disabled={sopLoading}>
            Assign
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => assignSop("Acknowledged")}
            disabled={sopLoading}
          >
            Mark acknowledged
          </button>
        </div>
      </div>
      <ErrorText text={sopError} />

      <div className="table-wrapper" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>SOP</th>
              <th>Employee</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>Acknowledged</th>
            </tr>
          </thead>
          <tbody>
            {sopLoading ? (
              <tr>
                <td colSpan={5}>Loading...</td>
              </tr>
            ) : sopAssignments.length === 0 ? (
              <tr>
                <td colSpan={5}>No assignments yet.</td>
              </tr>
            ) : (
              sopAssignments.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>{a.employeeId}</td>
                  <td>{a.status}</td>
                  <td>{a.assignedDate}</td>
                  <td>{a.acknowledgedDate || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDashboard = () => {
    const summary = laborKpi?.summary || {};
    return (
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 className="card-title">HR KPIs (labor)</h3>
            <Info text="Labor cost, hours, and labor % of sales. Powered by attendance + employees + sales." />
          </div>
          <button type="button" className="secondary-btn" onClick={loadLaborKpi} disabled={kpiLoading}>
            Refresh
          </button>
        </div>
        {kpiError && <ErrorText text={kpiError} />}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginTop: 10,
          }}
        >
          <div className="card">
            <div className="page-subtitle">Total labor cost</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{summary.totalLaborCost?.toFixed?.(2) || "-"}</div>
          </div>
          <div className="card">
            <div className="page-subtitle">Labor % of sales</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {summary.laborCostPctOfSales ? summary.laborCostPctOfSales.toFixed(1) + "%" : "-"}
            </div>
          </div>
          <div className="card">
            <div className="page-subtitle">Total hours</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{summary.totalHours || "-"}</div>
          </div>
          <div className="card">
            <div className="page-subtitle">Overtime hours</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{summary.totalOvertimeHours || "-"}</div>
          </div>
        </div>

        <div className="table-wrapper" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Outlet</th>
                <th>Labor cost</th>
                <th>Total hours</th>
                <th>OT hours</th>
              </tr>
            </thead>
            <tbody>
              {laborKpi?.byOutlet?.length ? (
                laborKpi.byOutlet.map((o) => (
                  <tr key={o.outlet}>
                    <td>{o.outlet}</td>
                    <td>{Number(o.totalLaborCost || 0).toFixed(2)}</td>
                    <td>{Number(o.totalHours || 0).toFixed(2)}</td>
                    <td>{Number(o.overtimeHours || 0).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No outlet data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-wrapper" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Outlet</th>
                <th>Labor cost</th>
                <th>Total hours</th>
                <th>OT hours</th>
              </tr>
            </thead>
            <tbody>
              {laborKpi?.byEmployee?.length ? (
                laborKpi.byEmployee.map((e) => (
                  <tr key={e.employeeId}>
                    <td>{e.employeeName || e.employeeId}</td>
                    <td>{e.outlet}</td>
                    <td>{Number(e.laborCost || 0).toFixed(2)}</td>
                    <td>{Number(e.totalHours || 0).toFixed(2)}</td>
                    <td>{Number(e.overtimeHours || 0).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No employee data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="page-title">HR & Employees</h2>
      <p className="page-subtitle">
        Cloud-backed HR hub: employees, attendance, labor KPIs, assessments, and SOP acknowledgments. Everything stays
        inside the app (no popups).
      </p>

      <SectionTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "employees" && renderEmployees()}
      {activeTab === "attendance" && renderAttendance()}
      {activeTab === "assessments" && renderAssessments()}
      {activeTab === "sops" && renderSops()}
      {activeTab === "dashboard" && renderDashboard()}
    </div>
  );
}

export default HrHub;

