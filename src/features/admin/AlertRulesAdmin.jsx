// src/features/admin/AlertRulesAdmin.jsx
import { useEffect, useState } from "react";

const DEFAULT_RULES = [
  {
    id: "food-cost",
    label: "Food cost % > threshold",
    description:
      "Triggers when total food cost (purchases / sales) is higher than your set limit.",
    type: "foodCostPct",
    threshold: 40,
    windowMonths: null,
    enabled: true,
  },
  {
    id: "labor-cost",
    label: "Labor % > threshold",
    description:
      "Triggers when total labor cost (HR / sales) is higher than your set limit.",
    type: "laborPct",
    threshold: 30,
    windowMonths: null,
    enabled: true,
  },
  {
    id: "ebitda-2m",
    label: "Outlet EBITDA < 0 for N consecutive months",
    description:
      "Triggers when any outlet has negative EBITDA for N consecutive months.",
    type: "ebitdaNegativeMonths",
    threshold: 0,
    windowMonths: 2,
    enabled: true,
  },
];

function loadAlertRules() {
  if (typeof window === "undefined") return DEFAULT_RULES;
  try {
    const raw = window.localStorage.getItem("pc_alert_rules");
    if (!raw) return DEFAULT_RULES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_RULES;
    return parsed.map((r) => ({
      ...r,
      enabled: r.enabled ?? true,
    }));
  } catch (e) {
    console.error("Failed to load pc_alert_rules", e);
    return DEFAULT_RULES;
  }
}

function AlertRulesAdmin() {
  const [rules, setRules] = useState(() => loadAlertRules());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("pc_alert_rules", JSON.stringify(rules));
    } catch (e) {
      console.error("Failed to save pc_alert_rules", e);
    }
  }, [rules]);

  const updateRule = (id, field, value) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const resetToDefaults = () => {
    setRules(DEFAULT_RULES);
  };

  return (
    <div className="card">
      <h3 className="card-title">Alerts &amp; Thresholds</h3>
      <p className="page-subtitle" style={{ marginBottom: 12 }}>
        Configure simple rules that automatically flag issues in the Reports
        tab. This keeps the interface clean and surfaces only what needs
        attention.
      </p>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: 80 }}>Active</th>
              <th>Rule</th>
              <th>Threshold</th>
              <th>Window / Months</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!rule.enabled}
                      onChange={(e) =>
                        updateRule(rule.id, "enabled", e.target.checked)
                      }
                    />
                    <span>On</span>
                  </label>
                </td>
                <td style={{ fontWeight: 500 }}>{rule.label}</td>
                <td>
                  {rule.type === "foodCostPct" || rule.type === "laborPct" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        step="0.1"
                        value={rule.threshold ?? ""}
                        onChange={(e) =>
                          updateRule(
                            rule.id,
                            "threshold",
                            e.target.value === ""
                              ? ""
                              : Number(e.target.value)
                          )
                        }
                        style={{
                          width: 80,
                          padding: "4px 6px",
                          borderRadius: 4,
                          border: "1px solid #d1d5db",
                          fontSize: 13,
                        }}
                      />
                      <span style={{ fontSize: 12 }}>%</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "#6b7280" }}>N/A</span>
                  )}
                </td>
                <td>
                  {rule.type === "ebitdaNegativeMonths" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={rule.windowMonths ?? ""}
                        onChange={(e) =>
                          updateRule(
                            rule.id,
                            "windowMonths",
                            e.target.value === ""
                              ? ""
                              : Number(e.target.value)
                          )
                        }
                        style={{
                          width: 80,
                          padding: "4px 6px",
                          borderRadius: 4,
                          border: "1px solid #d1d5db",
                          fontSize: 13,
                        }}
                      />
                      <span style={{ fontSize: 12 }}>months</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "#6b7280" }}>—</span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: "#4b5563" }}>
                  {rule.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <button
          type="button"
          className="secondary-btn"
          onClick={resetToDefaults}
        >
          Reset to recommended rules
        </button>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          Alerts will appear in a compact box at the top of the{" "}
          <strong>Reports &amp; Dashboard</strong> tab.
        </span>
      </div>
    </div>
  );
}

export default AlertRulesAdmin;
