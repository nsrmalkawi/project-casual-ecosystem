// src/features/dashboard/ExecutiveDashboard.jsx
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { loadData } from "../../utils/storage";
import { useData } from "../../DataContext";

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function percent(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0%";
  return (num * 100).toFixed(1) + "%";
}

function monthKey(dateStr) {
  if (!dateStr || typeof dateStr !== "string" || dateStr.length < 7) return null;
  return dateStr.slice(0, 7); // YYYY-MM
}

function buildMonthsHorizon() {
  const arr = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const copy = new Date(d);
    copy.setMonth(copy.getMonth() - i);
    const key = `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, "0")}`;
    arr.push({
      key,
      label: copy.toLocaleString("default", { month: "short" }),
      sales: 0,
      cogs: 0,
      labor: 0,
      rent: 0,
      petty: 0,
    });
  }
  return arr;
}

function ExecutiveDashboard() {
  const [sales] = useState(() => loadData("pc_sales", []) || []);
  const [purchases] = useState(() => loadData("pc_purchases", []) || []);
  const [rentOpex] = useState(() => loadData("pc_rent_opex", []) || []);
  const [hr] = useState(() => loadData("pc_hr_labor", []) || []);
  const [pettyCash] = useState(() => loadData("pc_petty_cash", []) || []);

  const { brandFilter, outletFilter, startDate, endDate } = useData();

  const passesFilters = (row) => {
    if (!row) return false;
    if (brandFilter && row.brand && row.brand !== brandFilter) return false;
    if (outletFilter && row.outlet && row.outlet !== outletFilter) return false;
    if (startDate && row.date && row.date < startDate) return false;
    if (endDate && row.date && row.date > endDate) return false;
    return true;
  };

  const filtered = useMemo(() => {
    return {
      sales: sales.filter(passesFilters),
      purchases: purchases.filter(passesFilters),
      rentOpex: rentOpex.filter(passesFilters),
      hr: hr.filter(passesFilters),
      pettyCash: pettyCash.filter(passesFilters),
    };
  }, [sales, purchases, rentOpex, hr, pettyCash, brandFilter, outletFilter, startDate, endDate]);

  const totals = useMemo(() => {
    const totalSales = filtered.sales.reduce((s, r) => s + (Number(r.netSales) || 0), 0);
    const totalCogs = filtered.purchases.reduce((s, r) => s + (Number(r.totalCost) || 0), 0);
    const totalLabor = filtered.hr.reduce((s, r) => s + (Number(r.laborCost) || 0), 0);
    const totalRent = filtered.rentOpex.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalPetty = filtered.pettyCash.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const ebitda = totalSales - totalCogs - totalLabor - totalRent - totalPetty;
    return {
      totalSales,
      totalCogs,
      totalLabor,
      totalRent,
      totalPetty,
      ebitda,
      cogsPct: totalSales ? totalCogs / totalSales : 0,
      laborPct: totalSales ? totalLabor / totalSales : 0,
      rentPct: totalSales ? totalRent / totalSales : 0,
      ebitdaMargin: totalSales ? ebitda / totalSales : 0,
    };
  }, [filtered]);

  const monthly = useMemo(() => {
    const horizon = buildMonthsHorizon();
    const byKey = Object.fromEntries(horizon.map((m) => [m.key, m]));
    const add = (rows, field, target) => {
      rows.forEach((r) => {
        const key = monthKey(r.date);
        if (!key || !byKey[key]) return;
        const val = Number(r[field]) || 0;
        byKey[key][target] += val;
      });
    };
    add(filtered.sales, "netSales", "sales");
    add(filtered.purchases, "totalCost", "cogs");
    add(filtered.hr, "laborCost", "labor");
    add(filtered.rentOpex, "amount", "rent");
    add(filtered.pettyCash, "amount", "petty");
    return horizon;
  }, [filtered]);

  const insights = useMemo(() => {
    const list = [];
    if (totals.cogsPct > 0.35) list.push("Food cost is above 35% of sales. Check supplier terms and waste.");
    if (totals.laborPct > 0.30) list.push("Labor is above 30% of sales. Review scheduling and overtime.");
    if (totals.rentPct > 0.18) list.push("Rent/Opex exceeds 18% of sales. Consider renegotiation or outlet mix.");
    if (totals.ebitdaMargin < 0.1) list.push("EBITDA margin is thin. Combine menu engineering and cost actions.");
    if (list.length === 0) list.push("Metrics are within typical thresholds. Keep monitoring weekly.");
    return list;
  }, [totals]);

  const navigateTo = (tab) => {
    window.dispatchEvent(new CustomEvent("pc:navigate", { detail: tab }));
  };

  const cards = [
    {
      title: "Net Sales",
      value: money(totals.totalSales),
      sub: `${percent(totals.ebitdaMargin)} EBITDA margin`,
      gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
    },
    {
      title: "COGS / Food",
      value: money(totals.totalCogs),
      sub: `${percent(totals.cogsPct)} of sales`,
      gradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
    },
    {
      title: "Labor",
      value: money(totals.totalLabor),
      sub: `${percent(totals.laborPct)} of sales`,
      gradient: "linear-gradient(135deg, #f97316, #ea580c)",
    },
    {
      title: "Rent & Opex",
      value: money(totals.totalRent),
      sub: `${percent(totals.rentPct)} of sales`,
      gradient: "linear-gradient(135deg, #0ea5e9, #0284c7)",
    },
    {
      title: "Petty Cash",
      value: money(totals.totalPetty),
      sub: "Misc. outflows",
      gradient: "linear-gradient(135deg, #ec4899, #db2777)",
    },
    {
      title: "EBITDA (approx)",
      value: money(totals.ebitda),
      sub: "Sales - COGS - Labor - Rent - Petty",
      gradient: "linear-gradient(135deg, #a855f7, #7c3aed)",
    },
  ];

  return (
    <div className="card" style={{ border: "none", padding: 0 }}>
      <div
        style={{
          padding: 20,
          background: "linear-gradient(120deg, #0ea5e9 0%, #6366f1 60%, #22c55e 100%)",
          color: "#fff",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24 }}>Executive Dashboard</h2>
        <p style={{ margin: "6px 0 0", maxWidth: 780 }}>
          Filter-aware snapshot across sales, COGS, labor, rent, and petty cash. Data comes from your local entries (or cloud sync) and reflects the current brand/outlet/date filters.
        </p>
      </div>

      <div style={{ padding: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {cards.map((c) => (
            <div
              key={c.title}
              style={{
                padding: 14,
                borderRadius: 12,
                color: "#fff",
                background: c.gradient,
                boxShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.9 }}>{c.title}</div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
                {c.value} JOD
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
          }}
        >
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4 style={{ margin: 0 }}>6-month trend</h4>
                <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
                  Net sales vs key outflows (filtered)
                </p>
              </div>
              <span style={{ fontSize: 12, color: "#475569" }}>JOD</span>
            </div>
            <div style={{ height: 260, marginTop: 6 }}>
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sales" name="Sales" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cogs" name="COGS" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="labor" name="Labor" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rent" name="Rent/Opex" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <h4 style={{ margin: "0 0 6px" }}>Signals</h4>
            <p style={{ margin: "0 0 10px", color: "#6b7280", fontSize: 13 }}>
              Quick reads based on thresholds and your filtered data.
            </p>
            <ul style={{ paddingLeft: 16, margin: 0, display: "grid", gap: 6 }}>
              {insights.map((msg, idx) => (
                <li key={idx} style={{ fontSize: 13, color: "#0f172a" }}>
                  {msg}
                </li>
              ))}
            </ul>
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              }}
            >
              <button
                type="button"
                className="primary-btn"
                onClick={() => navigateTo("reports")}
              >
                Open Reports & KPIs
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigateTo("action-plan")}
              >
                Jump to Action Plan
              </button>
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            marginTop: 14,
            padding: 14,
            background: "#0f172a",
            color: "#e5e7eb",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>EBITDA margin</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{percent(totals.ebitdaMargin)}</div>
            </div>
            <div style={{ height: 40, borderLeft: "1px solid rgba(255,255,255,0.1)" }} />
            <div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>COGS + Labor</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>
                {percent(totals.cogsPct + totals.laborPct)}
              </div>
            </div>
            <div style={{ height: 40, borderLeft: "1px solid rgba(255,255,255,0.1)" }} />
            <div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>Rent &amp; Opex</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{percent(totals.rentPct)}</div>
            </div>
            <div style={{ flexGrow: 1 }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigateTo("cash-flow")}
              >
                View Cash Flow
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigateTo("menu")}
              >
                Menu Engineering
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigateTo("scenario")}
              >
                Scenario Planning
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExecutiveDashboard;
