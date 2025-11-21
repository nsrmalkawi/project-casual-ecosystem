// src/features/scenario-planning/ScenarioPlanningHub.jsx
import { useEffect, useMemo, useState } from "react";
import { callAi } from "../../utils/aiClient";

// Helpers
function loadArray(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function computeAggregates(sales, purchases, hr, rentOpex, pettyCash) {
  const totals = {
    sales: 0,
    purchases: 0,
    labor: 0,
    rentOpex: 0,
    pettyCash: 0,
    ebitda: 0,
    foodCostPct: 0,
    laborPct: 0,
    ebitdaPct: 0,
  };

  sales.forEach((s) => {
    totals.sales += Number(s?.netSales ?? 0) || 0;
  });

  purchases.forEach((p) => {
    totals.purchases += Number(p?.totalCost ?? 0) || 0;
  });

  hr.forEach((h) => {
    totals.labor += Number(h?.laborCost ?? 0) || 0;
  });

  rentOpex.forEach((r) => {
    totals.rentOpex += Number(r?.amount ?? 0) || 0;
  });

  pettyCash.forEach((p) => {
    totals.pettyCash += Number(p?.amount ?? 0) || 0;
  });

  totals.ebitda =
    totals.sales -
    totals.purchases -
    totals.labor -
    totals.rentOpex -
    totals.pettyCash;

  if (totals.sales > 0) {
    totals.foodCostPct = totals.purchases / totals.sales;
    totals.laborPct = totals.labor / totals.sales;
    totals.ebitdaPct = totals.ebitda / totals.sales;
  }

  return totals;
}

function ScenarioPlanningHub() {
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [hr, setHr] = useState([]);
  const [rentOpex, setRentOpex] = useState([]);
  const [pettyCash, setPettyCash] = useState([]);

  // Filters (for now: basic date filter)
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Scenario adjustments (% change vs base)
  const [salesChangePct, setSalesChangePct] = useState(0);
  const [foodCostChangePct, setFoodCostChangePct] = useState(0);
  const [laborChangePct, setLaborChangePct] = useState(0);
  const [rentChangePct, setRentChangePct] = useState(0);
  const [pettyChangePct, setPettyChangePct] = useState(0);

  // AI scenario commentary
  const [aiScenarioText, setAiScenarioText] = useState("");
  const [aiScenarioLoading, setAiScenarioLoading] = useState(false);

  const reload = () => {
    setSales(loadArray("pc_sales"));
    setPurchases(loadArray("pc_purchases"));
    setHr(loadArray("pc_hr_labor"));
    setRentOpex(loadArray("pc_rent_opex"));
    setPettyCash(loadArray("pc_petty_cash"));
  };

  useEffect(() => {
    reload();
  }, []);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      let ok = true;
      if (fromDate) ok = ok && (!s.date || s.date >= fromDate);
      if (toDate) ok = ok && (!s.date || s.date <= toDate);
      return ok;
    });
  }, [sales, fromDate, toDate]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      let ok = true;
      if (fromDate) ok = ok && (!p.date || p.date >= fromDate);
      if (toDate) ok = ok && (!p.date || p.date <= toDate);
      return ok;
    });
  }, [purchases, fromDate, toDate]);

  const filteredHr = useMemo(() => {
    return hr.filter((h) => {
      let ok = true;
      if (fromDate) ok = ok && (!h.date || h.date >= fromDate);
      if (toDate) ok = ok && (!h.date || h.date <= toDate);
      return ok;
    });
  }, [hr, fromDate, toDate]);

  const filteredRent = useMemo(() => {
    return rentOpex.filter((r) => {
      let ok = true;
      if (fromDate) ok = ok && (!r.date || r.date >= fromDate);
      if (toDate) ok = ok && (!r.date || r.date <= toDate);
      return ok;
    });
  }, [rentOpex, fromDate, toDate]);

  const filteredPetty = useMemo(() => {
    return pettyCash.filter((p) => {
      let ok = true;
      if (fromDate) ok = ok && (!p.date || p.date >= fromDate);
      if (toDate) ok = ok && (!p.date || p.date <= toDate);
      return ok;
    });
  }, [pettyCash, fromDate, toDate]);

  const base = useMemo(
    () =>
      computeAggregates(
        filteredSales,
        filteredPurchases,
        filteredHr,
        filteredRent,
        filteredPetty
      ),
    [filteredSales, filteredPurchases, filteredHr, filteredRent, filteredPetty]
  );

  // Scenario numbers
  const scenario = useMemo(() => {
    const sSales =
      base.sales * (1 + Number(salesChangePct || 0) / 100);
    const sPurchases =
      base.purchases *
      (1 + Number(foodCostChangePct || 0) / 100);
    const sLabor =
      base.labor * (1 + Number(laborChangePct || 0) / 100);
    const sRent =
      base.rentOpex * (1 + Number(rentChangePct || 0) / 100);
    const sPetty =
      base.pettyCash *
      (1 + Number(pettyChangePct || 0) / 100);

    const ebitda =
      sSales - sPurchases - sLabor - sRent - sPetty;

    const result = {
      sales: sSales,
      purchases: sPurchases,
      labor: sLabor,
      rentOpex: sRent,
      pettyCash: sPetty,
      ebitda,
      foodCostPct: 0,
      laborPct: 0,
      ebitdaPct: 0,
    };

    if (sSales > 0) {
      result.foodCostPct = sPurchases / sSales;
      result.laborPct = sLabor / sSales;
      result.ebitdaPct = ebitda / sSales;
    }

    return result;
  }, [
    base,
    salesChangePct,
    foodCostChangePct,
    laborChangePct,
    rentChangePct,
    pettyChangePct,
  ]);

  const formatJod = (v) => Number(v || 0).toFixed(3);
  const formatPct = (v) => (Number(v || 0) * 100).toFixed(1) + "%";

  async function handleAiScenarioExplain() {
    try {
      setAiScenarioLoading(true);
      setAiScenarioText("");

      const payload = {
        filters: { fromDate, toDate },
        base,
        scenario,
        adjustments: {
          salesChangePct: Number(salesChangePct || 0),
          foodCostChangePct: Number(foodCostChangePct || 0),
          laborChangePct: Number(laborChangePct || 0),
          rentChangePct: Number(rentChangePct || 0),
          pettyChangePct: Number(pettyChangePct || 0),
        },
      };

      const res = await callAi({
        mode: "scenario",
        payload,
      });

      setAiScenarioText(res.text || "");
    } catch (err) {
      setAiScenarioText(
        `Failed to get AI scenario commentary: ${
          err.message || "Unknown error"
        }`
      );
    } finally {
      setAiScenarioLoading(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Scenario Planning</h2>
      <p className="page-subtitle">
        Simulate changes in sales, food cost, labor, and rent/opex and let
        AI explain the impact on EBITDA and margins.
      </p>

      {/* Filters */}
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <label className="field-label">From date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">To date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={reload}
          >
            Refresh base data
          </button>
        </div>
      </div>

      {/* Adjustments + Comparison */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 2fr)",
          gap: 16,
        }}
      >
        {/* Scenario sliders */}
        <div className="card">
          <h3 className="card-title">Adjustments</h3>
          <p className="page-subtitle">
            Set percentage changes vs the base period.
          </p>

          <div style={{ marginTop: 8, display: "grid", gap: 12 }}>
            <div>
              <label className="field-label">
                Sales change (%)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="range"
                  min="-30"
                  max="50"
                  value={salesChangePct}
                  onChange={(e) =>
                    setSalesChangePct(e.target.value)
                  }
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  value={salesChangePct}
                  onChange={(e) =>
                    setSalesChangePct(e.target.value)
                  }
                  style={{ width: 70 }}
                />
              </div>
            </div>

            <div>
              <label className="field-label">
                Food cost (purchases) change (%)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  value={foodCostChangePct}
                  onChange={(e) =>
                    setFoodCostChangePct(e.target.value)
                  }
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  value={foodCostChangePct}
                  onChange={(e) =>
                    setFoodCostChangePct(e.target.value)
                  }
                  style={{ width: 70 }}
                />
              </div>
            </div>

            <div>
              <label className="field-label">
                Labor cost change (%)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  value={laborChangePct}
                  onChange={(e) =>
                    setLaborChangePct(e.target.value)
                  }
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  value={laborChangePct}
                  onChange={(e) =>
                    setLaborChangePct(e.target.value)
                  }
                  style={{ width: 70 }}
                />
              </div>
            </div>

            <div>
              <label className="field-label">
                Rent &amp; Opex change (%)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={rentChangePct}
                  onChange={(e) =>
                    setRentChangePct(e.target.value)
                  }
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  value={rentChangePct}
                  onChange={(e) =>
                    setRentChangePct(e.target.value)
                  }
                  style={{ width: 70 }}
                />
              </div>
            </div>

            <div>
              <label className="field-label">
                Petty cash / other change (%)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={pettyChangePct}
                  onChange={(e) =>
                    setPettyChangePct(e.target.value)
                  }
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  value={pettyChangePct}
                  onChange={(e) =>
                    setPettyChangePct(e.target.value)
                  }
                  style={{ width: 70 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Comparison table */}
        <div className="card">
          <h3 className="card-title">Base vs Scenario</h3>
          <p className="page-subtitle">
            Compare the current period to the adjusted scenario.
          </p>

          <div className="table-wrapper" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Base</th>
                  <th>Scenario</th>
                  <th>Δ (Scenario - Base)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sales (JOD)</td>
                  <td>{formatJod(base.sales)}</td>
                  <td>{formatJod(scenario.sales)}</td>
                  <td>
                    {formatJod(
                      scenario.sales - base.sales
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Purchases / Food Cost (JOD)</td>
                  <td>{formatJod(base.purchases)}</td>
                  <td>{formatJod(scenario.purchases)}</td>
                  <td>
                    {formatJod(
                      scenario.purchases - base.purchases
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Labor (JOD)</td>
                  <td>{formatJod(base.labor)}</td>
                  <td>{formatJod(scenario.labor)}</td>
                  <td>
                    {formatJod(
                      scenario.labor - base.labor
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Rent &amp; Opex (JOD)</td>
                  <td>{formatJod(base.rentOpex)}</td>
                  <td>{formatJod(scenario.rentOpex)}</td>
                  <td>
                    {formatJod(
                      scenario.rentOpex - base.rentOpex
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Petty / Other (JOD)</td>
                  <td>{formatJod(base.pettyCash)}</td>
                  <td>{formatJod(scenario.pettyCash)}</td>
                  <td>
                    {formatJod(
                      scenario.pettyCash -
                        base.pettyCash
                    )}
                  </td>
                </tr>
                <tr>
                  <td>EBITDA (JOD)</td>
                  <td>{formatJod(base.ebitda)}</td>
                  <td>{formatJod(scenario.ebitda)}</td>
                  <td>
                    {formatJod(
                      scenario.ebitda - base.ebitda
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Food cost % of sales</td>
                  <td>{formatPct(base.foodCostPct)}</td>
                  <td>{formatPct(scenario.foodCostPct)}</td>
                  <td>
                    {(
                      (scenario.foodCostPct -
                        base.foodCostPct) *
                      100
                    ).toFixed(1)}
                    {" pp"}
                  </td>
                </tr>
                <tr>
                  <td>Labor % of sales</td>
                  <td>{formatPct(base.laborPct)}</td>
                  <td>{formatPct(scenario.laborPct)}</td>
                  <td>
                    {(
                      (scenario.laborPct - base.laborPct) *
                      100
                    ).toFixed(1)}
                    {" pp"}
                  </td>
                </tr>
                <tr>
                  <td>EBITDA % of sales</td>
                  <td>{formatPct(base.ebitdaPct)}</td>
                  <td>{formatPct(scenario.ebitdaPct)}</td>
                  <td>
                    {(
                      (scenario.ebitdaPct -
                        base.ebitdaPct) *
                      100
                    ).toFixed(1)}
                    {" pp"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="primary-btn"
            style={{ marginTop: 10 }}
            onClick={handleAiScenarioExplain}
          >
            Explain this scenario with AI
          </button>

          {aiScenarioLoading && (
            <p style={{ marginTop: 6 }}>Asking AI...</p>
          )}
          {aiScenarioText && (
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                backgroundColor: "#f1f5f9",
                padding: 10,
                borderRadius: 6,
                whiteSpace: "pre-wrap",
              }}
            >
              {aiScenarioText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScenarioPlanningHub;
