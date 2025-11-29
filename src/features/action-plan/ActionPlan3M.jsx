// src/features/action-plan/ActionPlan3M.jsx
import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const API_BASE =
  import.meta.env.VITE_API_BASE || (typeof window !== "undefined" ? window.location.origin : "");
const apiUrl = (path) =>
  API_BASE ? `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1") : path;

const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed", "Blocked"];
const PRIORITY_OPTIONS = ["P1", "P2", "P3", "High", "Medium", "Low"];

const EXPECTED_HEADERS = [
  "Phase",
  "Area",
  "Action",
  "Description",
  "KPI Metric",
  "KPI Target by Month 3",
  "Start Month",
  "Start Week",
  "End Month",
  "End Week",
  "Impact (H/M/L)",
  "Effort / Complexity (H/M/L)",
  "Dependencies",
  "Budget / Cost Estimate",
  "Risk / Blockers",
  "Validation Method",
  "Owner",
  "Priority",
  "Status",
  "Comments",
];

function makeKey(row) {
  return [
    row.phase || "",
    row.area || "",
    row.action || "",
    row.owner || "",
    row.startMonth || "",
    row.startWeek || "",
  ]
    .map((v) => String(v).toLowerCase())
    .join("|");
}

function parseWeek(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function weekIndex(row) {
  const month = Number(row.startMonth) || 0;
  const week = Number(row.startWeek) || 0;
  return (month - 1) * 4 + week;
}

async function parseExcelFile(file) {
  const wb = new ExcelJS.Workbook();
  const buf = await file.arrayBuffer();
  await wb.xlsx.load(buf);
  const sheet = wb.getWorksheet("Sheet1");
  if (!sheet) throw new Error("Sheet1 not found");

  const headerRow = sheet.getRow(2);
  const headerMap = {};
  headerRow.eachCell((cell, col) => {
    const key = String(cell.value || "").trim();
    if (key) headerMap[key] = col;
  });
  const missing = EXPECTED_HEADERS.filter((h) => !headerMap[h]);
  if (missing.length) {
    throw new Error(`Missing columns: ${missing.join(", ")}`);
  }

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;
    const get = (header) => {
      const col = headerMap[header];
      if (!col) return "";
      const val = row.getCell(col).value;
      if (val && typeof val === "object" && val.text) return val.text;
      if (val && typeof val === "object" && val.result !== undefined) return val.result;
      return val ?? "";
    };
    const mapped = {
      phase: String(get("Phase") || ""),
      area: String(get("Area") || ""),
      action: String(get("Action") || ""),
      description: String(get("Description") || ""),
      kpiMetric: String(get("KPI Metric") || ""),
      kpiTargetM3: String(get("KPI Target by Month 3") || ""),
      startMonth: String(get("Start Month") || ""),
      startWeek: String(get("Start Week") || ""),
      endMonth: String(get("End Month") || ""),
      endWeek: String(get("End Week") || ""),
      impact: String(get("Impact (H/M/L)") || ""),
      effort: String(get("Effort / Complexity (H/M/L)") || ""),
      dependencies: String(get("Dependencies") || ""),
      budgetEstimate: String(get("Budget / Cost Estimate") || ""),
      riskBlockers: String(get("Risk / Blockers") || ""),
      validationMethod: String(get("Validation Method") || ""),
      owner: String(get("Owner") || ""),
      priority: String(get("Priority") || ""),
      status: String(get("Status") || ""),
      comments: String(get("Comments") || ""),
      _row: rowNumber,
    };
    rows.push(mapped);
  });
  return rows;
}

function SummaryCards({ rows }) {
  const total = rows.length;
  const completed = rows.filter((r) => r.status.toLowerCase().startsWith("completed")).length;
  const inProgress = rows.filter((r) => r.status.toLowerCase().startsWith("in progress")).length;
  const blocked = rows.filter((r) => r.status.toLowerCase().startsWith("blocked")).length;
  const onTrack = completed + inProgress;
  return (
    <div className="cards-grid">
      <div className="card">
        <div className="card-title">Total Actions</div>
        <div className="stat-value">{total}</div>
      </div>
      <div className="card">
        <div className="card-title">Completed</div>
        <div className="stat-value">{completed}</div>
      </div>
      <div className="card">
        <div className="card-title">In Progress</div>
        <div className="stat-value">{inProgress}</div>
      </div>
      <div className="card">
        <div className="card-title">Blocked</div>
        <div className="stat-value">{blocked}</div>
      </div>
      <div className="card">
        <div className="card-title">On Track vs Delayed</div>
        <div className="stat-value">
          {onTrack}/{total - onTrack}
        </div>
      </div>
    </div>
  );
}

function TimelineChart({ rows }) {
  const data = rows.map((r) => {
    const start = weekIndex(r);
    const end = (Number(r.endMonth || r.startMonth || 1) - 1) * 4 + Number(r.endWeek || r.startWeek || 1);
    const len = Math.max(1, end - start + 1);
    return {
      phase: r.phase || "Phase",
      name: r.action.slice(0, 24),
      start,
      length: len,
      status: r.status || "Not Started",
    };
  });
  return (
    <div className="card">
      <div className="card-title">3-Month Timeline</div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer>
          <ComposedChart
            layout="vertical"
            data={data}
            margin={{ top: 10, left: 20, right: 20, bottom: 10 }}
          >
            <XAxis type="number" domain={[0, 12]} tickFormatter={(v) => `W${v}`} />
            <YAxis type="category" dataKey="name" width={120} />
            <Tooltip />
            <Legend />
            <Bar dataKey="length" barSize={12} stackId="a" fill="#38bdf8" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Heatmap({ rows }) {
  const areas = Array.from(new Set(rows.map((r) => r.area).filter(Boolean)));
  const statuses = STATUS_OPTIONS;
  const counts = {};
  rows.forEach((r) => {
    const key = `${r.area}__${r.status}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  return (
    <div className="card">
      <div className="card-title">Status by Area</div>
      <div className="table-wrapper" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Area</th>
              {statuses.map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a}>
                <td style={{ fontWeight: 600 }}>{a}</td>
                {statuses.map((s) => (
                  <td key={s}>{counts[`${a}__${s}`] || 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Filters({ filters, setFilters, phases, areas, owners }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-title">Filters</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div>
          <label>Phase</label>
          <select
            value={filters.phase}
            onChange={(e) => setFilters((f) => ({ ...f, phase: e.target.value }))}
          >
            <option value="">All</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Area</label>
          <select
            value={filters.area}
            onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))}
          >
            <option value="">All</option>
            {areas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Owner</label>
          <select
            value={filters.owner}
            onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
          >
            <option value="">All</option>
            {owners.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Priority</label>
          <select
            value={filters.priority}
            onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          >
            <option value="">All</option>
            {PRIORITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function ActionTable({ rows, onInlineUpdate }) {
  return (
    <div className="card">
      <div className="card-title">Action Plan (3M)</div>
      <div className="table-wrapper" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Area</th>
              <th>Action</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Start</th>
              <th>End</th>
              <th>Impact</th>
              <th>Effort</th>
              <th>KPI Metric</th>
              <th>KPI Target M3</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id || makeKey(r)}>
                <td style={{ whiteSpace: "normal" }}>{r.phase}</td>
                <td style={{ whiteSpace: "normal" }}>{r.area}</td>
                <td style={{ whiteSpace: "normal" }}>
                  <div style={{ fontWeight: 600 }}>{r.action}</div>
                  {r.description && <div className="hint-text">Desc: {r.description}</div>}
                  {r.dependencies && <div className="hint-text">Deps: {r.dependencies}</div>}
                  {r.riskBlockers && <div className="hint-text">Risk: {r.riskBlockers}</div>}
                </td>
                <td>
                  <input
                    type="text"
                    value={r.owner || ""}
                    title={r.owner || ""}
                    onChange={(e) => onInlineUpdate(r, { owner: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={r.status || ""}
                    title={r.status || ""}
                    onChange={(e) => onInlineUpdate(r, { status: e.target.value })}
                  >
                    <option value="">Select</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={r.priority || ""}
                    title={r.priority || ""}
                    onChange={(e) => onInlineUpdate(r, { priority: e.target.value })}
                  >
                    <option value="">Select</option>
                    {PRIORITY_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ whiteSpace: "normal" }}>{`${r.startMonth || ""} / ${r.startWeek || ""}`}</td>
                <td style={{ whiteSpace: "normal" }}>{`${r.endMonth || ""} / ${r.endWeek || ""}`}</td>
                <td style={{ whiteSpace: "normal" }}>{r.impact}</td>
                <td style={{ whiteSpace: "normal" }}>{r.effort}</td>
                <td style={{ whiteSpace: "normal" }}>{r.kpiMetric}</td>
                <td style={{ whiteSpace: "normal" }}>{r.kpiTargetM3}</td>
                <td>
                  <input
                    type="text"
                    value={r.comments || ""}
                    title={r.comments || ""}
                    onChange={(e) => onInlineUpdate(r, { comments: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AIRender({ rows }) {
  const total = rows.length;
  const byStatus = rows.reduce((acc, r) => {
    const k = r.status || "Unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const byOwner = rows.reduce((acc, r) => {
    const k = r.owner || "Unassigned";
    acc[k] = acc[k] || { owner: k, total: 0, blocked: 0, inProgress: 0 };
    acc[k].total += 1;
    if ((r.status || "").toLowerCase().includes("blocked")) acc[k].blocked += 1;
    if ((r.status || "").toLowerCase().includes("progress")) acc[k].inProgress += 1;
    return acc;
  }, {});

  const risks = rows.filter((r) => (r.status || "").toLowerCase().includes("blocked"));

  const text = `
<h4>Executive Summary</h4>
<ul>
  <li>Total actions: ${total}</li>
  <li>Completion rate: ${((byStatus["Completed"] || 0) / (total || 1) * 100).toFixed(0)}%</li>
  <li>Blocked: ${byStatus["Blocked"] || 0}</li>
</ul>
<h4>Progress by Phase</h4>
${Array.from(new Set(rows.map((r) => r.phase))).map(
    (p) =>
      `<div><strong>${p || "Phase"}</strong>: ${
        rows.filter((r) => r.phase === p && (r.status || "").toLowerCase().includes("completed")).length
      } completed / ${rows.filter((r) => r.phase === p).length} total</div>`
  ).join("")}
<h4>Risks & Blockers</h4>
${risks
    .map(
      (r) =>
        `<div><strong>${r.action}</strong> (${r.owner || "Unassigned"}) - ${r.riskBlockers || "Risk not provided"}</div>`
    )
    .join("") || "<div>None reported.</div>"}
<h4>Owner Summary</h4>
${Object.values(byOwner)
    .map((o) => `<div>${o.owner}: ${o.total} actions (In progress: ${o.inProgress}, Blocked: ${o.blocked})</div>`)
    .join("")}
<h4>Recommendations</h4>
<ul>
  <li>Escalate high-impact blocked items.</li>
  <li>Rebalance workload from overloaded owners to lighter ones.</li>
  <li>Validate KPIs for actions ending this month.</li>
</ul>
  `;

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(text.replace(/<[^>]+>/g, ""));
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">AI Summary &amp; Report</div>
          <div className="hint-text">Structured narrative based on current 3M action plan.</div>
        </div>
        <button type="button" className="secondary-btn" onClick={copyReport}>
          Copy Report
        </button>
      </div>
      <div
        style={{ padding: 12, background: "#f8fafc", borderRadius: 8 }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
}

function ImportPanel({ onImported }) {
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const PREVIEW_LIMIT = 200;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    try {
      const rows = await parseExcelFile(file);
      setPreviewRows(rows.slice(0, PREVIEW_LIMIT));
    } catch (err) {
      setError(err.message);
      setPreviewRows([]);
    }
  };

  const upload = async (previewOnly = false) => {
    const fileInput = document.getElementById("action-plan-file");
    const file = fileInput?.files?.[0];
    if (!file) {
      setError("Choose an .xlsx file first.");
      return;
    }
    if (previewOnly) setPreviewLoading(true);
    else setLoading(true);
    setError("");
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const resp = await fetch(apiUrl("/api/action-plan/import-excel"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, fileName, previewOnly }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.message || "Import failed");
      }
      setSummary(data);
      if (!previewOnly) {
        onImported?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPreviewLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Import 3M Plan</div>
          <div className="hint-text">Select the Excel file and preview before saving.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="secondary-btn" onClick={() => upload(true)} disabled={previewLoading || loading}>
            {previewLoading ? "Previewing..." : "Preview"}
          </button>
          <button type="button" className="primary-btn" onClick={() => upload(false)} disabled={loading}>
            {loading ? "Importing..." : "Import Excel"}
          </button>
        </div>
      </div>
      <input id="action-plan-file" type="file" accept=".xlsx" onChange={handleFile} />
      {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}
      {summary && (
        <div className="hint-text" style={{ marginTop: 8 }}>
          Inserted {summary.insertedCount} | Updated {summary.updatedCount} | Skipped {summary.skippedCount}
        </div>
      )}
      {summary?.errors?.length > 0 && (
        <div className="card" style={{ marginTop: 8, background: "#fff7ed" }}>
          <div className="card-title">Import issues</div>
          <div className="table-wrapper" style={{ maxHeight: 180, overflow: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {summary.errors.map((e, idx) => (
                  <tr key={`${e.row}-${idx}`}>
                    <td>{e.row}</td>
                    <td>{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {previewRows.length > 0 && (
        <div className="table-wrapper" style={{ marginTop: 8, maxHeight: 240, overflow: "auto" }}>
          <div className="hint-text" style={{ marginBottom: 4 }}>
            Showing first {previewRows.length} rows (limit {PREVIEW_LIMIT}). All columns are visible below.
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Phase</th>
                <th>Area</th>
                <th>Action</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Start</th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r) => (
                <tr key={makeKey(r)}>
                  <td style={{ whiteSpace: "normal" }}>{r.phase}</td>
                  <td style={{ whiteSpace: "normal" }}>{r.area}</td>
                  <td style={{ whiteSpace: "normal" }}>{r.action}</td>
                  <td style={{ whiteSpace: "normal" }}>{r.owner}</td>
                  <td style={{ whiteSpace: "normal" }}>{r.status}</td>
                  <td style={{ whiteSpace: "normal" }}>{r.priority}</td>
                  <td style={{ whiteSpace: "normal" }}>
                    {r.startMonth}/{r.startWeek}
                  </td>
                  <td style={{ whiteSpace: "normal" }}>
                    {r.endMonth}/{r.endWeek}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ActionPlan3M() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    phase: "",
    area: "",
    owner: "",
    status: "",
    priority: "",
  });

  const loadRows = async () => {
    try {
      const resp = await fetch(apiUrl("/api/action-plan"));
      if (!resp.ok) throw new Error("Load failed");
      const data = await resp.json();
      setRows(data.rows || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filters.phase && r.phase !== filters.phase) return false;
      if (filters.area && r.area !== filters.area) return false;
      if (filters.owner && r.owner !== filters.owner) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.priority && r.priority !== filters.priority) return false;
      return true;
    });
  }, [rows, filters]);

  const onInlineUpdate = async (row, partial) => {
    const updated = { ...row, ...partial };
    setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    try {
      await fetch(apiUrl(`/api/action-plan/${row.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error("Inline update failed", err);
    }
  };

  const phases = Array.from(new Set(rows.map((r) => r.phase).filter(Boolean)));
  const areas = Array.from(new Set(rows.map((r) => r.area).filter(Boolean)));
  const owners = Array.from(new Set(rows.map((r) => r.owner).filter(Boolean)));

  return (
    <div className="page">
      <h2 style={{ marginBottom: 6 }}>Action Plan (3M)</h2>
      <p className="page-subtitle">3-month action tracker for Project Casual with imports, dashboard, and AI summary.</p>

      <SummaryCards rows={filtered} />

      <Filters filters={filters} setFilters={setFilters} phases={phases} areas={areas} owners={owners} />

      <ActionTable rows={filtered} onInlineUpdate={onInlineUpdate} />

      <div className="cards-grid">
        <TimelineChart rows={filtered} />
        <Heatmap rows={filtered} />
      </div>

      <AIRender rows={filtered} />

      <ImportPanel onImported={loadRows} />
    </div>
  );
}
