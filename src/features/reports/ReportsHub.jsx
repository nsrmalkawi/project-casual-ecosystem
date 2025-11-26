// src/features/reports/ReportsHub.jsx
import { useMemo, useState, useRef, useEffect } from "react";
import { marked } from "marked";
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
import { useData } from "../../DataContext";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== "undefined" ? window.location.origin : "");

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function percent(n) {
  if (!Number.isFinite(n)) return "0.0%";
  return (n * 100).toFixed(1) + "%";
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function renderMarkdown(md) {
  if (!md) return "";
  marked.setOptions({
    mangle: false,
    headerIds: false,
  });
  return marked.parse(md);
}

function printHtml(html) {
  const printWindow = window.open("", "_blank", "width=900,height=1200");
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>AI Report</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; padding: 16px; color: #0f172a; }
          h2, h3, h4 { margin: 6px 0; }
          .section { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: #f8fafc; }
          pre { white-space: pre-wrap; margin: 0; font-size: 13px; line-height: 1.4; }
        </style>
      </head>
      <body>
        <h2>AI Report</h2>
        ${html}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
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

  // NEW: live summaries from backend reports endpoints
  const [liveSummaries, setLiveSummaries] = useState({
    sales: null,
    purchases: null,
    waste: null,
    hr: null,
    rent: null,
    petty: null,
    inventory: null,
  });
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");

  // --------- Filters (global) ---------
  const {
    brandFilter,
    setBrandFilter,
    outletFilter,
    setOutletFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  } = useData();

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

  // NEW: helper to render a live summary tile
  const LiveTile = ({ title, value, sub, loading }) => (
    <div className="card" style={{ padding: 12, minHeight: 90 }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>
        {loading ? "..." : money(value)}
      </div>
      {sub && <div style={{ fontSize: 12, color: "#6b7280" }}>{sub}</div>}
    </div>
  );

  // NEW: fetch cloud summaries using current filters
  useEffect(() => {
    if (!API_BASE) return;
    const controller = new AbortController();
    async function load() {
      setLiveLoading(true);
      setLiveError("");
      const qs = new URLSearchParams();
      if (startDate) qs.set("from", startDate);
      if (endDate) qs.set("to", endDate);
      if (brandFilter) qs.set("brand", brandFilter);
      if (outletFilter) qs.set("outlet", outletFilter);
      const fetchOne = async (key, path) => {
        try {
          const resp = await fetch(`${API_BASE}${path}?${qs.toString()}`, {
            signal: controller.signal,
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          return data;
        } catch (e) {
          throw new Error(`${key} failed: ${e.message}`);
        }
      };
      try {
        const [salesResp, purchasesResp, wasteResp, hrResp, rentResp, pettyResp, invResp] =
          await Promise.all([
            fetchOne("sales", "/api/reports/sales-summary"),
            fetchOne("purchases", "/api/reports/purchases-summary"),
            fetchOne("waste", "/api/reports/waste-summary"),
            fetchOne("hr", "/api/reports/hr-summary"),
            fetchOne("rent", "/api/reports/rent-opex-summary"),
            fetchOne("petty", "/api/reports/petty-cash-summary"),
            fetchOne("inventory", "/api/reports/inventory-summary"),
          ]);
        setLiveSummaries({
          sales: salesResp?.summary || null,
          purchases: purchasesResp?.summary || null,
          waste: wasteResp?.summary || null,
          hr: hrResp?.summary || null,
          rent: rentResp?.summary || null,
          petty: pettyResp?.summary || null,
          inventory: invResp?.summary || null,
        });
      } catch (err) {
        console.error("Live reports load error", err);
        setLiveError(err.message || "Failed to load reports");
      } finally {
        setLiveLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [brandFilter, outletFilter, startDate, endDate]);

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

  const topBottomOutlets = useMemo(() => {
    const sorted = [...ebitdaByOutlet].sort(
      (a, b) => (b.ebitdaMargin || 0) - (a.ebitdaMargin || 0)
    );
    return {
      top: sorted.slice(0, 3),
      bottom: sorted.slice(-3).reverse(),
    };
  }, [ebitdaByOutlet]);

  // NEW: KPI comparison rows for table/export
  const kpiComparison = useMemo(() => {
    return ebitdaByOutlet.map((row) => {
      const foodPct = row.totalSales ? row.totalFoodCost / row.totalSales : 0;
      const laborPct = row.totalSales ? row.totalLaborCost / row.totalSales : 0;
      return {
        outlet: row.outlet,
        brand: row.brand,
        sales: row.totalSales,
        foodPct,
        laborPct,
        ebitda: row.ebitda,
        ebitdaMargin: row.ebitdaMargin,
      };
    });
  }, [ebitdaByOutlet]);

  function exportKpiCsv() {
    if (!kpiComparison.length) return;
    const header = ["Outlet", "Brand", "Sales", "Food%", "Labor%", "EBITDA", "EBITDA%"];
    const rows = kpiComparison.map((r) => [
      r.outlet,
      r.brand,
      r.sales,
      percent(r.foodPct),
      percent(r.laborPct),
      r.ebitda,
      percent(r.ebitdaMargin),
    ]);
    const csv = [header, ...rows]
      .map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kpi-comparison.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

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
  const [aiCogsStatus, setAiCogsStatus] = useState("idle"); // NEW: COGS AI
  const [aiCogsText, setAiCogsText] = useState("");
  const [aiCogsModel, setAiCogsModel] = useState("");
  const [opsAdvisorOpen, setOpsAdvisorOpen] = useState(false); // NEW: Ops advisor modal
  const [opsAdvisorScope, setOpsAdvisorScope] = useState("sales");
  const [opsAdvisorStatus, setOpsAdvisorStatus] = useState("idle");
  const [opsAdvisorText, setOpsAdvisorText] = useState("");
  const [opsAdvisorModel, setOpsAdvisorModel] = useState("");
  const aiReportRef = useRef(null);
  const [resModel, setResModel] = useState(null);

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

  function handleExportPdf() {
    if (!aiReportRef.current) return;
    printHtml(aiReportRef.current.innerHTML);
  }

  function getReportText() {
    return [aiAnomalyText, aiActionText].filter(Boolean).join("\n\n");
  }

  async function handleCopyText() {
    const text = getReportText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      alert("AI report copied to clipboard.");
    } catch (err) {
      console.error("Copy failed", err);
    }
  }

  function handleDownloadMd() {
    const text = getReportText();
    if (!text) return;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ai-report.md";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleRunAnomalyScan() {
    if (!aiPayload) return;
    setAiError(null);
    setAiAnomalyStatus("loading");
    try {
      const res = await callAi({
        mode: "anomaly",
        payload: aiPayload,
        question:
          "Return markdown with sections: ## Snapshot (top anomalies), ## Tables (at least one table with Metric | Value | Why it matters), ## Risks, ## Actions (3-5 bullets). Keep it concise with currency/% where relevant.",
      });
      setAiAnomalyText(res.text || "");
      setResModel(res.model || null);
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
        question:
          "Return markdown with sections: ## Snapshot (key gaps), ## Tables (one markdown table with KPI | Target | Current | Gap | Owner suggestion), ## Risks, ## Actions (Quick wins + medium term, 5 bullets total). Keep it concise and F&B oriented.",
      });
      setAiActionText(res.text || "");
      setResModel(res.model || null);
      setAiActionStatus("done");
    } catch (err) {
      console.error("AI action suggestions error:", err);
      setAiError(err.message || "AI action suggestions failed.");
      setAiActionStatus("error");
    }
  }

  // NEW: AI recommendations to reduce COGS
  async function handleCogsRecommendations() {
    if (!aiPayload) return;
    setAiError(null);
    setAiCogsStatus("loading");
    try {
      const res = await callAi({
        mode: "report",
        payload: {
          view: "cogs",
          kpis,
          purchases: filteredPurchases.slice(0, 50),
          waste: filteredWaste.slice(0, 50),
        },
        question:
          "Return markdown with sections: ## Snapshot (COGS and %), ## Tables (at least one with KPI | Value | Comment), ## Risks, ## Actions (Quick Wins, Supplier/Order Tactics, Waste/Portion Controls in 5 bullets). Keep it concise and F&B focused.",
      });
      setAiCogsText(res.text || "");
      setAiCogsModel(res.model || "");
      setAiCogsStatus("done");
    } catch (err) {
      setAiError(err.message || "COGS AI suggestions failed.");
      setAiCogsStatus("error");
    }
  }

  // NEW: Ops advisor (Sales/COGS/Labor/Cashflow)
  async function handleOpsAdvisor() {
    if (!aiPayload) return;
    setAiError(null);
    setOpsAdvisorStatus("loading");
    try {
      const scopePayload = { ...aiPayload, scope: opsAdvisorScope };
      const res = await callAi({
        mode: "report",
        payload: scopePayload,
        question:
          `You are an ops advisor. Scope: ${opsAdvisorScope}. Return markdown with sections: ## Snapshot, ## Tables (at least one markdown table with KPI | Value | Comment), ## Risks, ## Actions (5 bullets). Keep concise, numbers with currency/% where relevant.`,
      });
      setOpsAdvisorText(res.text || "");
      setOpsAdvisorModel(res.model || "");
      setOpsAdvisorStatus("done");
    } catch (err) {
      setAiError(err.message || "Ops advisor failed.");
      setOpsAdvisorStatus("error");
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

      {/* NEW: Live cloud summaries from API (matches Reports Center) */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 className="card-title" style={{ marginBottom: 4 }}>
              Live cloud snapshots
            </h3>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Pulled directly from the backend using your filters. Use this to verify cloud vs local data.
            </p>
          </div>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => window.dispatchEvent(new CustomEvent("pc:navigate", { detail: "reports" }))}
          >
            Open Reports & KPI Center
          </button>
        </div>
        {liveError && (
          <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>{liveError}</div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginTop: 10,
          }}
        >
          <LiveTile
            title="Net sales"
            value={liveSummaries.sales?.netsales || liveSummaries.sales?.netSales}
            sub={brandFilter || outletFilter ? "Filtered scope" : "All data"}
            loading={liveLoading}
          />
          <LiveTile
            title="Purchases"
            value={liveSummaries.purchases?.totalcost || liveSummaries.purchases?.totalCost}
            sub="COGS / suppliers"
            loading={liveLoading}
          />
          <LiveTile
            title="Waste"
            value={liveSummaries.waste?.totalcost || liveSummaries.waste?.totalCost}
            sub="Waste cost"
            loading={liveLoading}
          />
          <LiveTile
            title="Labor cost"
            value={liveSummaries.hr?.laborcost || liveSummaries.hr?.laborCost}
            sub="HR / payroll"
            loading={liveLoading}
          />
          <LiveTile
            title="Rent & opex"
            value={liveSummaries.rent?.amount}
            sub="Operating expenses"
            loading={liveLoading}
          />
          <LiveTile
            title="Petty cash"
            value={liveSummaries.petty?.amount}
            sub="Petty & misc"
            loading={liveLoading}
          />
          <LiveTile
            title="Inventory items"
            value={liveSummaries.inventory?.itemcount || liveSummaries.inventory?.itemCount}
            sub="Active SKUs"
            loading={liveLoading}
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

          <button
            type="button"
            className="secondary-btn"
            onClick={handleCogsRecommendations}
            disabled={aiCogsStatus === "loading"}
          >
            {aiCogsStatus === "loading"
              ? "Reducing COGS..."
              : "AI: Reduce COGS"}
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              setOpsAdvisorOpen(true);
              setOpsAdvisorStatus("idle");
              setOpsAdvisorText("");
            }}
          >
            AI Ops advisor
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={handleExportPdf}
            disabled={!aiAnomalyText && !aiActionText}
          >
            Export AI report (PDF)
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={handleCopyText}
            disabled={!aiAnomalyText && !aiActionText}
          >
            Copy as text
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={handleDownloadMd}
            disabled={!aiAnomalyText && !aiActionText}
          >
            Download .md
          </button>
        </div>

        <div ref={aiReportRef}>
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
            <details open style={{ marginBottom: 8 }} className="section">
              <summary
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 4,
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                Anomalies & red flags
              </summary>
              <div
                className="ai-output-box"
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 8,
                  maxHeight: 220,
                  overflowY: "auto",
                  backgroundColor: "#eef2ff",
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(aiAnomalyText) }}
              />
              {resModel && (
                <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                  Generated by {resModel}
                </div>
              )}
            </details>
          )}

          {aiActionText && (
            <details open className="section">
              <summary
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 4,
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                Suggested action plan
              </summary>
              <div
                className="ai-output-box"
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 8,
                  maxHeight: 260,
                  overflowY: "auto",
                  backgroundColor: "#f1f5f9",
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(aiActionText) }}
              />
              {resModel && (
                <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                  Generated by {resModel}
                </div>
              )}
            </details>
          )}

      {aiCogsText && (
        <details open className="section">
          <summary
            style={{
              fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 4,
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                COGS reduction ideas
              </summary>
              <div
                className="ai-output-box"
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 8,
                  maxHeight: 240,
                  overflowY: "auto",
                  backgroundColor: "#f1f5f9",
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(aiCogsText) }}
              />
              {aiCogsModel && (
                <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                  Generated by {aiCogsModel}
                </div>
              )}
            </details>
          )}

          {opsAdvisorOpen && (
            <div
              className="card"
              style={{
                marginTop: 12,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <h3 className="card-title" style={{ marginBottom: 4 }}>
                    AI Ops advisor
                  </h3>
                  <div className="page-subtitle">Choose a scope and get structured advice.</div>
                </div>
                <button type="button" className="secondary-btn" onClick={() => setOpsAdvisorOpen(false)}>
                  Close
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <select
                  value={opsAdvisorScope}
                  onChange={(e) => setOpsAdvisorScope(e.target.value)}
                  style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
                >
                  <option value="sales">Sales</option>
                  <option value="cogs">COGS</option>
                  <option value="labor">Labor</option>
                  <option value="cashflow">Cashflow</option>
                </select>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleOpsAdvisor}
                  disabled={opsAdvisorStatus === "loading"}
                >
                  {opsAdvisorStatus === "loading" ? "Thinking..." : "Generate advice"}
                </button>
                {opsAdvisorText && (
                  <>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(opsAdvisorText);
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        const blob = new Blob([opsAdvisorText], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "ops-advisor.md";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download .md
                    </button>
                  </>
                )}
              </div>
              {opsAdvisorStatus === "loading" && <div style={{ marginTop: 6 }}>Loading...</div>}
              {opsAdvisorText && (
                <div
                  style={{
                    marginTop: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 10,
                    background: "#ffffff",
                    maxHeight: 260,
                    overflowY: "auto",
                    fontSize: 13,
                  }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(opsAdvisorText) }}
                />
              )}
              {opsAdvisorModel && (
                <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                  Model: {opsAdvisorModel}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Alerts summary (simple auto alerts) */}
      <AlertsSummaryBox triggeredAlerts={triggeredAlerts} />

      {/* KPI comparison table */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 className="card-title">Outlet KPI comparison</h3>
            <p className="page-subtitle" style={{ marginTop: 4 }}>
              Sales vs Food% vs Labor% vs EBITDA%. Uses filtered data.
            </p>
          </div>
          <button type="button" className="secondary-btn" onClick={exportKpiCsv} disabled={!kpiComparison.length}>
            Export CSV
          </button>
        </div>
        <div className="table-wrapper" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Outlet</th>
                <th>Brand</th>
                <th>Sales (JOD)</th>
                <th>Food %</th>
                <th>Labor %</th>
                <th>EBITDA (JOD)</th>
                <th>EBITDA %</th>
              </tr>
            </thead>
            <tbody>
              {kpiComparison.length === 0 ? (
                <tr>
                  <td colSpan={7}>No data for current filters.</td>
                </tr>
              ) : (
                kpiComparison.map((r) => (
                  <tr key={r.outlet}>
                    <td>{r.outlet}</td>
                    <td>{r.brand}</td>
                    <td>{r.sales.toFixed(3)}</td>
                    <td>{percent(r.foodPct)}</td>
                    <td>{percent(r.laborPct)}</td>
                    <td>{r.ebitda.toFixed(3)}</td>
                    <td>{percent(r.ebitdaMargin)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outlet comparison mini-cards */}
      {ebitdaByOutlet.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 12,
            marginBottom: 12,
          }}
        >
          {topBottomOutlets.top.map((row) => (
            <div
              key={`top-${row.outlet}`}
              className="card"
              style={{ borderLeft: "4px solid #16a34a" }}
            >
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
                Top EBITDA%
              </div>
              <div style={{ fontWeight: 700 }}>{row.outlet}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>{row.brand}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                EBITDA%: {percent(row.ebitdaMargin)} | Sales:{" "}
                {row.totalSales.toFixed(1)}
              </div>
            </div>
          ))}
          {topBottomOutlets.bottom.map((row) => (
            <div
              key={`bot-${row.outlet}`}
              className="card"
              style={{ borderLeft: "4px solid #dc2626" }}
            >
              <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 700 }}>
                Bottom EBITDA%
              </div>
              <div style={{ fontWeight: 700 }}>{row.outlet}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>{row.brand}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                EBITDA%: {percent(row.ebitdaMargin)} | Sales:{" "}
                {row.totalSales.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      )}

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
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value, name) => {
                    const label = name.includes("EBITDA") ? "EBITDA" : "Sales";
                    return [`${Number(value).toFixed(0)} JOD`, label];
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name="Sales (JOD)"
                  stroke="#4f46e5"
                  strokeWidth={2.4}
                  dot={{ r: 3, stroke: "#4f46e5", fill: "#4f46e5" }}
                  activeDot={{ r: 5, stroke: "#1d4ed8", fill: "#ffffff" }}
                />
                <Line
                  type="monotone"
                  dataKey="ebitda"
                  name="EBITDA (JOD)"
                  stroke="#16a34a"
                  strokeWidth={2.4}
                  dot={{ r: 3, stroke: "#16a34a", fill: "#16a34a" }}
                  activeDot={{ r: 5, stroke: "#15803d", fill: "#ffffff" }}
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
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value, name) => {
                    return [`${Number(value).toFixed(0)} JOD`, name];
                  }}
                />
                <Legend />
                <Bar dataKey="totalSales" name="Sales" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalFoodCost" name="Food cost" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalLaborCost" name="Labor" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ebitda" name="EBITDA" fill="#16a34a" radius={[4, 4, 0, 0]} />
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
