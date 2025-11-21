// src/features/reports/ReportsHub.jsx
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { loadData } from "../../utils/storage";
import AlertsSummaryBox from "./AlertsSummaryBox";
import { callAi } from "../../utils/aiClient";

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function percent(n) {
  if (!Number.isFinite(n)) return "0.0%";
  return (n * 100).toFixed(1) + "%";
}

function ReportsHub() {
  // Load ecosystem snapshots from localStorage (written by DataEntryHub)
  const [sales] = useState(() => loadData("pc_sales", []) || []);
  const [purchases] = useState(() => loadData("pc_purchases", []) || []);
  const [waste] = useState(() => loadData("pc_waste", []) || []);
  const [inventory] = useState(() => loadData("pc_inventory", []) || []);
  const [rentOpex] = useState(() => loadData("pc_rent_opex", []) || []);
  const [hr] = useState(() => loadData("pc_hr_labor", []) || []);
  const [pettyCash] = useState(() => loadData("pc_petty_cash", []) || []);

  // --------- Filters ---------
  const [brandFilter, setBrandFilter] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const allBrands = useMemo(() => {
    const set = new Set();
    [...sales, ...purchases, ...waste].forEach((r) => {
      if (r.brand) set.add(r.brand);
    });
    return Array.from(set).sort();
  }, [sales, purchases, waste]);

  const allOutlets = useMemo(() => {
    const set = new Set();
    [...sales, ...purchases, ...waste, ...rentOpex, ...hr, ...pettyCash].forEach(
      (r) => {
        if (r.outlet) set.add(r.outlet);
      }
    );
    return Array.from(set).sort();
  }, [sales, purchases, waste, rentOpex, hr, pettyCash]);

  function passesFilters(row) {
    if (!row) return false;
    if (brandFilter && row.brand && row.brand !== brandFilter) return false;
    if (outletFilter && row.outlet && row.outlet !== outletFilter) return false;

    if (startDate && row.date && row.date < startDate) return false;
    if (endDate && row.date && row.date > endDate) return false;

    return true;
  }

  const filteredSales = useMemo(
    () => sales.filter((r) => passesFilters(r)),
    [sales, brandFilter, outletFilter, startDate, endDate]
  );
  const filteredPurchases = useMemo(
    () => purchases.filter((r) => passesFilters(r)),
    [purchases, brandFilter, outletFilter, startDate, endDate]
  );
  const filteredWaste = useMemo(
    () => waste.filter((r) => passesFilters(r)),
    [waste, brandFilter, outletFilter, startDate, endDate]
  );
  const filteredRentOpex = useMemo(
    () => rentOpex.filter((r) => passesFilters(r)),
    [rentOpex, brandFilter, outletFilter, startDate, endDate]
  );
  const filteredHr = useMemo(
    () => hr.filter((r) => passesFilters(r)),
    [hr, brandFilter, outletFilter, startDate, endDate]
  );
  const filteredPettyCash = useMemo(
    () => pettyCash.filter((r) => passesFilters(r)),
    [pettyCash, brandFilter, outletFilter, startDate, endDate]
  );

  // --------- KPI summary (including EBITDA) ---------
  const kpis = useMemo(() => {
    const totalSales = filteredSales.reduce(
      (sum, r) => sum + safeNumber(r.netSales),
      0
    );
    const totalFoodCostPurchases = filteredPurchases.reduce(
      (sum, r) => sum + safeNumber(r.totalCost),
      0
    );
    const totalFoodCostWaste = filteredWaste.reduce(
      (sum, r) => sum + safeNumber(r.costValue),
      0
    );
    const totalFoodCost = totalFoodCostPurchases + totalFoodCostWaste;

    const totalLaborCost = filteredHr.reduce(
      (sum, r) => sum + safeNumber(r.laborCost),
      0
    );
    const totalRentOpex = filteredRentOpex.reduce(
      (sum, r) => sum + safeNumber(r.amount),
      0
    );
    const totalPettyCash = filteredPettyCash.reduce(
      (sum, r) => sum + safeNumber(r.amount),
      0
    );

    const totalCost =
      totalFoodCost + totalLaborCost + totalRentOpex + totalPettyCash;
    const ebitda = totalSales - totalCost;

    const foodCostPct = totalSales ? totalFoodCost / totalSales : 0;
    const laborPct = totalSales ? totalLaborCost / totalSales : 0;
    const rentOpexPct = totalSales ? totalRentOpex / totalSales : 0;
    const ebitdaMargin = totalSales ? ebitda / totalSales : 0;

    return {
      totalSales,
      totalFoodCost,
      totalLaborCost,
      totalRentOpex,
      totalPettyCash,
      ebitda,
      foodCostPct,
      laborPct,
      rentOpexPct,
      ebitdaMargin,
    };
  }, [
    filteredSales,
    filteredPurchases,
    filteredWaste,
    filteredRentOpex,
    filteredHr,
    filteredPettyCash,
  ]);

  // --------- EBITDA by outlet (small table + bar chart) ---------
  const ebitdaByOutlet = useMemo(() => {
    const map = new Map();

    function ensureOutlet(key, row) {
      if (!map.has(key)) {
        map.set(key, {
          outlet: key,
          brand: row?.brand || "",
          sales: 0,
          foodCost: 0,
          labor: 0,
          rent: 0,
          petty: 0,
        });
      }
      return map.get(key);
    }

    filteredSales.forEach((r) => {
      const key = r.outlet || "Unassigned";
      const bucket = ensureOutlet(key, r);
      bucket.sales += safeNumber(r.netSales);
    });

    filteredPurchases.forEach((r) => {
      const key = r.outlet || "Unassigned";
      const bucket = ensureOutlet(key, r);
      bucket.foodCost += safeNumber(r.totalCost);
    });

    filteredWaste.forEach((r) => {
      const key = r.outlet || "Unassigned";
      const bucket = ensureOutlet(key, r);
      bucket.foodCost += safeNumber(r.costValue);
    });

    filteredHr.forEach((r) => {
      const key = r.outlet || "Unassigned";
      const bucket = ensureOutlet(key, r);
      bucket.labor += safeNumber(r.laborCost);
    });

    filteredRentOpex.forEach((r) => {
      const key = r.outlet || "Unassigned";
      const bucket = ensureOutlet(key, r);
      bucket.rent += safeNumber(r.amount);
    });

    filteredPettyCash.forEach((r) => {
      const key = r.outlet || "Unassigned";
      const bucket = ensureOutlet(key, r);
      bucket.petty += safeNumber(r.amount);
    });

    return Array.from(map.values())
      .map((b) => {
        const totalCost = b.foodCost + b.labor + b.rent + b.petty;
        const ebitda = b.sales - totalCost;
        return {
          outlet: b.outlet,
          brand: b.brand,
          totalSales: b.sales,
          totalFoodCost: b.foodCost,
          totalLaborCost: b.labor,
          totalRentOpex: b.rent,
          totalPettyCash: b.petty,
          ebitda,
          ebitdaMargin: b.sales ? ebitda / b.sales : 0,
        };
      })
      .sort((a, b) => a.outlet.localeCompare(b.outlet));
  }, [
    filteredSales,
    filteredPurchases,
    filteredWaste,
    filteredHr,
    filteredRentOpex,
    filteredPettyCash,
  ]);

  // --------- Time series: Sales vs EBITDA over time ---------
  const timeSeries = useMemo(() => {
    const map = new Map();

    function ensureDate(d) {
      if (!map.has(d)) {
        map.set(d, {
          date: d,
          sales: 0,
          foodCost: 0,
          labor: 0,
          rent: 0,
          petty: 0,
        });
      }
      return map.get(d);
    }

    filteredSales.forEach((r) => {
      const d = r.date || "No date";
      const bucket = ensureDate(d);
      bucket.sales += safeNumber(r.netSales);
    });

    filteredPurchases.forEach((r) => {
      const d = r.date || "No date";
      const bucket = ensureDate(d);
      bucket.foodCost += safeNumber(r.totalCost);
    });

    filteredWaste.forEach((r) => {
      const d = r.date || "No date";
      const bucket = ensureDate(d);
      bucket.foodCost += safeNumber(r.costValue);
    });

    filteredHr.forEach((r) => {
      const d = r.date || "No date";
      const bucket = ensureDate(d);
      bucket.labor += safeNumber(r.laborCost);
    });

    filteredRentOpex.forEach((r) => {
      const d = r.date || "No date";
      const bucket = ensureDate(d);
      bucket.rent += safeNumber(r.amount);
    });

    filteredPettyCash.forEach((r) => {
      const d = r.date || "No date";
      const bucket = ensureDate(d);
      bucket.petty += safeNumber(r.amount);
    });

    const arr = Array.from(map.values()).map((b) => {
      const totalCost = b.foodCost + b.labor + b.rent + b.petty;
      const ebitda = b.sales - totalCost;
      return {
        date: b.date,
        sales: b.sales,
        ebitda,
      };
    });

    // Sort by date string (YYYY-MM-DD works lexicographically)
    return arr.sort((a, b) => a.date.localeCompare(b.date));
  }, [
    filteredSales,
    filteredPurchases,
    filteredWaste,
    filteredHr,
    filteredRentOpex,
    filteredPettyCash,
  ]);

  // --------- Simple automatic alerts (Data-driven) ---------
  const triggeredAlerts = useMemo(() => {
    const alerts = [];

    if (kpis.totalSales > 0 && kpis.foodCostPct > 0.4) {
      alerts.push({
        id: "food-cost-high-overall",
        severity: "high",
        message: `Food cost is ${percent(
          kpis.foodCostPct
        )} (above 40% threshold) for current filters.`,
      });
    }

    if (kpis.totalSales > 0 && kpis.laborPct > 0.3) {
      alerts.push({
        id: "labor-high-overall",
        severity: "medium",
        message: `Labor cost is ${percent(
          kpis.laborPct
        )} (above 30% threshold) for current filters.`,
      });
    }

    ebitdaByOutlet.forEach((row) => {
      if (row.ebitda < 0) {
        alerts.push({
          id: `outlet-ebitda-negative-${row.outlet}`,
          severity: "high",
          message: `Outlet "${row.outlet}" has negative EBITDA (${row.ebitda.toFixed(
            3
          )} JOD) under current filters.`,
        });
      }
    });

    return alerts;
  }, [kpis, ebitdaByOutlet]);

  // --------- AI Insights (anomaly scan + action plan) ---------
  const [aiAnomalyStatus, setAiAnomalyStatus] = useState("idle");
  const [aiActionStatus, setAiActionStatus] = useState("idle");
  const [aiError, setAiError] = useState(null);
  const [aiAnomalyText, setAiAnomalyText] = useState("");
  const [aiActionText, setAiActionText] = useState("");

  const aiPayload = useMemo(
    () => ({
      filters: {
        brandFilter: brandFilter || null,
        outletFilter: outletFilter || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
      kpis,
      ebitdaByOutlet,
      timeSeries,
      counts: {
        sales: filteredSales.length,
        purchases: filteredPurchases.length,
        waste: filteredWaste.length,
        rentOpex: filteredRentOpex.length,
        hr: filteredHr.length,
        pettyCash: filteredPettyCash.length,
        inventory: inventory.length,
      },
    }),
    [
      brandFilter,
      outletFilter,
      startDate,
      endDate,
      kpis,
      ebitdaByOutlet,
      timeSeries,
      filteredSales,
      filteredPurchases,
      filteredWaste,
      filteredRentOpex,
      filteredHr,
      filteredPettyCash,
      inventory,
    ]
  );

  async function handleRunAnomalyScan() {
    if (!aiPayload) return;
    setAiError(null);
    setAiAnomalyStatus("loading");
    try {
      const res = await callAi({
        mode: "anomaly",
        payload: aiPayload,
      });
      setAiAnomalyText(res.text || "");
      setAiAnomalyStatus("done");
    } catch (err) {
      console.error("AI anomaly error:", err);
      setAiError(err.message || "AI anomaly scan failed.");
      setAiAnomalyStatus("error");
    }
  }

  async function handleGenerateActionSuggestions() {
    if (!aiPayload) return;
    setAiError(null);
    setAiActionStatus("loading");
    try {
      const res = await callAi({
        mode: "actionPlan",
        payload: aiPayload,
      });
      setAiActionText(res.text || "");
      setAiActionStatus("done");
    } catch (err) {
      console.error("AI action suggestions error:", err);
      setAiError(err.message || "AI action suggestions failed.");
      setAiActionStatus("error");
    }
  }

  // --------- Render ---------
  return (
    <div>
      <h2 className="page-title">Reports & Dashboard</h2>
      <p className="page-subtitle">
        Visualize Project Casual performance by brand, outlet, and period. All
        metrics are read from the Data Entry Hub (localStorage).
      </p>

      {/* Filters row */}
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
        <div>
          <label className="field-label">Brand</label>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            <option value="">All brands</option>
            {allBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Outlet</label>
          <select
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
          >
            <option value="">All outlets</option>
            {allOutlets.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">From date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label className="field-label">To date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div
        className="kpi-grid"
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          marginBottom: 16,
        }}
      >
        <div className="card">
          <h3 className="card-title">Net Sales</h3>
          <p style={{ fontSize: 20, fontWeight: 600 }}>
            {kpis.totalSales.toFixed(3)} JOD
          </p>
        </div>
        <div className="card">
          <h3 className="card-title">Food Cost</h3>
          <p style={{ fontSize: 20, fontWeight: 600 }}>
            {kpis.totalFoodCost.toFixed(3)} JOD
          </p>
          <p className="page-subtitle">{percent(kpis.foodCostPct)} of sales</p>
        </div>
        <div className="card">
          <h3 className="card-title">Labor Cost</h3>
          <p style={{ fontSize: 20, fontWeight: 600 }}>
            {kpis.totalLaborCost.toFixed(3)} JOD
          </p>
          <p className="page-subtitle">{percent(kpis.laborPct)} of sales</p>
        </div>
        <div className="card">
          <h3 className="card-title">Rent & Opex</h3>
          <p style={{ fontSize: 20, fontWeight: 600 }}>
            {kpis.totalRentOpex.toFixed(3)} JOD
          </p>
          <p className="page-subtitle">{percent(kpis.rentOpexPct)} of sales</p>
        </div>
        <div className="card">
          <h3 className="card-title">EBITDA</h3>
          <p
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: kpis.ebitda >= 0 ? "#15803d" : "#b91c1c",
            }}
          >
            {kpis.ebitda.toFixed(3)} JOD
          </p>
          <p className="page-subtitle">{percent(kpis.ebitdaMargin)} EBITDA%</p>
        </div>
      </div>

      {/* AI Insights card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">AI Insights</h3>
        <p className="page-subtitle">
          Let AI scan current metrics for anomalies and propose an improvement
          action plan for Project Casual.
        </p>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <button
            type="button"
            className="primary-btn"
            onClick={handleRunAnomalyScan}
            disabled={aiAnomalyStatus === "loading"}
          >
            {aiAnomalyStatus === "loading"
              ? "Scanning for anomalies..."
              : "Run AI anomaly scan"}
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={handleGenerateActionSuggestions}
            disabled={aiActionStatus === "loading"}
          >
            {aiActionStatus === "loading"
              ? "Generating actions..."
              : "AI action plan suggestions"}
          </button>
        </div>

        {aiError && (
          <div
            style={{
              color: "#b91c1c",
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            {aiError}
          </div>
        )}

        {aiAnomalyText && (
          <div style={{ marginBottom: 8 }}>
            <h4
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Anomalies & red flags
            </h4>
            <div
              className="ai-output-box"
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 8,
                maxHeight: 220,
                overflowY: "auto",
                backgroundColor: "#f9fafb",
              }}
            >
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  margin: 0,
                  fontFamily:
                    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {aiAnomalyText}
              </pre>
            </div>
          </div>
        )}

        {aiActionText && (
          <div>
            <h4
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Suggested action plan
            </h4>
            <div
              className="ai-output-box"
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 8,
                maxHeight: 260,
                overflowY: "auto",
                backgroundColor: "#f9fafb",
              }}
            >
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  margin: 0,
                  fontFamily:
                    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {aiActionText}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Alerts summary (simple auto alerts) */}
      <AlertsSummaryBox triggeredAlerts={triggeredAlerts} />

      {/* Charts row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: 16,
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        {/* Time series */}
        <div className="card">
          <h3 className="card-title">Sales & EBITDA over time</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name="Sales (JOD)"
                  stroke="#4f46e5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ebitda"
                  name="EBITDA (JOD)"
                  stroke="#16a34a"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Outlet breakdown */}
        <div className="card">
          <h3 className="card-title">Sales, Costs & EBITDA by outlet</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={ebitdaByOutlet}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="outlet" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalSales" name="Sales" />
                <Bar dataKey="totalFoodCost" name="Food cost" />
                <Bar dataKey="totalLaborCost" name="Labor" />
                <Bar dataKey="ebitda" name="EBITDA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* EBITDA by outlet table */}
      <div className="card">
        <h3 className="card-title">EBITDA by outlet</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Outlet</th>
                <th>Brand</th>
                <th>Sales (JOD)</th>
                <th>Food cost (JOD)</th>
                <th>Labor (JOD)</th>
                <th>Rent & opex (JOD)</th>
                <th>Petty cash (JOD)</th>
                <th>EBITDA (JOD)</th>
                <th>EBITDA %</th>
              </tr>
            </thead>
            <tbody>
              {ebitdaByOutlet.length === 0 ? (
                <tr>
                  <td colSpan={9}>No data for current filters.</td>
                </tr>
              ) : (
                ebitdaByOutlet.map((row) => (
                  <tr key={row.outlet}>
                    <td>{row.outlet}</td>
                    <td>{row.brand}</td>
                    <td>{row.totalSales.toFixed(3)}</td>
                    <td>{row.totalFoodCost.toFixed(3)}</td>
                    <td>{row.totalLaborCost.toFixed(3)}</td>
                    <td>{row.totalRentOpex.toFixed(3)}</td>
                    <td>{row.totalPettyCash.toFixed(3)}</td>
                    <td
                      style={{
                        color: row.ebitda >= 0 ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {row.ebitda.toFixed(3)}
                    </td>
                    <td>{percent(row.ebitdaMargin)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ReportsHub;
