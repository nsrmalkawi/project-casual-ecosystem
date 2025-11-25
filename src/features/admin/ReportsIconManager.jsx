// NEW: Manage report icons/visuals used in the Reports Center
import { useEffect, useState } from "react";
import { loadData, saveData } from "../../utils/storage";
import { reportsConfig } from "../../config/reportsConfig";

const STORAGE_KEY = "pc_report_icons_v1";

const AVAILABLE_ICONS = [
  { id: "bar_chart", label: "Bar chart", glyph: "📊" },
  { id: "line_chart", label: "Line chart", glyph: "📈" },
  { id: "pie_chart", label: "Pie chart", glyph: "🧮" },
  { id: "labor", label: "Labor", glyph: "👥" },
  { id: "waste", label: "Waste", glyph: "🗑️" },
  { id: "finance", label: "Finance", glyph: "💵" },
  { id: "inventory", label: "Inventory", glyph: "📦" },
  { id: "custom_star", label: "Star", glyph: "⭐" },
  { id: "custom_fire", label: "Fire", glyph: "🔥" },
];

export default function ReportsIconManager() {
  const [icons, setIcons] = useState({});

  useEffect(() => {
    const stored = loadData(STORAGE_KEY, {}) || {};
    setIcons(stored);
  }, []);

  const handleChange = (reportId, iconId) => {
    const next = { ...icons, [reportId]: iconId };
    setIcons(next);
    saveData(STORAGE_KEY, next);
  };

  return (
    <div className="card">
      <h3 className="card-title">Report icons & visuals</h3>
      <p className="page-subtitle">
        Pick an icon per report. Changes are stored locally and reflected in the Reports & KPI Center.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        {reportsConfig.map((r) => (
          <div key={r.id} className="card" style={{ border: "1px dashed #cbd5e1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{r.category}</div>
              </div>
              <span style={{ fontSize: 22 }}>{AVAILABLE_ICONS.find((i) => i.id === (icons[r.id] || r.icon))?.glyph || "📊"}</span>
            </div>
            <select
              value={icons[r.id] || r.icon || "bar_chart"}
              onChange={(e) => handleChange(r.id, e.target.value)}
              style={{ marginTop: 8, width: "100%" }}
            >
              {AVAILABLE_ICONS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.glyph} {i.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
