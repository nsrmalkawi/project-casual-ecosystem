// src/features/suppliers/SupplierPerformanceHub.jsx
import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function safeNumber(v) {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
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

function SupplierPerformanceHub() {
  const [purchases, setPurchases] = useState([]);
  const [brandFilter, setBrandFilter] = useState("all");
  const [outletFilter, setOutletFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priceAlertThreshold, setPriceAlertThreshold] = useState(10); // % increase

  useEffect(() => {
    setPurchases(loadArray("pc_purchases"));
  }, []);

  const allBrands = useMemo(() => {
    const s = new Set();
    purchases.forEach((r) => r?.brand && s.add(r.brand));
    return Array.from(s);
  }, [purchases]);

  const allOutlets = useMemo(() => {
    const s = new Set();
    purchases.forEach((r) => r?.outlet && s.add(r.outlet));
    return Array.from(s);
  }, [purchases]);

  const inDateRange = (d) => {
    if (!d) return false;
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  const filtered = useMemo(() => {
    const brandOk = (r) =>
      !brandFilter || brandFilter === "all" || r.brand === brandFilter;
    const outletOk = (r) =>
      !outletFilter || outletFilter === "all" || r.outlet === outletFilter;

    return purchases.filter((r) => {
      if (!r) return false;
      if (!brandOk(r)) return false;
      if (!outletOk(r)) return false;
      if (startDate || endDate) {
        if (!r.date || !inDateRange(r.date)) return false;
      }
      return true;
    });
  }, [purchases, brandFilter, outletFilter, startDate, endDate]);

  // -------- Supplier aggregates ----------
  const supplierRows = useMemo(() => {
    const map = {};
    let totalSpend = 0;

    filtered.forEach((r) => {
      const supplier =
        r.supplier || r.vendor || r.Supplier || r.Vendor || "Unknown";
      const amount = safeNumber(
        r.totalCost ?? r.amount ?? r.value ?? r.total ?? 0
      );

      totalSpend += amount;

      if (!map[supplier]) {
        map[supplier] = {
          supplier,
          totalSpend: 0,
          lines: 0,
          brands: new Set(),
          outlets: new Set(),
        };
      }

      map[supplier].totalSpend += amount;
      map[supplier].lines += 1;
      if (r.brand) map[supplier].brands.add(r.brand);
      if (r.outlet) map[supplier].outlets.add(r.outlet);
    });

    const rows = Object.values(map).map((s) => {
      const share =
        totalSpend > 0 ? (s.totalSpend / totalSpend) * 100 : 0;
      return {
        supplier: s.supplier,
        totalSpend: s.totalSpend,
        lines: s.lines,
        share,
        brandCount: s.brands.size,
        outletCount: s.outlets.size,
        brandsLabel:
          s.brands.size > 0 ? Array.from(s.brands).join(", ") : "—",
        outletsLabel:
          s.outlets.size > 0 ? Array.from(s.outlets).join(", ") : "—",
      };
    });

    rows.sort((a, b) => b.totalSpend - a.totalSpend);
    return { rows, totalSpend };
  }, [filtered]);

  // -------- Top 10 items (by spend) ----------
  const topItems = useMemo(() => {
    const map = {};

    filtered.forEach((r) => {
      const itemName =
        r.item ||
        r.itemName ||
        r.ingredient ||
        r.product ||
        r.description ||
        "";
      if (!itemName) return;

      const supplier =
        r.supplier || r.vendor || r.Supplier || r.Vendor || "Unknown";
      const amount = safeNumber(
        r.totalCost ?? r.amount ?? r.value ?? r.total ?? 0
      );

      const key = `${itemName}__${supplier}`;
      if (!map[key]) {
        map[key] = {
          itemName,
          supplier,
          totalSpend: 0,
          lines: 0,
        };
      }

      map[key].totalSpend += amount;
      map[key].lines += 1;
    });

    const rows = Object.values(map);
    rows.sort((a, b) => b.totalSpend - a.totalSpend);
    return rows.slice(0, 10);
  }, [filtered]);

  // -------- Price trend & alerts ----------
  const priceAlerts = useMemo(() => {
    const groups = {};

    const monthFromDate = (d) =>
      d && d.length >= 7 ? d.slice(0, 7) : "";

    filtered.forEach((r) => {
      const date = r.date;
      const ym = monthFromDate(date);
      if (!ym) return;

      const supplier =
        r.supplier || r.vendor || r.Supplier || r.Vendor || "Unknown";
      const itemName =
        r.item ||
        r.itemName ||
        r.ingredient ||
        r.product ||
        r.description ||
        "";
      if (!itemName) return;

      const qty = safeNumber(
        r.qty ?? r.quantity ?? r.units ?? r.qtyPurchased ?? 0
      );
      let unitCost = 0;
      if (qty > 0) {
        const amount = safeNumber(
          r.totalCost ?? r.amount ?? r.value ?? r.total ?? 0
        );
        unitCost = amount / qty;
      } else {
        unitCost = safeNumber(r.unitCost ?? 0);
      }
      if (unitCost <= 0) return;

      const key = `${supplier}__${itemName}`;
      if (!groups[key]) {
        groups[key] = {
          supplier,
          itemName,
          months: {},
        };
      }
      if (!groups[key].months[ym]) {
        groups[key].months[ym] = {
          ym,
          sumUnitCost: 0,
          count: 0,
        };
      }

      groups[key].months[ym].sumUnitCost += unitCost;
      groups[key].months[ym].count += 1;
    });

    const alerts = [];
    Object.values(groups).forEach((g) => {
      const monthsArr = Object.values(g.months).sort((a, b) =>
        a.ym.localeCompare(b.ym)
      );
      if (monthsArr.length < 2) return;

      for (let i = 1; i < monthsArr.length; i++) {
        const prev = monthsArr[i - 1];
        const curr = monthsArr[i];

        const prevAvg = prev.sumUnitCost / prev.count;
        const currAvg = curr.sumUnitCost / curr.count;
        if (prevAvg <= 0) continue;

        const changePct = ((currAvg - prevAvg) / prevAvg) * 100;
        if (changePct >= priceAlertThreshold) {
          alerts.push({
            supplier: g.supplier,
            itemName: g.itemName,
            prevMonth: prev.ym,
            currMonth: curr.ym,
            prevAvg,
            currAvg,
            changePct,
          });
        }
      }
    });

    alerts.sort((a, b) => b.changePct - a.changePct);
    return alerts;
  }, [filtered, priceAlertThreshold]);

  // -------- Chart data (Top suppliers by spend) ----------
  const chartData = useMemo(() => {
    const top = supplierRows.rows.slice(0, 8);
    return top.map((s) => ({
      supplier: s.supplier,
      Spend: s.totalSpend,
    }));
  }, [supplierRows]);

  const formatMoney = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "JOD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v || 0);

  const formatPct = (v) => `${(v || 0).toFixed(1)}%`;

  return (
    <div>
      <h2 className="page-title">Suppliers &amp; Purchasing</h2>
      <p className="page-subtitle">
        Analyze total spend, supplier concentration, and price trends. Use this
        view for negotiations and switching to cheaper or more reliable sources.
      </p>

      {/* Filters */}
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

        <div style={{ minWidth: 150 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Start date
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

        <div style={{ minWidth: 150 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            End date
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

      {/* Summary & top suppliers */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Supplier overview</h3>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          Total purchasing spend and concentration under the current filters.
        </p>

        <div
          className="kpi-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Total purchases (filtered)
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {formatMoney(supplierRows.totalSpend)}
            </div>
          </div>

          <div className="kpi-tile">
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Number of suppliers
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {supplierRows.rows.length}
            </div>
          </div>

          {supplierRows.rows[0] && (
            <div className="kpi-tile">
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Largest supplier share
              </div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {supplierRows.rows[0].supplier}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {formatPct(supplierRows.rows[0].share)} of total spend
              </div>
            </div>
          )}
        </div>

        <div style={{ height: 260, marginTop: 16 }}>
          {chartData.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              No purchasing data available for the selected filters.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="supplier" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Spend" name="Total spend (JOD)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Supplier table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Suppliers breakdown</h3>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          Shows total spend by supplier, number of lines, and coverage across
          brands/outlets.
        </p>
        <div className="table-wrapper" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Total spend</th>
                <th>Share of total</th>
                <th>Lines</th>
                <th>Brands</th>
                <th>Outlets</th>
              </tr>
            </thead>
            <tbody>
              {supplierRows.rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    No purchasing data for the selected filters.
                  </td>
                </tr>
              ) : (
                supplierRows.rows.map((row) => (
                  <tr key={row.supplier}>
                    <td>{row.supplier}</td>
                    <td>{formatMoney(row.totalSpend)}</td>
                    <td>{formatPct(row.share)}</td>
                    <td>{row.lines}</td>
                    <td>{row.brandsLabel}</td>
                    <td>{row.outletsLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 10 items by spend */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Top 10 items by spend</h3>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          Items with the highest purchasing spend (requires item-level fields in
          your purchases data such as item/itemName/ingredient).
        </p>
        <div className="table-wrapper" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Supplier</th>
                <th>Total spend</th>
                <th>Lines</th>
              </tr>
            </thead>
            <tbody>
              {topItems.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    No item-level data found in purchases. Once you add
                    item/itemName on purchase entries, this table will populate.
                  </td>
                </tr>
              ) : (
                topItems.map((row, idx) => (
                  <tr key={`${row.supplier}__${row.itemName}__${idx}`}>
                    <td>{row.itemName}</td>
                    <td>{row.supplier}</td>
                    <td>{formatMoney(row.totalSpend)}</td>
                    <td>{row.lines}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Price alerts */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h3 className="card-title">Price change alerts</h3>
          <div style={{ fontSize: 12, display: "flex", alignItems: "center" }}>
            <span style={{ marginRight: 6 }}>Alert if increase ≥</span>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={priceAlertThreshold}
              onChange={(e) =>
                setPriceAlertThreshold(
                  Math.max(1, Math.min(100, Number(e.target.value) || 1))
                )
              }
              style={{
                width: 60,
                padding: "4px 6px",
                borderRadius: 4,
                border: "1px solid #d1d5db",
                fontSize: 12,
                marginRight: 4,
              }}
            />
            <span>% vs previous month</span>
          </div>
        </div>

        <p style={{ fontSize: 13, marginTop: 4 }}>
          Flags items where average unit cost increased more than the selected
          threshold compared to the previous month. Requires dates, quantities,
          and unitCost or totalCost+qty.
        </p>

        <div className="table-wrapper" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Item</th>
                <th>From month</th>
                <th>To month</th>
                <th>Prev avg unit cost</th>
                <th>Curr avg unit cost</th>
                <th>Change %</th>
              </tr>
            </thead>
            <tbody>
              {priceAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    No price increases above threshold detected (or insufficient
                    data). Once you have monthly data with qty and unit cost,
                    alerts will appear here.
                  </td>
                </tr>
              ) : (
                priceAlerts.map((a, idx) => (
                  <tr key={`${a.supplier}__${a.itemName}__${idx}`}>
                    <td>{a.supplier}</td>
                    <td>{a.itemName}</td>
                    <td>{a.prevMonth}</td>
                    <td>{a.currMonth}</td>
                    <td>{a.prevAvg.toFixed(3)}</td>
                    <td>{a.currAvg.toFixed(3)}</td>
                    <td
                      style={{
                        color: "#b91c1c",
                        fontWeight: 600,
                      }}
                    >
                      {a.changePct.toFixed(1)}%
                    </td>
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

export default SupplierPerformanceHub;
