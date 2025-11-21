// src/features/reports/CashFlowHub.jsx
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";

// -------- Helpers --------
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

function loadSettings() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem("pc_cashflow_settings");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.error("Failed to load pc_cashflow_settings", e);
    return {};
  }
}

function formatMoney(v, digits = 3) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "0.000";
  return n.toFixed(digits);
}

function monthKeyFromDate(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function monthLabelFromDate(date) {
  return date.toLocaleString("en-GB", { month: "short", year: "numeric" });
}

function parseMonthKey(monthKey) {
  const [yStr, mStr] = monthKey.split("-");
  const y = Number(yStr);
  const m = Number(mStr) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    return new Date();
  }
  return new Date(y, m, 1);
}

// -------- Component --------
function CashFlowHub() {
  // Raw data from localStorage (read-only here)
  const [sales] = useState(() => loadArray("pc_sales"));
  const [purchases] = useState(() => loadArray("pc_purchases"));
  const [rentOpex] = useState(() => loadArray("pc_rent_opex"));
  const [hrLabor] = useState(() => loadArray("pc_hr_labor"));
  const [pettyCash] = useState(() => loadArray("pc_petty_cash"));

  // View mode: "historic" or "forecast"
  const [mode, setMode] = useState("historic");

  // Settings with persistence
  const [lookbackMonths, setLookbackMonths] = useState(() => {
    const s = loadSettings();
    return s.lookbackMonths ?? 3;
  });
  const [forecastMonths, setForecastMonths] = useState(() => {
    const s = loadSettings();
    return s.forecastMonths ?? 6;
  });
  const [currentBalance, setCurrentBalance] = useState(() => {
    const s = loadSettings();
    return s.currentBalance ?? 0;
  });
  const [minBuffer, setMinBuffer] = useState(() => {
    const s = loadSettings();
    return s.minBuffer ?? 0;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const settings = {
      lookbackMonths,
      forecastMonths,
      currentBalance,
      minBuffer,
    };
    try {
      window.localStorage.setItem(
        "pc_cashflow_settings",
        JSON.stringify(settings)
      );
    } catch (e) {
      console.error("Failed to save pc_cashflow_settings", e);
    }
  }, [lookbackMonths, forecastMonths, currentBalance, minBuffer]);

  // -------- Monthly actual aggregation --------
  const monthlyActual = useMemo(() => {
    const map = new Map();

    function ensureMonth(dateStr) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return null;
      const key = monthKeyFromDate(d);
      if (!map.has(key)) {
        map.set(key, {
          monthKey: key,
          label: monthLabelFromDate(new Date(d.getFullYear(), d.getMonth(), 1)),
          salesIn: 0,
          purchasesOut: 0,
          rentOut: 0,
          laborOut: 0,
          pettyOut: 0,
          netCash: 0,
        });
      }
      return key;
    }

    // Sales: cash in
    sales.forEach((row) => {
      const key = ensureMonth(row.date);
      if (!key) return;
      const amount = Number(row.netSales ?? row.sales ?? 0) || 0;
      const rec = map.get(key);
      rec.salesIn += amount;
    });

    // Purchases: suppliers / COGS out
    purchases.forEach((row) => {
      const key = ensureMonth(row.date);
      if (!key) return;
      const amount = Number(row.totalCost ?? row.amount ?? 0) || 0;
      const rec = map.get(key);
      rec.purchasesOut += amount;
    });

    // Rent & Opex out
    rentOpex.forEach((row) => {
      const key = ensureMonth(row.date);
      if (!key) return;
      const amount = Number(row.amount ?? 0) || 0;
      const rec = map.get(key);
      rec.rentOut += amount;
    });

    // HR / Labor out
    hrLabor.forEach((row) => {
      const key = ensureMonth(row.date);
      if (!key) return;
      const amount = Number(row.laborCost ?? row.amount ?? 0) || 0;
      const rec = map.get(key);
      rec.laborOut += amount;
    });

    // Petty cash out
    pettyCash.forEach((row) => {
      const key = ensureMonth(row.date);
      if (!key) return;
      const amount = Number(row.amount ?? 0) || 0;
      const rec = map.get(key);
      rec.pettyOut += amount;
    });

    const rows = Array.from(map.values());
    rows.sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    rows.forEach((r) => {
      const totalOut = r.purchasesOut + r.rentOut + r.laborOut + r.pettyOut;
      r.netCash = r.salesIn - totalOut;
    });

    return rows;
  }, [sales, purchases, rentOpex, hrLabor, pettyCash]);

  // For historic chart
  const historicChartData = useMemo(
    () =>
      monthlyActual.map((m) => ({
        label: m.label,
        cashIn: m.salesIn,
        cashOut:
          m.purchasesOut + m.rentOut + m.laborOut + m.pettyOut,
        netCash: m.netCash,
      })),
    [monthlyActual]
  );

  const historicTotals = useMemo(() => {
    let sumIn = 0;
    let sumOut = 0;
    monthlyActual.forEach((m) => {
      sumIn += m.salesIn;
      sumOut += m.purchasesOut + m.rentOut + m.laborOut + m.pettyOut;
    });
    return {
      totalIn: sumIn,
      totalOut: sumOut,
      net: sumIn - sumOut,
      months: monthlyActual.length,
    };
  }, [monthlyActual]);

  // -------- Forecast calculation --------
  const forecastInfo = useMemo(() => {
    const result = {
      forecastRows: [],
      worstBalance: null,
      crunchCount: 0,
      firstCrunchLabel: null,
    };

    if (
      monthlyActual.length === 0 ||
      lookbackMonths <= 0 ||
      forecastMonths <= 0
    ) {
      return result;
    }

    const lastActual = monthlyActual[monthlyActual.length - 1];

    // Lookback slice (last X months, or fewer if not enough)
    const lookbackList = monthlyActual.slice(
      Math.max(0, monthlyActual.length - lookbackMonths)
    );
    if (lookbackList.length === 0) return result;

    let sumSales = 0;
    let sumPurch = 0;
    let sumRent = 0;
    let sumLabor = 0;
    let sumPetty = 0;

    lookbackList.forEach((m) => {
      sumSales += m.salesIn;
      sumPurch += m.purchasesOut;
      sumRent += m.rentOut;
      sumLabor += m.laborOut;
      sumPetty += m.pettyOut;
    });

    const divisor = lookbackList.length;
    const avgSales = sumSales / divisor;
    const avgPurch = sumPurch / divisor;
    const avgRent = sumRent / divisor;
    const avgLabor = sumLabor / divisor;
    const avgPetty = sumPetty / divisor;

    const lastDate = parseMonthKey(lastActual.monthKey);

    let runningBalance = Number(currentBalance || 0);
    let worstBalance = runningBalance;
    let crunchCount = 0;
    let firstCrunchLabel = null;
    const buffer = Number(minBuffer || 0);

    const rows = [];

    for (let i = 1; i <= forecastMonths; i += 1) {
      const d = new Date(lastDate);
      d.setMonth(d.getMonth() + i);

      const monthKey = monthKeyFromDate(d);
      const label = monthLabelFromDate(d);

      const salesIn = avgSales;
      const purchasesOut = avgPurch;
      const rentOut = avgRent;
      const laborOut = avgLabor;
      const pettyOut = avgPetty;

      const totalOut =
        purchasesOut + rentOut + laborOut + pettyOut;
      const netCash = salesIn - totalOut;

      runningBalance += netCash;
      if (runningBalance < worstBalance) {
        worstBalance = runningBalance;
      }

      const isCrunch = runningBalance < buffer;
      if (isCrunch) {
        crunchCount += 1;
        if (!firstCrunchLabel) {
          firstCrunchLabel = label;
        }
      }

      rows.push({
        monthKey,
        label,
        salesIn,
        purchasesOut,
        rentOut,
        laborOut,
        pettyOut,
        netCash,
        balanceAfter: runningBalance,
        isCrunch,
      });
    }

    result.forecastRows = rows;
    result.worstBalance = worstBalance;
    result.crunchCount = crunchCount;
    result.firstCrunchLabel = firstCrunchLabel;

    return result;
  }, [
    monthlyActual,
    lookbackMonths,
    forecastMonths,
    currentBalance,
    minBuffer,
  ]);

  const { forecastRows, worstBalance, crunchCount, firstCrunchLabel } =
    forecastInfo;

  const forecastNetChartData = useMemo(() => {
    if (monthlyActual.length === 0 && forecastRows.length === 0) return [];
    const data = [];

    monthlyActual.forEach((m) => {
      data.push({
        label: m.label,
        netActual: m.netCash,
        netForecast: null,
      });
    });

    forecastRows.forEach((f) => {
      data.push({
        label: f.label,
        netActual: null,
        netForecast: f.netCash,
      });
    });

    return data;
  }, [monthlyActual, forecastRows]);

  const forecastBalanceChartData = useMemo(
    () =>
      forecastRows.map((f) => ({
        label: f.label,
        balance: f.balanceAfter,
      })),
    [forecastRows]
  );

  // -------- Render helpers --------
  const subTabButtonStyle = (isActive) => ({
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid #c7d2fe",
    backgroundColor: isActive ? "#e0e7ff" : "#ffffff",
    cursor: "pointer",
    fontSize: 13,
  });

  const renderHistoric = () => (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Historic Cash Flow (Actuals)</h3>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          Monthly view of cash in (net sales) vs cash out (suppliers, rent,
          payroll, petty cash). Net cash shows whether you were cash-positive
          or negative each month.
        </p>

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
              Months with data
            </div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              {historicTotals.months}
            </div>
          </div>
          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Total cash in (sales)
            </div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              {formatMoney(historicTotals.totalIn)} JOD
            </div>
          </div>
          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Total cash out
            </div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              {formatMoney(historicTotals.totalOut)} JOD
            </div>
          </div>
          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Net cash (in - out)
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color:
                  historicTotals.net >= 0 ? "#166534" : "#b91c1c",
              }}
            >
              {formatMoney(historicTotals.net)} JOD
            </div>
          </div>
        </div>

        <div style={{ height: 320, marginTop: 16 }}>
          {historicChartData.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              No cash-flow data yet. Enter sales, purchases, rent/opex, HR, and
              petty cash in the Data Entry Hub.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="cashIn"
                  name="Cash in (sales)"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="cashOut"
                  name="Cash out (suppliers, rent, HR, petty)"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="netCash"
                  name="Net cash"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );

  const renderForecast = () => (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Cash Flow Forecast</h3>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          Uses the last{" "}
          <strong>{lookbackMonths}</strong> month(s) pattern for sales, rent,
          payroll and suppliers to project the next{" "}
          <strong>{forecastMonths}</strong> month(s). Cash crunch months are
          highlighted when projected balance drops below your minimum buffer.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 10,
          }}
        >
          <div>
            <label
              style={{ display: "block", fontSize: 12, marginBottom: 4 }}
            >
              Lookback window (months)
            </label>
            <select
              value={lookbackMonths}
              onChange={(e) =>
                setLookbackMonths(Number(e.target.value) || 1)
              }
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 13,
              }}
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </div>

          <div>
            <label
              style={{ display: "block", fontSize: 12, marginBottom: 4 }}
            >
              Forecast horizon (months)
            </label>
            <select
              value={forecastMonths}
              onChange={(e) =>
                setForecastMonths(Number(e.target.value) || 1)
              }
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 13,
              }}
            >
              <option value={3}>Next 3 months</option>
              <option value={6}>Next 6 months</option>
              <option value={9}>Next 9 months</option>
              <option value={12}>Next 12 months</option>
            </select>
          </div>

          <div>
            <label
              style={{ display: "block", fontSize: 12, marginBottom: 4 }}
            >
              Current cash balance (JOD)
            </label>
            <input
              type="number"
              step="1"
              value={currentBalance}
              onChange={(e) =>
                setCurrentBalance(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
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

          <div>
            <label
              style={{ display: "block", fontSize: 12, marginBottom: 4 }}
            >
              Minimum cash buffer (JOD)
            </label>
            <input
              type="number"
              step="1"
              value={minBuffer}
              onChange={(e) =>
                setMinBuffer(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
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
        </div>

        <div
          className="kpi-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Forecast months
            </div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              {forecastRows.length}
            </div>
          </div>

          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Starting cash balance
            </div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              {formatMoney(currentBalance || 0)} JOD
            </div>
          </div>

          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Worst projected balance
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color:
                  worstBalance !== null && worstBalance < (minBuffer || 0)
                    ? "#b91c1c"
                    : "#111827",
              }}
            >
              {worstBalance === null
                ? "—"
                : `${formatMoney(worstBalance)} JOD`}
            </div>
          </div>

          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Months below buffer
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: crunchCount > 0 ? "#b91c1c" : "#166534",
              }}
            >
              {crunchCount}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              {firstCrunchLabel
                ? `First crunch: ${firstCrunchLabel}`
                : "No crunch projected in horizon"}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Net Cash: Actual vs Forecast</h3>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          Visual comparison of historic net cash (actuals) and projected net
          cash (forecast). Use this to see if the business is consistently
          cash-negative and how long your runway is.
        </p>

        <div style={{ height: 300, marginTop: 10 }}>
          {forecastNetChartData.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Not enough data to build a forecast. Enter at least one month of
              historic cash-flow data.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastNetChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="netActual"
                  name="Net cash (actual)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="netForecast"
                  name="Net cash (forecast)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Projected Cash Balance</h3>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          Running cash balance over the forecast horizon, starting from your
          current cash balance. Months below the minimum buffer should trigger
          actions (rent renegotiation, capex delay, cost cuts, or funding).
        </p>

        <div style={{ height: 260, marginTop: 10 }}>
          {forecastBalanceChartData.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              No forecast points yet. Check your settings and confirm that you
              have some historic data.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastBalanceChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="Projected balance"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="table-wrapper" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Sales in</th>
                <th>Suppliers out</th>
                <th>Rent &amp; Opex out</th>
                <th>Labor out</th>
                <th>Petty out</th>
                <th>Net cash</th>
                <th>Balance after month</th>
              </tr>
            </thead>
            <tbody>
              {forecastRows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    No forecast rows. Update your settings or add historic
                    data.
                  </td>
                </tr>
              ) : (
                forecastRows.map((f) => (
                  <tr
                    key={f.monthKey}
                    style={
                      f.isCrunch
                        ? { backgroundColor: "#fee2e2" }
                        : undefined
                    }
                  >
                    <td>{f.label}</td>
                    <td>{formatMoney(f.salesIn)}</td>
                    <td>{formatMoney(f.purchasesOut)}</td>
                    <td>{formatMoney(f.rentOut)}</td>
                    <td>{formatMoney(f.laborOut)}</td>
                    <td>{formatMoney(f.pettyOut)}</td>
                    <td
                      style={{
                        color:
                          f.netCash >= 0 ? "#166534" : "#b91c1c",
                      }}
                    >
                      {formatMoney(f.netCash)}
                    </td>
                    <td
                      style={{
                        fontWeight: 600,
                        color:
                          f.balanceAfter < (minBuffer || 0)
                            ? "#b91c1c"
                            : "#111827",
                      }}
                    >
                      {formatMoney(f.balanceAfter)} JOD
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
          Tips:
          <br />
          • Use the forecast to test rent decisions, new branches, or capex
          timing by adjusting your starting balance / buffer.
          <br />
          • Combine this with Scenario Planning to overlay different sales and
          cost assumptions.
        </p>
      </div>
    </>
  );

  // -------- Main render --------
  return (
    <div>
      <h2 className="page-title">Cash Flow</h2>
      <p className="page-subtitle">
        Track historic cash movements and project future cash position based on
        your recent pattern of sales, suppliers, rent, payroll, and petty cash.
      </p>

      <div
        className="card"
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={subTabButtonStyle(mode === "historic")}
            onClick={() => setMode("historic")}
          >
            Historic (Actuals)
          </button>
          <button
            type="button"
            style={subTabButtonStyle(mode === "forecast")}
            onClick={() => setMode("forecast")}
          >
            Forecast (Next Months)
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Data sources: <strong>Sales</strong> (pc_sales),{" "}
          <strong>Purchases</strong> (pc_purchases),{" "}
          <strong>Rent &amp; Opex</strong> (pc_rent_opex),{" "}
          <strong>HR / Labor</strong> (pc_hr_labor),{" "}
          <strong>Petty Cash</strong> (pc_petty_cash).
        </div>
      </div>

      {mode === "historic" ? renderHistoric() : renderForecast()}
    </div>
  );
}

export default CashFlowHub;
