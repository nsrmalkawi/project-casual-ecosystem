// NEW: Reports & KPI Center
import { useEffect, useMemo, useState } from "react";
import { callAi } from "../../utils/aiClient";
import { marked } from "marked";
import { loadData } from "../../utils/storage";
import { reportsConfig } from "../../config/reportsConfig";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== "undefined" ? window.location.origin : "");

// Icon map (configurable via Admin > Report icons)
const ICON_MAP = {
  bar_chart: "📊",
  line_chart: "📈",
  pie_chart: "🧮",
  labor: "👥",
  waste: "🗑️",
  finance: "💵",
  inventory: "📦",
  custom_star: "⭐",
  custom_fire: "🔥",
};

// Map report ids to exportable tables for quick CSV/XLSX shortcuts
const EXPORT_TABLE_MAP = {
  dailySales: "sales",
  laborCost: "hr_payroll",
  purchases: "purchases",
  wasteVariance: "waste",
  rentOpex: "rent_opex",
  pettyCash: "petty_cash",
  inventory: "inventory_items",
};

function fallbackSummary(summary) {
  if (!summary) return "";
  const entries = Object.entries(summary)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  return entries ? `Summary: ${entries}` : "";
}

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

function SummaryTile({ label, value, color = "#4f46e5", loading }) {
  const num = Number(value);
  return (
    <div
      className="card"
      style={{
        padding: 10,
        borderLeft: `4px solid ${color}`,
        background: "#f8fafc",
      }}
    >
      <div className="page-subtitle" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>
        {loading ? "…" : Number.isFinite(num) ? num.toLocaleString() : value || "-"}
      </div>
    </div>
  );
}

function renderMarkdown(md) {
  if (!md) return "";
  marked.setOptions({ mangle: false, headerIds: false });
  return marked.parse(md);
}

function ReportCard({ report, onOpen }) {
  const icon = ICON_MAP[report.icon] || ICON_MAP[report.iconOverride] || report.icon || "📊";
  return (
    <div
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 140 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-flex",
            width: 28,
            height: 28,
            borderRadius: 6,
            alignItems: "center",
            justifyContent: "center",
            background: "#eef2ff",
            color: "#4338ca",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {icon}
        </span>
        <div>
          <div style={{ fontWeight: 600 }}>{report.title}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{report.category}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#374151", flex: 1 }}>{report.description}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {report.tags?.map((t) => (
          <span
            key={t}
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 999,
              background: "#f3f4f6",
              color: "#4b5563",
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          Filters: {report.requiredFilters?.join(", ") || "None"}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {report.exportTable && (
            <>
              <button
                type="button"
                className="secondary-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/api/export/${report.exportTable}`, "_blank");
                }}
                style={{ padding: "6px 8px", fontSize: 11 }}
              >
                CSV
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/api/export-xlsx/${report.exportTable}`, "_blank");
                }}
                style={{ padding: "6px 8px", fontSize: 11 }}
              >
                XLSX
              </button>
            </>
          )}
          <button
            type="button"
            className="primary-btn"
            onClick={() => onOpen(report)}
            style={{ padding: "6px 10px", fontSize: 12 }}
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportsCenter() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [totals, setTotals] = useState({});
  const [totalsLoading, setTotalsLoading] = useState(false);
  const [totalsError, setTotalsError] = useState("");
  const [health, setHealth] = useState(null);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiStatus, setAiStatus] = useState("idle");
  const [copyStatus, setCopyStatus] = useState("");
  const [iconOverrides] = useState(() => loadData("pc_report_icons_v1", {}) || {});
  const [fullReport, setFullReport] = useState("");
  const [fullReportModel, setFullReportModel] = useState("");
  const [fullStatus, setFullStatus] = useState("idle");
  const [fullError, setFullError] = useState("");

  const categories = useMemo(() => {
    const set = new Set(reportsConfig.map((r) => r.category).filter(Boolean));
    return Array.from(set);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reportsConfig
      .map((r) => ({
        ...r,
        icon: iconOverrides[r.id] || r.icon,
        exportTable: EXPORT_TABLE_MAP[r.id],
      }))
      .filter((r) => {
        const matchesCategory = !category || r.category === category;
        const haystack = `${r.title} ${r.description} ${r.tags?.join(" ")}`.toLowerCase();
        const matchesQuery = !q || haystack.includes(q);
        return matchesCategory && matchesQuery;
      });
  }, [query, category, iconOverrides]);

  // NEW: totals cards (cloud summaries)
  useEffect(() => {
    if (!API_BASE) return;
    const load = async () => {
      setTotalsLoading(true);
      setTotalsError("");
      try {
        const endpoints = [
          { key: "sales", path: "/api/reports/sales-summary" },
          { key: "purchases", path: "/api/reports/purchases-summary" },
          { key: "waste", path: "/api/reports/waste-summary" },
          { key: "hr", path: "/api/reports/hr-summary" },
          { key: "rent", path: "/api/reports/rent-opex-summary" },
          { key: "petty", path: "/api/reports/petty-cash-summary" },
          { key: "inventory", path: "/api/reports/inventory-summary" },
        ];
        const result = {};
        for (const ep of endpoints) {
          try {
            const data = await fetchJson(`${API_BASE}${ep.path}`);
            result[ep.key] = data?.summary || {};
          } catch (e) {
            result[ep.key] = { error: e.message };
          }
        }
        setTotals(result);
      } catch (e) {
        setTotalsError(e.message || "Failed to load summaries");
      } finally {
        setTotalsLoading(false);
      }
    };
    load();
  }, []);

  // NEW: health/debug info for AI and API
  useEffect(() => {
    if (!API_BASE) return;
    const loadHealth = async () => {
      try {
        const data = await fetchJson(`${API_BASE}/api/health`);
        setHealth(data);
      } catch (e) {
        setHealth({ error: e.message });
      }
    };
    loadHealth();
  }, []);

  const handleOpen = async (report) => {
    setSelected(report);
    setPreview(null);
    setAiSummary("");
    setAiModel("");
    setError("");
    setAiStatus("idle");

    if (!API_BASE || !report.route) return;
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}${report.route}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setPreview(data);

      try {
        setAiStatus("loading");
        const aiRes = await callAi({
          mode: "report",
          payload: { reportId: report.id, data },
          question:
            `Return structured markdown:\n- Title: "${report.title}"\n- Sections: ## Snapshot (key KPIs with numbers), ## Table (one markdown table with at least 3 KPIs | Value | Comment), ## Risks (bullets), ## Recommended Actions (3-5 bullets).\n- Keep concise and F&B focused.`,
        });
        setAiSummary(aiRes.text || "");
        setAiModel(aiRes.model || "");
        setAiStatus("done");
      } catch (aiErr) {
        console.warn("AI summary failed", aiErr);
        setAiStatus("error");
      }
    } catch (err) {
      console.error("Report preview error", err);
      setError(err.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  };

  const handleFullReport = async () => {
    if (!API_BASE) return;
    setFullStatus("loading");
    setFullError("");
    setFullReport("");
    setFullReportModel("");
    try {
      const endpoints = [
        { id: "sales", path: "/api/reports/sales-summary" },
        { id: "purchases", path: "/api/reports/purchases-summary" },
        { id: "waste", path: "/api/reports/waste-summary" },
        { id: "hr", path: "/api/reports/hr-summary" },
        { id: "rent", path: "/api/reports/rent-opex-summary" },
        { id: "petty", path: "/api/reports/petty-cash-summary" },
        { id: "inventory", path: "/api/reports/inventory-summary" },
      ];

      const results = {};
      for (const ep of endpoints) {
        try {
          results[ep.id] = await fetchJson(`${API_BASE}${ep.path}`);
        } catch (err) {
          results[ep.id] = { error: err.message };
        }
      }

      const aiRes = await callAi({
        mode: "report",
        payload: { scope: "full-system", summaries: results },
        question:
          "Create structured markdown with sections: ## Executive Summary, ## Sales, ## Labor, ## COGS/Purchases, ## Waste, ## Opex/Petty, ## Inventory, ## Risks, ## Actions (5 bullets). Include at least two markdown tables (e.g., Sales vs Labor; Waste vs Purchases) with columns KPI | Value | Comment. Show key numbers with currency/%, concise and actionable.",
      });

      setFullReport(aiRes.text || "");
      setFullReportModel(aiRes.model || "");
      setFullStatus("done");
    } catch (err) {
      setFullError(err.message || "Failed to generate full report");
      setFullStatus("error");
    }
  };

  return (
    <div>
      <h2 className="page-title">Reports & KPI Center</h2>
      <p className="page-subtitle">
        Quick navigation to reporting and KPI endpoints. Use filters to find the report you need.
      </p>

      {/* NEW: summary cards from cloud */}
      <div
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        {health && (
          <div className="card" style={{ gridColumn: "1 / -1", padding: 10, borderLeft: "4px solid #0ea5e9" }}>
            <div className="page-subtitle">API health</div>
            <div style={{ fontSize: 13, color: "#0f172a" }}>
              Model: {health.model || "-"} | hasApiKey: {health.hasApiKey ? "yes" : "no"} | env: {health.env || "-"}
              {health.error && <span style={{ color: "#b91c1c" }}> {health.error}</span>}
            </div>
          </div>
        )}
        {totalsError ? (
          <div style={{ color: "#b91c1c" }}>{totalsError}</div>
        ) : (
          <>
            <SummaryTile label="Net sales" value={totals.sales?.netsales || totals.sales?.netSales} color="#4f46e5" loading={totalsLoading} />
            <SummaryTile label="EBITDA" value={totals.sales?.ebitda || totals.sales?.ebitdaValue} color="#16a34a" loading={totalsLoading} />
            <SummaryTile label="Purchases" value={totals.purchases?.totalcost || totals.purchases?.totalCost} color="#f97316" loading={totalsLoading} />
            <SummaryTile label="Waste cost" value={totals.waste?.totalcost || totals.waste?.totalCost} color="#dc2626" loading={totalsLoading} />
            <SummaryTile label="Labor cost" value={totals.hr?.laborcost || totals.hr?.laborCost} color="#0ea5e9" loading={totalsLoading} />
            <SummaryTile label="Rent / Opex" value={totals.rent?.amount} color="#10b981" loading={totalsLoading} />
            <SummaryTile label="Petty cash" value={totals.petty?.amount} color="#8b5cf6" loading={totalsLoading} />
            <SummaryTile label="Inventory items" value={totals.inventory?.itemcount || totals.inventory?.itemCount} color="#9333ea" loading={totalsLoading} />
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <input
          type="search"
          placeholder="Search reports..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            minWidth: 220,
          }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            minWidth: 180,
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary-btn"
          onClick={handleFullReport}
          disabled={fullStatus === "loading"}
        >
          {fullStatus === "loading" ? "Generating full AI report..." : "Full system AI report"}
        </button>
      </div>

      {fullStatus !== "idle" && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 className="card-title">Full system AI report</h3>
              <div className="page-subtitle">
                Executive summary, risks, and recommended actions across sales, labor, COGS, waste, opex, petty, and inventory.
              </div>
            </div>
            <button type="button" className="secondary-btn" onClick={() => setFullStatus("idle")}>
              Hide
            </button>
          </div>
          {fullError && <div style={{ color: "#b91c1c", marginTop: 6 }}>{fullError}</div>}
          {fullStatus === "loading" && <div style={{ marginTop: 6 }}>Generating...</div>}
          {fullReport && (
            <div
              style={{
                marginTop: 8,
                background: "#f8fafc",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 13,
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(fullReport) }}
            />
          )}
          {fullReportModel && fullReport && (
            <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>Model: {fullReportModel}</div>
          )}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {filtered.map((r) => (
          <ReportCard key={r.id} report={r} onOpen={handleOpen} />
        ))}
        {filtered.length === 0 && (
          <div className="card">
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
              No reports match your filters.
            </p>
          </div>
        )}
      </div>

      {selected && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <h3 className="card-title" style={{ marginBottom: 2 }}>
                {selected.title} — inline preview
              </h3>
              <div className="page-subtitle" style={{ margin: 0 }}>
                {selected.description}
              </div>
            </div>
            <button type="button" className="secondary-btn" onClick={() => setSelected(null)}>
              Close preview
            </button>
          </div>

          {loading && <div style={{ marginTop: 8 }}>Loading...</div>}
          {error && <div style={{ color: "#b91c1c", marginTop: 8 }}>{error}</div>}

          {!loading && !error && preview && (
            <>
              {preview.summary && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  {Object.entries(preview.summary).map(([k, v]) => {
                    const num = Number(v);
                    return (
                      <div key={k} className="card">
                        <div className="page-subtitle" style={{ textTransform: "capitalize" }}>
                          {k}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>
                          {Number.isFinite(num) ? num.toLocaleString() : v}
                        </div>
                        {Number.isFinite(num) && (
                          <div
                            style={{
                              marginTop: 6,
                              height: 6,
                              borderRadius: 999,
                              background: "#e5e7eb",
                              position: "relative",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${Math.min(100, Math.abs(num))}%`,
                                background: "#4f46e5",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                <div className="card" style={{ background: "#fdf2f8" }}>
                  <div className="page-subtitle">AI summary & recommendations</div>
                  {aiSummary && (
                    <button
                      type="button"
                      className="secondary-btn"
                      style={{ marginBottom: 6, padding: "4px 8px", fontSize: 11 }}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(aiSummary);
                          setCopyStatus("Copied");
                          setTimeout(() => setCopyStatus(""), 1500);
                        } catch (e) {
                          setCopyStatus("Copy failed");
                        }
                      }}
                    >
                      Copy AI summary {copyStatus && `(${copyStatus})`}
                    </button>
                  )}
                  {aiSummary ? (
                    <div
                      style={{ fontSize: 13 }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(aiSummary) }}
                    />
                  ) : (
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {aiStatus === "loading" ? "Summarizing..." : fallbackSummary(preview.summary) || "No AI summary yet."}
                    </div>
                  )}
                  {aiModel && <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>Model: {aiModel}</div>}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
