// NEW: Reports & KPI Center
import { useMemo, useState } from "react";
import { reportsConfig } from "../../config/reportsConfig";

function ReportCard({ report, onOpen }) {
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
          {report.icon || "📊"}
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

  const categories = useMemo(() => {
    const set = new Set(reportsConfig.map((r) => r.category).filter(Boolean));
    return Array.from(set);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reportsConfig.filter((r) => {
      const matchesCategory = !category || r.category === category;
      const haystack = `${r.title} ${r.description} ${r.tags?.join(" ")}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  const handleOpen = (report) => {
    // If route matches a known app tab, navigate; otherwise open the route directly
    if (report.route?.startsWith("#tab:")) {
      const tabId = report.route.replace("#tab:", "");
      window.dispatchEvent(new CustomEvent("pc:navigate", { detail: tabId }));
      return;
    }
    if (report.route) {
      window.open(report.route, "_blank");
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
      </div>

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
    </div>
  );
}
