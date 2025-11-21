// src/features/admin/AdminHub.jsx
import { useEffect, useState } from "react";
import { loadData } from "../../utils/storage";
import DataImportExport from "./DataImportExport";

const DEFAULT_ALERT_RULES = {
  foodCostPctThreshold: 0.4, // 40%
  laborPctThreshold: 0.3,    // 30%
  ebitdaNegativeMonths: 2,   // 2 months in a row
};

function loadAlertRules() {
  const stored = loadData("pc_alert_rules", null);
  if (stored && typeof stored === "object") {
    return { ...DEFAULT_ALERT_RULES, ...stored };
  }
  return DEFAULT_ALERT_RULES;
}

function saveAlertRules(rules) {
  try {
    localStorage.setItem("pc_alert_rules", JSON.stringify(rules));
  } catch (e) {
    console.error("Failed to save pc_alert_rules", e);
  }
}

function AdminHub() {
  const [alertRules, setAlertRules] = useState(() => loadAlertRules());
  const [statusMsg, setStatusMsg] = useState("");

  // Persist rules whenever they change
  useEffect(() => {
    saveAlertRules(alertRules);
  }, [alertRules]);

  // Simple snapshot of data sizes (read once on mount)
  const [summary] = useState(() => {
    const getCount = (key) => {
      const arr = loadData(key, []);
      return Array.isArray(arr) ? arr.length : 0;
    };
    return {
      sales: getCount("pc_sales"),
      purchases: getCount("pc_purchases"),
      waste: getCount("pc_waste"),
      inventory: getCount("pc_inventory"),
      rentOpex: getCount("pc_rent_opex"),
      hr: getCount("pc_hr_labor"),
      pettyCash: getCount("pc_petty_cash"),
      recipes: getCount("pc_recipes"),
      targets: getCount("pc_targets"),
      scenarios: getCount("pc_scenarios"),
      actionPlan: getCount("pc_action_plan"),
    };
  });

  const handleAlertRuleChange = (field, value) => {
    let v = value;

    if (field === "foodCostPctThreshold" || field === "laborPctThreshold") {
      const num = Number(value);
      v = Number.isFinite(num) ? num : 0;
    } else if (field === "ebitdaNegativeMonths") {
      const num = parseInt(value, 10);
      v = Number.isFinite(num) && num > 0 ? num : 1;
    }

    setAlertRules((prev) => ({ ...prev, [field]: v }));
  };

  const handleSaveSettingsClick = () => {
    saveAlertRules(alertRules);
    setStatusMsg("Settings saved.");
    setTimeout(() => setStatusMsg(""), 2500);
  };

  return (
    <div>
      <h2 className="page-title">Admin Panel</h2>
      <p className="page-subtitle">
        Global configuration, thresholds, and data tools for the Project Casual
        ecosystem.
      </p>

      {/* System snapshot */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">System snapshot</h3>
        <p className="page-subtitle">
          Quick overview of how many rows you have in each core dataset (from
          localStorage).
        </p>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Area</th>
                <th>Storage key</th>
                <th>Rows</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sales</td>
                <td>pc_sales</td>
                <td>{summary.sales}</td>
              </tr>
              <tr>
                <td>Purchases / COGS</td>
                <td>pc_purchases</td>
                <td>{summary.purchases}</td>
              </tr>
              <tr>
                <td>Waste</td>
                <td>pc_waste</td>
                <td>{summary.waste}</td>
              </tr>
              <tr>
                <td>Inventory / Items master</td>
                <td>pc_inventory</td>
                <td>{summary.inventory}</td>
              </tr>
              <tr>
                <td>Rent & Opex</td>
                <td>pc_rent_opex</td>
                <td>{summary.rentOpex}</td>
              </tr>
              <tr>
                <td>HR / Labor</td>
                <td>pc_hr_labor</td>
                <td>{summary.hr}</td>
              </tr>
              <tr>
                <td>Petty cash</td>
                <td>pc_petty_cash</td>
                <td>{summary.pettyCash}</td>
              </tr>
              <tr>
                <td>Recipes</td>
                <td>pc_recipes</td>
                <td>{summary.recipes}</td>
              </tr>
              <tr>
                <td>Targets / Budgets</td>
                <td>pc_targets</td>
                <td>{summary.targets}</td>
              </tr>
              <tr>
                <td>Scenario planning</td>
                <td>pc_scenarios</td>
                <td>{summary.scenarios}</td>
              </tr>
              <tr>
                <td>Action plan</td>
                <td>pc_action_plan</td>
                <td>{summary.actionPlan}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert thresholds */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Alert thresholds</h3>
        <p className="page-subtitle">
          Define the thresholds that the dashboard uses to flag high food cost,
          high labor, and persistent negative EBITDA.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <label className="field-label">Food cost % threshold</label>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number"
                step="0.01"
                value={alertRules.foodCostPctThreshold}
                onChange={(e) =>
                  handleAlertRuleChange(
                    "foodCostPctThreshold",
                    e.target.value
                  )
                }
              />
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                e.g. 0.4 for 40%
              </span>
            </div>
          </div>

          <div>
            <label className="field-label">Labor % threshold</label>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number"
                step="0.01"
                value={alertRules.laborPctThreshold}
                onChange={(e) =>
                  handleAlertRuleChange("laborPctThreshold", e.target.value)
                }
              />
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                e.g. 0.3 for 30%
              </span>
            </div>
          </div>

          <div>
            <label className="field-label">
              Months of negative EBITDA before alert
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={alertRules.ebitdaNegativeMonths}
              onChange={(e) =>
                handleAlertRuleChange("ebitdaNegativeMonths", e.target.value)
              }
            />
          </div>
        </div>

        <button
          type="button"
          className="primary-btn"
          style={{ marginTop: 12 }}
          onClick={handleSaveSettingsClick}
        >
          Save alert settings
        </button>
        {statusMsg && (
          <p style={{ fontSize: 12, marginTop: 6, color: "#4b5563" }}>
            {statusMsg}
          </p>
        )}

        <p
          style={{
            fontSize: 12,
            marginTop: 6,
            color: "#6b7280",
          }}
        >
          Thresholds are stored in localStorage under{" "}
          <code>pc_alert_rules</code>. Your reporting layer can read them to
          decide when to show red alerts.
        </p>
      </div>

      {/* Import / Export */}
      <DataImportExport />
    </div>
  );
}

export default AdminHub;
