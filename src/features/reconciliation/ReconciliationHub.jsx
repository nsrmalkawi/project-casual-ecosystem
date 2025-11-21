// src/features/reconciliation/ReconciliationHub.jsx
import { useEffect, useMemo, useState } from "react";

// Simple helpers
function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

function loadArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to load", key, e);
    return [];
  }
}

function loadReconInputs() {
  try {
    const raw = localStorage.getItem("pc_inventory_recon_inputs");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.error("Failed to load pc_inventory_recon_inputs", e);
    return {};
  }
}

function formatNumber(v, digits = 3) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "0.000";
  return n.toFixed(digits);
}

function ReconciliationHub() {
  // Core data
  const [inventory] = useState(() => loadArray("pc_inventory"));
  const [recipes] = useState(() => loadArray("pc_recipes"));
  const [menuItems] = useState(() => loadArray("pc_menu_items"));
  const [wasteRows] = useState(() => loadArray("pc_waste"));

  // User inputs / filters
  const [brandFilter, setBrandFilter] = useState("all");
  const [outletFilter, setOutletFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [checkDate, setCheckDate] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return today;
  });

  // Start & actual qty per item (key = itemCode__brand__outlet)
  const [reconInputs, setReconInputs] = useState(() => loadReconInputs());

  // Thresholds for auto-tasks
  const [varianceCostThreshold, setVarianceCostThreshold] = useState(25); // JOD
  const [variancePctThreshold, setVariancePctThreshold] = useState(10); // %

  useEffect(() => {
    try {
      localStorage.setItem(
        "pc_inventory_recon_inputs",
        JSON.stringify(reconInputs)
      );
    } catch (e) {
      console.error("Failed to save pc_inventory_recon_inputs", e);
    }
  }, [reconInputs]);

  // Helpers
  const itemKey = (invRow) =>
    `${invRow.itemCode || ""}__${invRow.brand || ""}__${invRow.outlet || ""}`;

  const getInput = (key) => reconInputs[key] || { startQty: "", actualQty: "", note: "" };

  const updateInput = (key, field, value) => {
    setReconInputs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const allBrands = useMemo(() => {
    const s = new Set();
    inventory.forEach((r) => r.brand && s.add(r.brand));
    return Array.from(s);
  }, [inventory]);

  const allOutlets = useMemo(() => {
    const s = new Set();
    inventory.forEach((r) => r.outlet && s.add(r.outlet));
    return Array.from(s);
  }, [inventory]);

  const filteredInventory = useMemo(
    () =>
      inventory.filter((row) => {
        if (!row) return false;
        if (brandFilter !== "all" && row.brand !== brandFilter) return false;
        if (outletFilter !== "all" && row.outlet !== outletFilter) return false;
        return true;
      }),
    [inventory, brandFilter, outletFilter]
  );

  const inDateRange = (d) => {
    if (!d) return false;
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  // ---- 1) Theoretical usage from recipes + menu items ----
  const usageByItemCode = useMemo(() => {
    const usage = {};

    // Map menu item name -> total units sold
    const unitsSoldByName = {};
    menuItems.forEach((mi) => {
      const name = mi.itemName || mi.name || "";
      if (!name) return;
      const units = Number(mi.unitsSold || 0);
      if (!Number.isFinite(units) || units <= 0) return;
      unitsSoldByName[name] = (unitsSoldByName[name] || 0) + units;
    });

    // Recipes consumption: qtyPerPortion * unitsSold
    recipes.forEach((rec) => {
      if (!rec) return;
      const recName =
        rec.menuItemName ||
        rec.itemName ||
        rec.recipeName ||
        rec.name ||
        "";
      if (!recName) return;

      const portionsSold = unitsSoldByName[recName] || 0;
      if (portionsSold <= 0) return;

      const lines = Array.isArray(rec.lines)
        ? rec.lines
        : Array.isArray(rec.ingredients)
        ? rec.ingredients
        : [];

      lines.forEach((line) => {
        if (!line) return;
        const code =
          line.inventoryCode || line.itemCode || line.code || line.itemCodeRef;
        if (!code) return;
        const qtyPerPortion =
          Number(
            line.qtyPerPortion ??
              line.quantity ??
              line.qty ??
              line.portionQty ??
              0
          ) || 0;
        if (!qtyPerPortion) return;

        const totalUsage = qtyPerPortion * portionsSold;
        if (!totalUsage) return;

        usage[code] = (usage[code] || 0) + totalUsage;
      });
    });

    // Manual waste (if linked to items)
    const wasteFiltered = wasteRows.filter((w) => {
      if (!w) return false;
      if (!w.date) return true; // keep if no date
      if (!startDate && !endDate) return true;
      return inDateRange(w.date);
    });

    wasteFiltered.forEach((w) => {
      let code = w.inventoryCode || w.itemCode || "";
      let qty =
        Number(w.qty ?? w.quantity ?? w.units ?? w.qtyLost ?? 0) || 0;

      if (!code) {
        // Try match by itemName
        if (w.item) {
          const match = inventory.find((inv) => inv.itemName === w.item);
          if (match) {
            code = match.itemCode;
          }
        }
      }
      if (!code || !qty) return;

      usage[code] = (usage[code] || 0) + qty;
    });

    return usage;
  }, [recipes, menuItems, wasteRows, inventory, startDate, endDate]);

  // ---- 2) Build reconciliation rows per inventory item ----
  const reconRows = useMemo(() => {
    return filteredInventory.map((inv) => {
      const key = itemKey(inv);
      const inputs = getInput(key);
      const startQty = Number(inputs.startQty || 0) || 0;
      const actualQty = Number(inputs.actualQty || 0) || 0;

      const code = inv.itemCode || "";
      const unitCost = Number(inv.unitCost || 0) || 0;

      const theoreticalUsageQty = usageByItemCode[code] || 0;
      const theoreticalQty = startQty - theoreticalUsageQty;

      const varianceQty = actualQty - theoreticalQty;
      const varianceCost = varianceQty * unitCost;

      let variancePct = null;
      if (theoreticalQty !== 0) {
        variancePct = (varianceQty / theoreticalQty) * 100;
      }

      return {
        key,
        code,
        itemName: inv.itemName || "",
        brand: inv.brand || "",
        outlet: inv.outlet || "",
        unit: inv.unit || "",
        unitCost,
        startQty,
        theoreticalUsageQty,
        theoreticalQty,
        actualQty,
        varianceQty,
        varianceCost,
        variancePct,
        note: inputs.note || "",
      };
    });
  }, [filteredInventory, usageByItemCode, reconInputs]);

  // Totals
  const totals = useMemo(() => {
    let totalVarianceCost = 0;
    let totalTheoretical = 0;
    reconRows.forEach((r) => {
      totalVarianceCost += r.varianceCost;
      totalTheoretical += r.theoreticalQty;
    });
    let totalVariancePct = null;
    if (totalTheoretical !== 0) {
      const impliedVarianceQty =
        reconRows.reduce((sum, r) => sum + r.varianceQty, 0) || 0;
      totalVariancePct = (impliedVarianceQty / totalTheoretical) * 100;
    }
    return { totalVarianceCost, totalTheoretical, totalVariancePct };
  }, [reconRows]);

  const bigVarianceRows = useMemo(
    () =>
      reconRows.filter((r) => {
        const absCost = Math.abs(r.varianceCost || 0);
        if (absCost >= varianceCostThreshold) return true;
        if (r.variancePct === null) return false;
        if (Math.abs(r.variancePct) >= variancePctThreshold) return true;
        return false;
      }),
    [reconRows, varianceCostThreshold, variancePctThreshold]
  );

  // ---- 3) Push big variances to Action Plan ----
  const pushToActionPlan = () => {
    if (bigVarianceRows.length === 0) {
      window.alert("No variances above the thresholds to push.");
      return;
    }

    let existing = [];
    try {
      const raw = localStorage.getItem("pc_action_plan_items");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) existing = parsed;
      }
    } catch (e) {
      console.error("Failed to load pc_action_plan_items", e);
    }

    const now = new Date().toISOString();

    const newTasks = bigVarianceRows.map((r) => ({
      id: makeId(),
      area: "Waste & Inventory",
      title: `Investigate inventory variance – ${r.itemName || r.code}`,
      description: `Variance detected for ${r.itemName || r.code} (${r.brand || "All brands"} / ${
        r.outlet || "All outlets"
      }) on ${checkDate}.\n
Theoretical stock: ${formatNumber(r.theoreticalQty)} ${r.unit || ""}\nActual count: ${formatNumber(
        r.actualQty
      )} ${r.unit || ""}\nVariance: ${formatNumber(r.varianceQty)} ${
        r.unit || ""
      } (${formatNumber(r.varianceCost)} JOD).\n
Suggested actions: check portioning, waste logging, theft/shrinkage, and recording of deliveries.`,
      owner: "",
      status: "Open",
      priority: "High",
      createdAt: now,
      dueDate: "",
      source: "inventory-reconciliation",
      sourceKey: r.key,
    }));

    const updated = [...existing, ...newTasks];

    try {
      localStorage.setItem("pc_action_plan_items", JSON.stringify(updated));
      // Also mirror to a second key for compatibility if ActionPlanHub uses it
      localStorage.setItem("pc_action_plan", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save action plan updates", e);
    }

    window.alert(
      `${newTasks.length} investigation task(s) pushed to the Action Plan.`
    );
  };

  return (
    <div>
      <h2 className="page-title">Waste &amp; Inventory Reconciliation</h2>
      <p className="page-subtitle">
        Compare theoretical stock (based on recipes, menu sales &amp; waste)
        against your physical count. Use this to spot shrinkage, portioning
        issues, or recording gaps, and auto-create investigation actions.
      </p>

      {/* Filters and thresholds */}
      <div
        className="card"
        style={{
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        <div style={{ minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Brand
          </label>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
            }}
          >
            <option value="all">All brands</option>
            {allBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Outlet
          </label>
          <select
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
            }}
          >
            <option value="all">All outlets</option>
            {allOutlets.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 140 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Period start (for waste)
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ minWidth: 140 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Period end (for waste)
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ minWidth: 140 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Check date
          </label>
          <input
            type="date"
            value={checkDate}
            onChange={(e) => setCheckDate(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Variance cost threshold (JOD)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={varianceCostThreshold}
            onChange={(e) =>
              setVarianceCostThreshold(Number(e.target.value) || 0)
            }
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Variance % threshold
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={variancePctThreshold}
            onChange={(e) =>
              setVariancePctThreshold(Number(e.target.value) || 0)
            }
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
            }}
          />
        </div>

        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            setBrandFilter("all");
            setOutletFilter("all");
            setStartDate("");
            setEndDate("");
          }}
        >
          Reset filters
        </button>
      </div>

      {/* Summary */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Variance summary</h3>
        <div
          className="kpi-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 10,
          }}
        >
          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Items in this check
            </div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              {reconRows.length}
            </div>
          </div>

          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Total variance cost
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color:
                  totals.totalVarianceCost > 0
                    ? "#b91c1c"
                    : totals.totalVarianceCost < 0
                    ? "#15803d"
                    : "#111827",
              }}
            >
              {formatNumber(totals.totalVarianceCost)} JOD
            </div>
          </div>

          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Total theoretical stock
            </div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              {formatNumber(totals.totalTheoretical)} (sum of all items)
            </div>
          </div>

          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Aggregate variance %
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color:
                  totals.totalVariancePct !== null &&
                  Math.abs(totals.totalVariancePct) >=
                    variancePctThreshold
                    ? "#b91c1c"
                    : "#111827",
              }}
            >
              {totals.totalVariancePct === null
                ? "—"
                : `${totals.totalVariancePct.toFixed(1)}%`}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="primary-btn"
            onClick={pushToActionPlan}
          >
            Push big variances to Action Plan
          </button>
          <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
            Thresholds: |cost| ≥ {varianceCostThreshold} JOD or |variance %| ≥{" "}
            {variancePctThreshold}%.
          </span>
        </div>
      </div>

      {/* Detailed reconciliation table */}
      <div className="card">
        <h3 className="card-title">End-of-period inventory check</h3>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          For each ingredient, enter the start quantity for the period and your
          physical count at the end. The system uses recipes, menu units sold
          and waste to estimate theoretical stock and variance.
        </p>

        <div className="table-wrapper" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Item</th>
                <th>Brand</th>
                <th>Outlet</th>
                <th>Unit</th>
                <th>Unit cost</th>
                <th>Start qty</th>
                <th>Theoretical usage</th>
                <th>Theoretical stock</th>
                <th>Actual count</th>
                <th>Variance qty</th>
                <th>Variance cost</th>
                <th>Variance %</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {reconRows.length === 0 ? (
                <tr>
                  <td colSpan={14}>
                    No inventory items found for the current filters. Maintain
                    your items in the Inventory tab, then return here.
                  </td>
                </tr>
              ) : (
                reconRows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.code}</td>
                    <td>{r.itemName}</td>
                    <td>{r.brand}</td>
                    <td>{r.outlet}</td>
                    <td>{r.unit}</td>
                    <td>{formatNumber(r.unitCost)}</td>
                    <td>
                      <input
                        type="number"
                        step="0.001"
                        value={r.startQty || ""}
                        onChange={(e) =>
                          updateInput(r.key, "startQty", e.target.value)
                        }
                      />
                    </td>
                    <td>{formatNumber(r.theoreticalUsageQty)}</td>
                    <td>{formatNumber(r.theoreticalQty)}</td>
                    <td>
                      <input
                        type="number"
                        step="0.001"
                        value={r.actualQty || ""}
                        onChange={(e) =>
                          updateInput(r.key, "actualQty", e.target.value)
                        }
                      />
                    </td>
                    <td
                      style={{
                        color:
                          r.varianceQty > 0
                            ? "#b91c1c"
                            : r.varianceQty < 0
                            ? "#15803d"
                            : "#111827",
                      }}
                    >
                      {formatNumber(r.varianceQty)}
                    </td>
                    <td
                      style={{
                        color:
                          r.varianceCost > 0
                            ? "#b91c1c"
                            : r.varianceCost < 0
                            ? "#15803d"
                            : "#111827",
                      }}
                    >
                      {formatNumber(r.varianceCost)}
                    </td>
                    <td
                      style={{
                        color:
                          r.variancePct !== null &&
                          Math.abs(r.variancePct) >= variancePctThreshold
                            ? "#b91c1c"
                            : "#111827",
                      }}
                    >
                      {r.variancePct === null
                        ? "—"
                        : `${r.variancePct.toFixed(1)}%`}
                    </td>
                    <td>
                      <input
                        type="text"
                        value={r.note || ""}
                        onChange={(e) =>
                          updateInput(r.key, "note", e.target.value)
                        }
                        placeholder="Cause / comments"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
          Notes:
          <br />
          • Use the <strong>Menu Engineering</strong> tab to maintain{" "}
          <code>unitsSold</code> per menu item for the period you are
          reconciling.
          <br />
          • Ensure recipes link ingredients via <code>inventoryCode</code> to
          get accurate theoretical usage.
          <br />
          • Waste entries with <code>inventoryCode</code> or matching item
          names will also be included in the usage.
        </p>
      </div>
    </div>
  );
}

export default ReconciliationHub;
