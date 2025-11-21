// src/features/menu-engineering/MenuEngineeringHub.jsx
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { callAi } from "../../utils/aiClient";

function loadMenuItems() {
  const keys = ["pc_menu_items", "pc_recipes"];
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // ignore
    }
  }
  return [];
}

function mapMenuItems(rawItems) {
  return rawItems.map((r, idx) => {
    const name =
      r.menuItemName ||
      r.menuName ||
      r.itemName ||
      r.recipeName ||
      `Item ${idx + 1}`;
    const brand = r.brand || "";
    const outlet = r.outlet || "";
    const category = r.category || r.menuCategory || "";
    const menuPrice =
      Number(
        r.menuPrice ??
          r.sellingPrice ??
          r.price ??
          0
      ) || 0;
    const foodCost =
      Number(
        r.costPerPortion ??
          r.foodCost ??
          r.cost ??
          0
      ) || 0;
    let popularity =
      Number(
        r.portionsSold ??
          r.qtySold ??
          r.popularity ??
          r.salesQty ??
          0
      ) || 0;

    if (!popularity && menuPrice > 0) {
      const revenue =
        Number(r.salesRevenue ?? 0) || 0;
      if (revenue > 0)
        popularity = revenue / menuPrice;
    }

    const margin = menuPrice - foodCost;
    const marginPct =
      menuPrice > 0 ? margin / menuPrice : 0;

    return {
      id: r.id || `m-${idx}`,
      name,
      brand,
      outlet,
      category,
      menuPrice,
      foodCost,
      popularity,
      margin,
      marginPct,
    };
  });
}

function classifyItems(items) {
  if (!items.length) return [];

  const avgMarginPct =
    items.reduce((sum, i) => sum + i.marginPct, 0) /
    items.length;
  const avgPopularity =
    items.reduce((sum, i) => sum + i.popularity, 0) /
    items.length;

  return items.map((i) => {
    let classification = "Unclassified";

    if (avgMarginPct === 0 || avgPopularity === 0) {
      classification = "Unclassified";
    } else {
      const highMargin = i.marginPct >= avgMarginPct;
      const highPopularity =
        i.popularity >= avgPopularity;

      if (highMargin && highPopularity)
        classification = "Star";
      else if (!highMargin && highPopularity)
        classification = "Plowhorse";
      else if (highMargin && !highPopularity)
        classification = "Puzzle";
      else classification = "Dog";
    }

    let suggestedMove = "";
    switch (classification) {
      case "Star":
        suggestedMove =
          "Keep, feature on menu, protect quality.";
        break;
      case "Plowhorse":
        suggestedMove =
          "High volume but low margin – consider price increase, portion control, or cost reduction.";
        break;
      case "Puzzle":
        suggestedMove =
          "High margin but low volume – improve menu placement, promotion, or description.";
        break;
      case "Dog":
        suggestedMove =
          "Low margin, low volume – consider reworking or removing.";
        break;
      default:
        suggestedMove = "Review performance.";
    }

    return {
      ...i,
      classification,
      suggestedMove,
    };
  });
}

function MenuEngineeringHub() {
  const [rawItems, setRawItems] = useState([]);
  const [aiExplainText, setAiExplainText] = useState("");
  const [aiActionsText, setAiActionsText] = useState("");
  const [aiExplainLoading, setAiExplainLoading] =
    useState(false);
  const [aiActionsLoading, setAiActionsLoading] =
    useState(false);

  const [brandFilter, setBrandFilter] = useState("All");
  const [outletFilter, setOutletFilter] = useState("All");

  useEffect(() => {
    setRawItems(loadMenuItems());
  }, []);

  const items = useMemo(
    () => classifyItems(mapMenuItems(rawItems)),
    [rawItems]
  );

  const brandOptions = useMemo(() => {
    const set = new Set();
    items.forEach((i) => {
      if (i.brand) set.add(String(i.brand));
    });
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  const outletOptions = useMemo(() => {
    const set = new Set();
    items.forEach((i) => {
      if (i.outlet) set.add(String(i.outlet));
    });
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const bOk =
        brandFilter === "All" ||
        String(i.brand) === brandFilter;
      const oOk =
        outletFilter === "All" ||
        String(i.outlet) === outletFilter;
      return bOk && oOk;
    });
  }, [items, brandFilter, outletFilter]);

  const chartData = useMemo(
    () =>
      filteredItems.map((i) => ({
        name: i.name,
        popularity: i.popularity,
        marginPct: i.marginPct * 100,
        classification: i.classification,
      })),
    [filteredItems]
  );

  const classificationSummary = useMemo(() => {
    const counts = {
      Star: 0,
      Plowhorse: 0,
      Puzzle: 0,
      Dog: 0,
      Unclassified: 0,
    };
    filteredItems.forEach((i) => {
      counts[i.classification] =
        (counts[i.classification] || 0) + 1;
    });
    return counts;
  }, [filteredItems]);

  async function handleExplainWithAI() {
    try {
      setAiExplainLoading(true);
      setAiExplainText("");

      const payload = {
        viewId: "menuEngineeringOverview",
        filters: { brandFilter, outletFilter },
        classificationSummary,
        items: filteredItems.map((i) => ({
          name: i.name,
          brand: i.brand,
          outlet: i.outlet,
          category: i.category,
          menuPrice: i.menuPrice,
          foodCost: i.foodCost,
          popularity: i.popularity,
          marginPct: i.marginPct,
          classification: i.classification,
        })),
      };

      const res = await callAi({
        mode: "viewExplain",
        payload,
      });

      setAiExplainText(res.text || "");
    } catch (err) {
      setAiExplainText(
        `Failed to get AI explanation: ${
          err.message || "Unknown error"
        }`
      );
    } finally {
      setAiExplainLoading(false);
    }
  }

  async function handleActionsWithAI() {
    try {
      setAiActionsLoading(true);
      setAiActionsText("");

      const payload = {
        viewId: "menuEngineeringActions",
        filters: { brandFilter, outletFilter },
        classificationSummary,
        items: filteredItems.map((i) => ({
          name: i.name,
          brand: i.brand,
          outlet: i.outlet,
          classification: i.classification,
          menuPrice: i.menuPrice,
          foodCost: i.foodCost,
          popularity: i.popularity,
          marginPct: i.marginPct,
        })),
      };

      const res = await callAi({
        mode: "viewExplain",
        payload,
      });

      setAiActionsText(res.text || "");
    } catch (err) {
      setAiActionsText(
        `Failed to get AI menu actions: ${
          err.message || "Unknown error"
        }`
      );
    } finally {
      setAiActionsLoading(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Menu Engineering</h2>
      <p className="page-subtitle">
        Classify items as Stars, Plowhorses, Puzzles, and Dogs
        based on margin and popularity. Use AI to interpret and
        suggest actions.
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
          <label className="field-label">Brand</label>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            {brandOptions.map((b) => (
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
            {outletOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setRawItems(loadMenuItems())}
          >
            Refresh menu items
          </button>
        </div>
      </div>

      {/* Layout: chart + table + AI side */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 2fr)",
          gap: 16,
        }}
      >
        {/* Chart + summary */}
        <div className="card">
          <h3 className="card-title">
            Popularity vs Profitability (Quadrant)
          </h3>
          <p className="page-subtitle">
            Each point is a menu item. X = popularity
            (approx. units sold), Y = margin %.
          </p>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="popularity"
                  name="Popularity"
                />
                <YAxis
                  dataKey="marginPct"
                  name="Margin %"
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value, name, props) => {
                    if (name === "marginPct") {
                      return [
                        value.toFixed(1) + "%",
                        "Margin %",
                      ];
                    }
                    if (name === "popularity") {
                      return [
                        value.toFixed(1),
                        "Popularity",
                      ];
                    }
                    return [value, name];
                  }}
                  labelFormatter={() => ""}
                />
                <Legend />
                <Scatter
                  name="Menu Items"
                  data={chartData}
                  fill="#8884d8"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 12 }}>
            <h4 className="card-title" style={{ fontSize: 14 }}>
              Classification counts
            </h4>
            <ul
              style={{
                fontSize: 13,
                paddingLeft: 18,
                marginTop: 4,
              }}
            >
              <li>Stars: {classificationSummary.Star}</li>
              <li>
                Plowhorses: {classificationSummary.Plowhorse}
              </li>
              <li>Puzzles: {classificationSummary.Puzzle}</li>
              <li>Dogs: {classificationSummary.Dog}</li>
              <li>
                Unclassified:{" "}
                {classificationSummary.Unclassified}
              </li>
            </ul>
          </div>
        </div>

        {/* Table + AI */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: "minmax(0, 1.6fr) minmax(0, 1fr)",
            gap: 16,
          }}
        >
          <div className="card">
            <h3 className="card-title">
              Item List &amp; Suggested Moves
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Brand</th>
                    <th>Outlet</th>
                    <th>Price</th>
                    <th>Cost</th>
                    <th>Popularity</th>
                    <th>Margin %</th>
                    <th>Class</th>
                    <th>Suggested move</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="9">
                        No menu items found. Make sure Recipes
                        / Menu data is saved.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((i) => (
                      <tr key={i.id}>
                        <td>{i.name}</td>
                        <td>{i.brand}</td>
                        <td>{i.outlet}</td>
                        <td>{i.menuPrice.toFixed(3)}</td>
                        <td>{i.foodCost.toFixed(3)}</td>
                        <td>{i.popularity.toFixed(1)}</td>
                        <td>
                          {(i.marginPct * 100).toFixed(1)}%
                        </td>
                        <td>{i.classification}</td>
                        <td style={{ fontSize: 12 }}>
                          {i.suggestedMove}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">
              AI Menu Insights &amp; Actions
            </h3>
            <p className="page-subtitle">
              Let AI explain the menu engineering results and
              suggest concrete actions.
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
                className="secondary-btn"
                onClick={handleExplainWithAI}
              >
                Explain with AI
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={handleActionsWithAI}
              >
                Suggest menu actions with AI
              </button>
            </div>

            {aiExplainLoading && (
              <p style={{ fontSize: 12 }}>Explaining...</p>
            )}
            {aiExplainText && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  backgroundColor: "#eef2ff",
                  padding: 8,
                  borderRadius: 6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {aiExplainText}
              </div>
            )}

            {aiActionsLoading && (
              <p style={{ fontSize: 12, marginTop: 8 }}>
                Generating action ideas...
              </p>
            )}
            {aiActionsText && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  backgroundColor: "#f1f5f9",
                  padding: 8,
                  borderRadius: 6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {aiActionsText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MenuEngineeringHub;
