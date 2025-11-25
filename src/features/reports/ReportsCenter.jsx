// NEW: Reports & KPI Center
import { useMemo, useState } from "react";
import { callAi } from "../../utils/aiClient";
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          Filters: {report.requiredFilters?.join(", ") || "None"}
        </div>
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
  );
}

export default function ReportsCenter() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiStatus, setAiStatus] = useState("idle");
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
      .map((r) => ({ ...r, icon: iconOverrides[r.id] || r.icon }))
      .filter((r) => {
        const matchesCategory = !category || r.category === category;
        const haystack = `${r.title} ${r.description} ${r.tags?.join(" ")}`.toLowerCase();
        const matchesQuery = !q || haystack.includes(q);
        return matchesCategory && matchesQuery;
      });
  }, [query, category, iconOverrides]);

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
            "Provide a concise summary (key numbers) and 3-5 recommendations tailored to F&B ops. Format with bullets.",
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
          "Create a well-rounded F&B performance report with sections: Executive Summary, Sales, Labor, COGS/Purchases, Waste, Opex/Petty, Inventory, Risks, and 5 concrete Recommended Actions. Include key numbers (JOD) and percentages where available. Keep it concise and actionable.",
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
                whiteSpace: "pre-wrap",
                background: "#f8fafc",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 13,
              }}
            >
              {fullReport}
              {fullReportModel && (
                <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>Model: {fullReportModel}</div>
              )}
            </div>
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
                <div className="card" style={{ background: "#f8fafc" }}>
                  <div className="page-subtitle">Raw response (truncated)</div>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 260, overflow: "auto" }}>
{JSON.stringify(preview, null, 2).slice(0, 5000)}
{preview && JSON.stringify(preview, null, 2).length > 5000 ? "\n...truncated..." : ""}
                  </pre>
                </div>

                <div className="card" style={{ background: "#fdf2f8" }}>
                  <div className="page-subtitle">AI summary & recommendations</div>
                  {aiSummary ? (
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{aiSummary}</div>
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
