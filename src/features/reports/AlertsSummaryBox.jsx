// src/features/reports/AlertsSummaryBox.jsx
import { useMemo, useState } from "react";

const DEFAULT_RULES = [
  {
    id: "food-cost",
    label: "Food cost % > threshold",
    type: "foodCostPct",
    threshold: 40,
    windowMonths: null,
    enabled: true,
  },
  {
    id: "labor-cost",
    label: "Labor % > threshold",
    type: "laborPct",
    threshold: 30,
    windowMonths: null,
    enabled: true,
  },
  {
    id: "ebitda-2m",
    label: "Outlet EBITDA < 0 for N consecutive months",
    type: "ebitdaNegativeMonths",
    threshold: 0,
    windowMonths: 2,
    enabled: true,
  },
];

function loadArray(key) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to load", key, e);
    return [];
  }
}

function loadRules() {
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

function monthKeyFromDate(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function AlertsSummaryBox() {
  const [sales] = useState(() => loadArray("pc_sales"));
  const [purchases] = useState(() => loadArray("pc_purchases"));
  const [rentOpex] = useState(() => loadArray("pc_rent_opex"));
  const [hrLabor] = useState(() => loadArray("pc_hr_labor"));
  const [pettyCash] = useState(() => loadArray("pc_petty_cash"));
  const [rules] = useState(() => loadRules());

  const { alerts, foodCostPct, laborPct } = useMemo(() => {
    let totalSales = 0;
    let totalFood = 0;
    let totalLabor = 0;

    const outletMonthMap = new Map();

    const ensureOutletMonth = (outletRaw, dateStr) => {
      const outlet = outletRaw || "All / Unassigned";
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return null;
      const mk = monthKeyFromDate(d);
      const key = `${outlet}__${mk}`;
      if (!outletMonthMap.has(key)) {
        outletMonthMap.set(key, {
          outlet,
          monthKey: mk,
          sales: 0,
          food: 0,
          rent: 0,
          labor: 0,
          petty: 0,
          ebitda: 0,
        });
      }
      return key;
    };

    // Sales
    sales.forEach((row) => {
      const amount = Number(row.netSales ?? row.sales ?? 0) || 0;
      totalSales += amount;
      const key = ensureOutletMonth(row.outlet, row.date);
      if (key) {
        const rec = outletMonthMap.get(key);
        rec.sales += amount;
      }
    });

    // Purchases = food cost
    purchases.forEach((row) => {
      const amount = Number(row.totalCost ?? row.amount ?? 0) || 0;
      totalFood += amount;
      const key = ensureOutletMonth(row.outlet, row.date);
      if (key) {
        const rec = outletMonthMap.get(key);
        rec.food += amount;
      }
    });

    // Rent / opex
    rentOpex.forEach((row) => {
      const amount = Number(row.amount ?? 0) || 0;
      const key = ensureOutletMonth(row.outlet, row.date);
      if (key) {
        const rec = outletMonthMap.get(key);
        rec.rent += amount;
      }
    });

    // HR / labor
    hrLabor.forEach((row) => {
      const amount = Number(row.laborCost ?? row.amount ?? 0) || 0;
      totalLabor += amount;
      const key = ensureOutletMonth(row.outlet, row.date);
      if (key) {
        const rec = outletMonthMap.get(key);
        rec.labor += amount;
      }
    });

    // Petty cash → opex
    pettyCash.forEach((row) => {
      const amount = Number(row.amount ?? 0) || 0;
      const key = ensureOutletMonth(row.outlet, row.date);
      if (key) {
        const rec = outletMonthMap.get(key);
        rec.petty += amount;
      }
    });

    // Compute EBITDA per outlet/month
    const outletMap = new Map(); // outlet -> [{monthKey, ebitda}]
    outletMonthMap.forEach((rec) => {
      rec.ebitda =
        rec.sales - (rec.food + rec.rent + rec.labor + rec.petty);
      if (!outletMap.has(rec.outlet)) {
        outletMap.set(rec.outlet, []);
      }
      outletMap.get(rec.outlet).push({
        monthKey: rec.monthKey,
        ebitda: rec.ebitda,
      });
    });

    const foodPct =
      totalSales > 0 ? (totalFood / totalSales) * 100 : null;
    const laborPctVal =
      totalSales > 0 ? (totalLabor / totalSales) * 100 : null;

    const generatedAlerts = [];

    // Apply rules
    rules.forEach((rule) => {
      if (!rule.enabled) return;

      if (rule.type === "foodCostPct" && foodPct !== null) {
        const limit = Number(rule.threshold ?? 0);
        if (foodPct > limit) {
          generatedAlerts.push({
            id: rule.id,
            level: "high",
            text: `Food cost is ${foodPct.toFixed(
              1
            )}% (limit ${limit}%).`,
          });
        }
      }

      if (rule.type === "laborPct" && laborPctVal !== null) {
        const limit = Number(rule.threshold ?? 0);
        if (laborPctVal > limit) {
          generatedAlerts.push({
            id: rule.id,
            level: "high",
            text: `Labor cost is ${laborPctVal.toFixed(
              1
            )}% (limit ${limit}%).`,
          });
        }
      }

      if (rule.type === "ebitdaNegativeMonths") {
        const window = Number(rule.windowMonths ?? 2);
        if (window <= 0) return;

        const affectedOutlets = [];

        outletMap.forEach((rows, outlet) => {
          if (!rows || rows.length === 0) return;
          const sorted = [...rows].sort((a, b) =>
            a.monthKey.localeCompare(b.monthKey)
          );
          let streak = 0;
          for (const r of sorted) {
            if (r.ebitda < 0) {
              streak += 1;
              if (streak >= window) {
                affectedOutlets.push(outlet);
                break;
              }
            } else {
              streak = 0;
            }
          }
        });

        if (affectedOutlets.length > 0) {
          const list =
            affectedOutlets.length > 3
              ? `${affectedOutlets.slice(0, 3).join(", ")} +${
                  affectedOutlets.length - 3
                } more`
              : affectedOutlets.join(", ");
          generatedAlerts.push({
            id: rule.id,
            level: "critical",
            text: `EBITDA negative for at least ${window} consecutive month(s) in outlet(s): ${list}.`,
          });
        }
      }
    });

    return {
      alerts: generatedAlerts,
      foodCostPct: foodPct,
      laborPct: laborPctVal,
    };
  }, [sales, purchases, rentOpex, hrLabor, pettyCash, rules]);

  return (
    <div
      className="card"
      style={{
        borderLeft: "4px solid #dc2626",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            className="card-title"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 18,
                height: 18,
                borderRadius: "50%",
                justifyContent: "center",
                alignItems: "center",
                fontSize: 11,
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                fontWeight: 700,
              }}
            >
              !
            </span>
            Alerts
          </h3>
          <p className="page-subtitle" style={{ marginBottom: 4 }}>
            Quick view of any thresholds or risk signals configured in the Admin
            panel.
          </p>
        </div>

        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
            minWidth: 160,
          }}
        >
          <span>
            Food cost%:{" "}
            {foodCostPct === null
              ? "—"
              : `${foodCostPct.toFixed(1)}%`}
          </span>
          <span>
            Labor%:{" "}
            {laborPct === null ? "—" : `${laborPct.toFixed(1)}%`}
          </span>
        </div>
      </div>

      <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 13 }}>
        {alerts.length === 0 ? (
          <li style={{ color: "#16a34a" }}>
            No alerts based on current rules. Metrics are within your
            thresholds.
          </li>
        ) : (
          alerts.map((a) => (
            <li
              key={a.id + a.text}
              style={{
                color: "#b91c1c",
                marginBottom: 4,
              }}
            >
              {a.text}
            </li>
          ))
        )}
      </ul>

      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
        Manage thresholds and rules under{" "}
        <strong>Admin → Alerts &amp; Thresholds</strong>.
      </p>
    </div>
  );
}

export default AlertsSummaryBox;
